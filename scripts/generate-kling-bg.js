#!/usr/bin/env node

// ============================================================================
// Follow Builders — Generate Kling AI Video Backgrounds
// ============================================================================
// Reads AI script JSON + feed data, generates 5s AI video backgrounds
// for each segment using Kling API (image-to-video or text-to-video).
// ============================================================================

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const KLING_OUTPUT = join(ROOT, "output", "kling");

// ---------------------------------------------------------------------------
// Load .env
// ---------------------------------------------------------------------------

async function loadEnv() {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  const content = await readFile(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

// ---------------------------------------------------------------------------
// Kling API helpers
// ---------------------------------------------------------------------------

function createJWT(accessKey, secretKey) {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ iss: accessKey, exp: now + 1800, nbf: now - 5, iat: now }),
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(header + "." + payload)
    .digest("base64url");
  return header + "." + payload + "." + signature;
}

function getToken() {
  return createJWT(process.env.KLING_ACCESS_KEY, process.env.KLING_SECRET_KEY);
}

async function submitTextToVideo(prompt) {
  const res = await fetch("https://api.klingai.com/v1/videos/text2video", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + getToken(),
    },
    body: JSON.stringify({
      prompt,
      negative_prompt: "模糊，低质量，文字，字幕，水印",
      cfg_scale: 0.5,
      mode: "std",
      aspect_ratio: "9:16",
      duration: "5",
    }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`Kling submit failed: ${data.message}`);
  return data.data.task_id;
}

async function submitImageToVideo(imageUrl, prompt) {
  const res = await fetch("https://api.klingai.com/v1/videos/image2video", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + getToken(),
    },
    body: JSON.stringify({
      image: imageUrl,
      prompt,
      negative_prompt: "模糊，低质量，文字，字幕，水印",
      cfg_scale: 0.5,
      mode: "std",
      aspect_ratio: "9:16",
      duration: "5",
    }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`Kling image2video failed: ${data.message}`);
  return data.data.task_id;
}

async function pollTask(taskId, endpoint) {
  const maxPolls = 60; // 10 minutes max
  for (let i = 0; i < maxPolls; i++) {
    const res = await fetch(
      `https://api.klingai.com/v1/videos/${endpoint}/${taskId}`,
      { headers: { Authorization: "Bearer " + getToken() } },
    );
    const data = await res.json();
    const status = data.data?.task_status;

    if (status === "succeed") {
      return data.data.task_result.videos[0].url;
    }
    if (status === "failed") {
      throw new Error(`Kling task ${taskId} failed`);
    }
    await new Promise((r) => setTimeout(r, 10000));
  }
  throw new Error(`Kling task ${taskId} timed out`);
}

async function downloadVideo(url, outputPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(outputPath, buffer);
}

// ---------------------------------------------------------------------------
// Prompt generation — content-aware visual prompts
// ---------------------------------------------------------------------------

const VISUAL_STYLES = {
  intro: "futuristic news broadcast studio, holographic AI dashboard, dark blue ambient lighting, floating data particles, cinematic camera slowly zooming in",
  overview: "abstract data visualization, flowing neural network connections, dark background with glowing cyan and green nodes, smooth camera pan",
  tweet: "tech industry portrait style, soft depth of field, modern office background with subtle screen glow, gentle camera movement",
  podcast: "podcast recording studio atmosphere, warm ambient lighting, sound waves visualization, microphone silhouette, smooth dolly shot",
  blog: "modern tech company workspace, code on screens, architectural interior, clean minimalist design, slow tracking shot",
  outro: "abstract AI landscape, flowing light particles merging into horizon, gradient dark to dawn sky, elegant camera pull back",
};

