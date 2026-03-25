#!/usr/bin/env node

// ============================================================================
// Follow Builders — Generate Video
// ============================================================================
// One-click orchestration: fetch digest → generate script → TTS audio →
// copy to Remotion public dir → render MP4.
// ============================================================================

import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, mkdir, rm, copyFile } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUTPUT = join(ROOT, "output");
const AUDIO_DIR = join(OUTPUT, "audio");
const VIDEO_DIR = join(ROOT, "release");
const VIDEO_PUBLIC_AUDIO = join(ROOT, "video", "public", "audio");

const EDGE_TTS =
  "/Library/Frameworks/Python.framework/Versions/3.13/bin/edge-tts";

const FPS = 30;
const CHARS_PER_SECOND = 4;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  console.log(`[generate-video] ${msg}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Estimate audio duration from Chinese text when TTS fails. */
function estimateDurationFromText(text) {
  const cnChars = text.replace(/[a-zA-Z\s\d]/g, "").length;
  const enWords = (text.match(/[a-zA-Z]+/g) || []).length;
  return cnChars / CHARS_PER_SECOND + enWords / 2.5;
}

/** Get precise duration via ffprobe. */
async function getAudioDuration(filePath) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "quiet",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    filePath,
  ]);
  return parseFloat(stdout.trim());
}

// ---------------------------------------------------------------------------
// Step 1: Run prepare-digest.js
// ---------------------------------------------------------------------------

async function runPrepareDigest() {
  log("Step 1/5 — Fetching digest...");
  const { stdout } = await execFileAsync("node", [
    join(__dirname, "prepare-digest.js"),
  ]);
  const digest = JSON.parse(stdout);
  if (digest.status === "error") {
    throw new Error(`prepare-digest failed: ${digest.message}`);
  }
  return digest;
}

// ---------------------------------------------------------------------------
// Step 2: Run generate-script.js (stdin/stdout pipe)
// ---------------------------------------------------------------------------

async function runGenerateScript(digest) {
  log("Step 2/5 — Generating video script...");
  return new Promise((resolve, reject) => {
    const child = spawn("node", [join(__dirname, "generate-script.js")], {
      stdio: ["pipe", "pipe", "inherit"],
    });

    const chunks = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));

    child.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`generate-script.js exited with code ${code}`));
      }
      const raw = Buffer.concat(chunks).toString("utf-8");
      let videoScript;
      try {
        videoScript = JSON.parse(raw);
      } catch (err) {
        return reject(
          new Error(`Failed to parse generate-script.js output: ${err.message}`)
        );
      }
      resolve(videoScript);
    });

    child.on("error", reject);

    // Pipe digest JSON to stdin
    child.stdin.write(JSON.stringify(digest, null, 2));
    child.stdin.end();
  });
}

// ---------------------------------------------------------------------------
// Step 3: TTS for each segment (with retry + exponential backoff)
// ---------------------------------------------------------------------------

async function runEdgeTTS(text, outputPath, attempt = 1) {
  const MAX_ATTEMPTS = 3;
  const ttsBin = existsSync(EDGE_TTS) ? EDGE_TTS : null;

  const args = [
    "--text",
    text,
    "--voice",
    "zh-CN-YunxiNeural",
    "--write-media",
    outputPath,
  ];

  try {
    if (ttsBin) {
      await execFileAsync(ttsBin, args);
    } else {
      // Fallback: python3 -m edge_tts
      await execFileAsync("python3", ["-m", "edge_tts", ...args]);
    }
    return true;
  } catch (err) {
    if (attempt < MAX_ATTEMPTS) {
      const backoffMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
      log(
        `  TTS attempt ${attempt} failed (${err.message}). Retrying in ${backoffMs}ms...`
      );
      await sleep(backoffMs);
      return runEdgeTTS(text, outputPath, attempt + 1);
    }
    throw err;
  }
}

async function generateTTSForSegments(segments) {
  log(`Step 3/5 — Generating TTS audio for ${segments.length} segments...`);

  const enriched = [];

  for (const segment of segments) {
    const audioFileName = `${segment.id}.mp3`;
    const audioPath = join(AUDIO_DIR, audioFileName);

    let durationInSeconds;
    let audioFile;

    try {
      await runEdgeTTS(segment.text, audioPath);
      durationInSeconds = await getAudioDuration(audioPath);
      audioFile = `audio/${audioFileName}`;
      log(`  [OK] ${segment.id} — ${durationInSeconds.toFixed(2)}s`);
    } catch (err) {
      log(
        `  [WARN] TTS failed for "${segment.id}" after 3 attempts: ${err.message}`
      );
      durationInSeconds = estimateDurationFromText(segment.text);
      audioFile = "";
      log(
        `  [WARN] Using estimated duration: ${durationInSeconds.toFixed(2)}s`
      );
    }

    enriched.push({
      ...segment,
      audioFile,
      durationInSeconds,
      durationInFrames: Math.ceil(durationInSeconds * FPS),
    });
  }

  return enriched;
}

// ---------------------------------------------------------------------------
// Step 4: Copy audio files to video/public/audio/
// ---------------------------------------------------------------------------

async function copyAssetsToPublic(segments) {
  log("Step 4/5 — Copying assets to video/public/...");

  // Copy audio files
  await mkdir(VIDEO_PUBLIC_AUDIO, { recursive: true });
  for (const segment of segments) {
    if (!segment.audioFile) continue;
    const fileName = basename(segment.audioFile);
    const src = join(AUDIO_DIR, fileName);
    const dest = join(VIDEO_PUBLIC_AUDIO, fileName);
    if (existsSync(src)) {
      await copyFile(src, dest);
      log(`  Copied audio/${fileName}`);
    }
  }

  // Copy Kling AI video backgrounds
  const klingDir = join(OUTPUT, "kling");
  const klingPublic = join(ROOT, "video", "public", "kling");
  if (existsSync(klingDir)) {
    await mkdir(klingPublic, { recursive: true });
    for (const segment of segments) {
      if (!segment.videoBg) continue;
      const fileName = basename(segment.videoBg);
      const src = join(klingDir, fileName);
      const dest = join(klingPublic, fileName);
      if (existsSync(src)) {
        await copyFile(src, dest);
        log(`  Copied kling/${fileName}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Step 5: Remotion render
// ---------------------------------------------------------------------------

async function renderVideo(remotionPropsPath, outputFile) {
  log("Step 5/5 — Rendering video with Remotion...");

  return new Promise((resolve, reject) => {
    const child = spawn(
      "npx",
      [
        "remotion",
        "render",
        "src/index.ts",
        "VideoComposition",
        outputFile,
        "--props",
        remotionPropsPath,
      ],
      {
        cwd: join(ROOT, "video"),
        stdio: "inherit",
      }
    );

    child.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`Remotion render exited with code ${code}`));
      }
      resolve();
    });

    child.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Telegram upload
