#!/usr/bin/env node

// ============================================================================
// Follow Builders — Generate Script
// ============================================================================
// Reads prepare-digest.js output from stdin, calls Claude API (Haiku) to
// generate Chinese narration for each segment, outputs VideoScript JSON.
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";

const MAX_DURATION_SECONDS = 300;
const CHARS_PER_SECOND = 4;

// ---------------------------------------------------------------------------
// Duration estimation
// ---------------------------------------------------------------------------

function estimateDuration(text) {
  const cnChars = text.replace(/[a-zA-Z\s\d]/g, "").length;
  const enWords = (text.match(/[a-zA-Z]+/g) || []).length;
  return cnChars / CHARS_PER_SECOND + enWords / 2.5;
}

function totalDuration(segments) {
  return segments.reduce((sum, seg) => sum + estimateDuration(seg.text), 0);
}

// ---------------------------------------------------------------------------
// Claude API
// ---------------------------------------------------------------------------

async function generateNarration(client, systemPrompt, content) {
  const resp = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system:
      systemPrompt +
      "\n\n输出要求：生成简洁的中文播报文案，适合语音朗读，每段不超过100字。",
    messages: [{ role: "user", content }],
  });
  return resp.content[0].text;
}

// ---------------------------------------------------------------------------
// Segment builders
// ---------------------------------------------------------------------------

function buildIntroSegment(digest) {
  const { stats } = digest;
  const date = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const text = `欢迎收看 AI Builders 每日简报，今天是${date}。今日为你带来 ${stats.xBuilders} 位 builder 的 ${stats.totalTweets} 条推文动态、${stats.podcastEpisodes} 期播客精选，以及 ${stats.blogPosts} 篇官方博客摘要，一起来看看 AI 圈的最新进展。`;
  return {
    id: "intro",
    type: "intro",
    text,
    display: {
      title: "AI Builders 每日简报",
      subtitle: date,
    },
  };
}

function buildOverviewSegment(digest) {
  const { stats } = digest;
  const text = `今日速览：来自 ${stats.xBuilders} 位顶级 builder 的实时动态，${stats.podcastEpisodes} 期深度播客，${stats.blogPosts} 篇前沿博客，精华内容全在这里。`;
  return {
    id: "overview",
    type: "overview",
    text,
    display: {
      title: "今日速览",
      points: [
        `${stats.xBuilders} 位 Builder 动态`,
        `${stats.totalTweets} 条推文精选`,
        `${stats.podcastEpisodes} 期播客`,
        `${stats.blogPosts} 篇博客`,
      ],
    },
  };
}

async function buildTweetSegment(client, systemPrompt, builder) {
  const tweetLines = builder.tweets
    .map((t) => `- ${t.text}${t.url ? ` (${t.url})` : ""}`)
    .join("\n");

  const content = `Builder: ${builder.name} (${builder.handle})\n推文：\n${tweetLines}`;
  const text = await generateNarration(client, systemPrompt, content);

  const handle = builder.handle.replace(/^@/, "");
  return {
    id: `tweet-${handle}`,
    type: "tweet",
    text,
    display: {
      title: builder.name,
      subtitle: builder.handle,
      avatarUrl: builder.avatarUrl || undefined,
      avatarFallback: builder.name ? builder.name[0] : handle[0],
    },
  };
}

async function buildPodcastSegment(client, systemPrompt, podcast) {
  const content = `播客：${podcast.title}\n节目：${podcast.show || ""}\n简介：${podcast.description || ""}\nURL: ${podcast.url || ""}`;
  const text = await generateNarration(client, systemPrompt, content);

  const slugId = (podcast.title || "podcast")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  return {
    id: `podcast-${slugId}`,
    type: "podcast",
    text,
    display: {
      title: podcast.title || "",
      subtitle: podcast.show || "",
      qrUrl: podcast.url || undefined,
    },
  };
}

async function buildBlogSegment(client, systemPrompt, blog) {
  const postLines = (blog.posts || [])
    .map((p) => `- ${p.title}: ${p.summary || p.description || ""}${p.url ? ` (${p.url})` : ""}`)
    .join("\n");

  const content = `博客：${blog.name || blog.source || ""}\n文章：\n${postLines}`;
  const text = await generateNarration(client, systemPrompt, content);

  const slugId = (blog.name || blog.source || "blog")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  return {
    id: `blog-${slugId}`,
    type: "blog",
    text,
    display: {
      title: blog.name || blog.source || "",
      subtitle: (blog.posts || []).map((p) => p.title).join(" · ").slice(0, 80),
    },
  };
}