function buildVisualPrompt(segment, builder) {
  const base = VISUAL_STYLES[segment.type] || VISUAL_STYLES.tweet;

  if (segment.type === "tweet" && builder) {
    const topic = segment.display?.subtitle || "";
    return `portrait of a tech leader, ${base}, topic: ${topic}`;
  }

  if (segment.type === "podcast") {
    const show = segment.display?.title || "";
    return `${base}, podcast show: ${show}`;
  }

  if (segment.type === "blog") {
    return `${base}, engineering blog visual`;
  }

  return base;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  await loadEnv();

  if (!process.env.KLING_ACCESS_KEY || !process.env.KLING_SECRET_KEY) {
    console.error("ERROR: KLING_ACCESS_KEY and KLING_SECRET_KEY required in .env");
    process.exit(1);
  }

  const scriptPath = process.argv[2];
  if (!scriptPath) {
    console.error("Usage: node generate-kling-bg.js <ai-script.json>");
    process.exit(1);
  }

  const script = JSON.parse(await readFile(scriptPath, "utf-8"));
  await mkdir(KLING_OUTPUT, { recursive: true });

  // Load feed data for avatars
  const feedXPath = join(ROOT, "data", "feed-x.json");
  let buildersByHandle = new Map();
  if (existsSync(feedXPath)) {
    const feedX = JSON.parse(await readFile(feedXPath, "utf-8"));
    for (const b of feedX.x) {
      buildersByHandle.set(b.handle.toLowerCase(), b);
    }
  }

  console.log(`=== Kling AI Video Background Generation ===\n`);
  console.log(`Segments: ${script.segments.length}`);

  // Build list of segments to generate (skip existing)
  const pending = [];
  let succeeded = 0;
  let failed = 0;

  for (const segment of script.segments) {
    const outputFile = join(KLING_OUTPUT, `${segment.id}.mp4`);

    if (existsSync(outputFile)) {
      console.log(`  [SKIP] ${segment.id} — already exists`);
      succeeded++;
      continue;
    }

    const handleMatch = segment.id.match(/^tweet-(.+)$/);
    const builder = handleMatch
      ? buildersByHandle.get(handleMatch[1].toLowerCase())
      : null;

    const prompt = buildVisualPrompt(segment, builder);
    pending.push({ segment, outputFile, prompt, builder });
  }

  // Process in batches of 3 to respect Kling concurrency limits
  const BATCH_SIZE = 3;
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(pending.length / BATCH_SIZE);
    console.log(`\n--- Batch ${batchNum}/${totalBatches} ---`);

    // Submit batch
    const tasks = [];
    for (const item of batch) {
      try {
        let taskId;
        let endpoint;

        if (item.builder?.avatarUrl && item.segment.type === "tweet") {
          console.log(`  [SUBMIT] ${item.segment.id} — image-to-video (avatar)`);
          taskId = await submitImageToVideo(item.builder.avatarUrl, item.prompt);
          endpoint = "image2video";
        } else {
          console.log(`  [SUBMIT] ${item.segment.id} — text-to-video`);
          taskId = await submitTextToVideo(item.prompt);
          endpoint = "text2video";
        }

        tasks.push({ ...item, taskId, endpoint });
      } catch (err) {
        // Retry once after waiting if hit concurrency limit
        if (err.message.includes("parallel task over resource pack limit")) {
          console.log(`  [WAIT] ${item.segment.id} — concurrency limit, waiting 60s...`);
          await new Promise((r) => setTimeout(r, 60000));
          try {
            let taskId2;
            let endpoint2;
            if (item.builder?.avatarUrl && item.segment.type === "tweet") {
              taskId2 = await submitImageToVideo(item.builder.avatarUrl, item.prompt);
              endpoint2 = "image2video";
            } else {
              taskId2 = await submitTextToVideo(item.prompt);
              endpoint2 = "text2video";
            }
            console.log(`  [RETRY OK] ${item.segment.id}`);
            tasks.push({ ...item, taskId: taskId2, endpoint: endpoint2 });
          } catch (err2) {
            console.log(`  [FAIL] ${item.segment.id} — ${err2.message}`);
            failed++;
          }
        } else {
          console.log(`  [FAIL] ${item.segment.id} — ${err.message}`);
          failed++;
        }
      }
    }

    // Poll and download batch before starting next
    for (const task of tasks) {
      try {
        console.log(`  [POLL] ${task.segment.id}...`);
        const videoUrl = await pollTask(task.taskId, task.endpoint);
        await downloadVideo(videoUrl, task.outputFile);
        console.log(`  [OK] ${task.segment.id} — saved`);
        succeeded++;
      } catch (err) {
        console.log(`  [FAIL] ${task.segment.id} — ${err.message}`);
        failed++;
      }
    }
  }

  // Update script with video background paths
  const updatedSegments = script.segments.map((seg) => {
    const bgFile = join(KLING_OUTPUT, `${seg.id}.mp4`);
    return {
      ...seg,
      videoBg: existsSync(bgFile) ? `kling/${seg.id}.mp4` : undefined,
    };
  });

  const outputScript = { ...script, segments: updatedSegments };
  const outputPath = join(ROOT, "output", "ai-script-with-bg.json");
  await writeFile(outputPath, JSON.stringify(outputScript, null, 2));

  console.log(`\n========================================`);
  console.log(` Kling Generation Complete`);
  console.log(`========================================`);
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed:    ${failed}`);
  console.log(`  Output:    ${outputPath}`);
  console.log(`========================================\n`);
}

main().catch((err) => {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
});