// ---------------------------------------------------------------------------

async function sendToTelegram(videoPath, chatId, date) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("TELEGRAM_BOT_TOKEN not set, skipping Telegram upload");
    return;
  }

  console.log("Sending video to Telegram...");
  const videoData = await readFile(videoPath);
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("video", new Blob([videoData]), `ai-briefing-${date}.mp4`);
  form.append("caption", `AI Builder 日报 · ${date}`);

  const resp = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
    method: "POST",
    body: form,
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.warn(`Telegram upload failed: ${resp.status} ${err}`);
    return;
  }
  console.log("Video sent to Telegram!");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  const startTime = Date.now();

  // Ensure output directories exist
  await mkdir(AUDIO_DIR, { recursive: true });
  await mkdir(VIDEO_DIR, { recursive: true });

  // Check for --script flag to use a pre-built AI script
  const scriptFlagIdx = process.argv.indexOf("--script");
  const customScriptPath = scriptFlagIdx !== -1 ? process.argv[scriptFlagIdx + 1] : null;

  let videoScript;
  let stats;

  if (customScriptPath) {
    // Use pre-built AI script (e.g. from Claude Code session)
    log("Loading AI-processed script...");
    const raw = await readFile(customScriptPath, "utf-8");
    videoScript = JSON.parse(raw);
    stats = {
      xBuilders: videoScript.segments.filter((s) => s.type === "tweet").length,
      podcastEpisodes: videoScript.segments.filter((s) => s.type === "podcast").length,
      blogPosts: videoScript.segments.filter((s) => s.type === "blog").length,
    };
    log(
      `Script loaded: ${videoScript.segmentCount} segments, ~${videoScript.estimatedDurationSeconds}s`
    );
  } else {
    // Step 1: Fetch digest
    const digest = await runPrepareDigest();

    // Check if there is any content to process
    stats = digest.stats;
    const hasContent =
      (stats?.xBuilders || 0) > 0 ||
      (stats?.podcastEpisodes || 0) > 0 ||
      (stats?.blogPosts || 0) > 0;

    if (!hasContent) {
      log("No content found in digest (all feeds empty). Exiting early.");
      process.exit(0);
    }

    log(
      `Digest loaded: ${stats.xBuilders} builders, ${stats.podcastEpisodes} podcasts, ${stats.blogPosts} blogs`
    );

    // Step 2: Generate video script
    videoScript = await runGenerateScript(digest);
    log(
      `Script generated: ${videoScript.segmentCount} segments, ~${videoScript.estimatedDurationSeconds}s`
    );
  }

  // Step 3: TTS for each segment
  const enrichedSegments = await generateTTSForSegments(videoScript.segments);

  // Write script with audio info
  const scriptWithAudioPath = join(OUTPUT, "script-with-audio.json");
  await writeFile(
    scriptWithAudioPath,
    JSON.stringify({ ...videoScript, segments: enrichedSegments }, null, 2),
    "utf-8"
  );
  log(`Wrote enriched script to output/script-with-audio.json`);

  // Step 4: Copy audio files for Remotion staticFile access
  await copyAssetsToPublic(enrichedSegments);

  // Build remotion props
  const date = new Date().toISOString().split("T")[0];
  const remotionProps = {
    segments: enrichedSegments,
    date,
    stats: {
      builders: stats.xBuilders || 0,
      podcasts: stats.podcastEpisodes || 0,
      blogs: stats.blogPosts || 0,
    },
  };

  const remotionPropsPath = join(OUTPUT, "remotion-props.json");
  await writeFile(
    remotionPropsPath,
    JSON.stringify(remotionProps, null, 2),
    "utf-8"
  );
  log(`Wrote Remotion props to output/remotion-props.json`);

  // Step 5: Render video
  const outputFile = join(VIDEO_DIR, `digest-${date}.mp4`);
  await renderVideo(remotionPropsPath, outputFile);

  const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

  // Summary
  const totalAudioSegments = enrichedSegments.filter(
    (s) => s.audioFile
  ).length;
  const totalEstimated = enrichedSegments.filter((s) => !s.audioFile).length;
  const totalDurationSeconds = enrichedSegments.reduce(
    (sum, s) => sum + s.durationInSeconds,
    0
  );

  console.log("\n========================================");
  console.log(" Video Generation Complete");
  console.log("========================================");
  console.log(`  Output:         ${outputFile}`);
  console.log(`  Segments:       ${enrichedSegments.length}`);
  console.log(
    `  TTS audio:      ${totalAudioSegments} segments with audio, ${totalEstimated} estimated`
  );
  console.log(`  Total duration: ${totalDurationSeconds.toFixed(1)}s`);
  console.log(`  Elapsed time:   ${elapsedSeconds}s`);
  console.log("========================================\n");

  // Optional: send to Telegram
  if (process.argv.includes("--send")) {
    await sendToTelegram(outputFile, "8361396438", videoScript.date);
  }
}

run().catch(async (err) => {
  console.error(`\nERROR: ${err.message}`);
  try {
    if (existsSync(AUDIO_DIR)) {
      await rm(AUDIO_DIR, { recursive: true });
      console.log("Cleaned up partial audio files.");
    }
  } catch {}
  process.exit(1);
});