function buildOutroSegment() {
  const text =
    "以上就是今天的 AI Builders 简报全部内容。记得关注这些顶级 builder，追踪 AI 前沿动态。我们明天见！";
  return {
    id: "outro",
    type: "outro",
    text,
    display: {
      title: "感谢收看",
      subtitle: "AI Builders 每日简报",
    },
  };
}

// ---------------------------------------------------------------------------
// Duration budget — 3-step cascade (immutable)
// ---------------------------------------------------------------------------

const MIN_TWEET_SEGMENTS = 3;
const TRUNCATE_TWEET_CHARS = 80;

function applyDurationBudget(segments) {
  // Step 1: Remove lowest-priority tweet segments (last ones) until under budget
  let adjusted = trimTweetSegments(segments);

  // Step 2: Reduce podcasts to 1 if still over budget
  if (totalDuration(adjusted) > MAX_DURATION_SECONDS) {
    adjusted = reducePodcasts(adjusted);
  }

  // Step 3: Truncate tweet text to 80 chars if still over budget
  if (totalDuration(adjusted) > MAX_DURATION_SECONDS) {
    adjusted = truncateTweetText(adjusted);
  }

  return adjusted;
}

function trimTweetSegments(segments) {
  const tweetSegments = segments.filter((s) => s.type === "tweet");
  const nonTweetSegments = segments.filter((s) => s.type !== "tweet");

  let kept = tweetSegments;
  while (
    totalDuration([...nonTweetSegments, ...kept]) > MAX_DURATION_SECONDS &&
    kept.length > MIN_TWEET_SEGMENTS
  ) {
    kept = kept.slice(0, kept.length - 1);
  }

  // Reconstruct preserving original order
  const keptIds = new Set(kept.map((s) => s.id));
  return segments.filter((s) => s.type !== "tweet" || keptIds.has(s.id));
}

function reducePodcasts(segments) {
  let podcastCount = 0;
  return segments.filter((s) => {
    if (s.type !== "podcast") return true;
    podcastCount += 1;
    return podcastCount <= 1;
  });
}

function truncateTweetText(segments) {
  return segments.map((s) => {
    if (s.type !== "tweet") return s;
    if (s.text.length <= TRUNCATE_TWEET_CHARS) return s;
    return { ...s, text: s.text.slice(0, TRUNCATE_TWEET_CHARS) };
  });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateDigest(digest) {
  const required = ["summarize_tweets", "summarize_podcast", "summarize_blogs"];
  const missing = required.filter((key) => !digest.prompts?.[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required prompt fields in digest.prompts: ${missing.join(", ")}`
    );
  }
}

// ---------------------------------------------------------------------------
// Read stdin
// ---------------------------------------------------------------------------

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const raw = await readStdin();

  let digest;
  try {
    digest = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse digest JSON from stdin: ${err.message}`);
  }

  validateDigest(digest);

  const client = new Anthropic();
  const { prompts } = digest;

  // Build fixed segments
  const introSegment = buildIntroSegment(digest);
  const overviewSegment = buildOverviewSegment(digest);
  const outroSegment = buildOutroSegment();

  // Generate tweet segments in parallel
  const tweetSegmentPromises = (digest.x || []).map((builder) =>
    buildTweetSegment(client, prompts.summarize_tweets, builder)
  );

  // Generate podcast segments in parallel
  const podcastSegmentPromises = (digest.podcasts || []).map((podcast) =>
    buildPodcastSegment(client, prompts.summarize_podcast, podcast)
  );

  // Generate blog segments in parallel
  const blogSegmentPromises = (digest.blogs || []).map((blog) =>
    buildBlogSegment(client, prompts.summarize_blogs, blog)
  );

  const [tweetSegments, podcastSegments, blogSegments] = await Promise.all([
    Promise.all(tweetSegmentPromises),
    Promise.all(podcastSegmentPromises),
    Promise.all(blogSegmentPromises),
  ]);

  // Assemble raw segments (order: intro, overview, tweets, podcasts, blogs, outro)
  const rawSegments = [
    introSegment,
    overviewSegment,
    ...tweetSegments,
    ...podcastSegments,
    ...blogSegments,
    outroSegment,
  ];

  // Apply duration budget
  const segments = applyDurationBudget(rawSegments);

  const videoScript = {
    generatedAt: new Date().toISOString(),
    estimatedDurationSeconds: Math.round(totalDuration(segments)),
    segmentCount: segments.length,
    segments,
  };

  process.stdout.write(JSON.stringify(videoScript, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write(
    JSON.stringify({ status: "error", message: err.message }) + "\n"
  );
  process.exit(1);
});
