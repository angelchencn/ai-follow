#!/usr/bin/env node

// ============================================================================
// Follow Builders — Generate Script
// ============================================================================
// Reads prepare-digest.js output from stdin, transforms into VideoScript JSON.
// Pure template-based — no external API calls, no cost.
// ============================================================================

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
// Segment builders (template-based, no API)
// ---------------------------------------------------------------------------

function buildIntroSegment(digest) {
  const { stats } = digest;
  const date = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const text = `欢迎收看 AI Builders 每日简报，今天是${date}。今日为你带来 ${stats.xBuilders} 位 builder 的动态、${stats.podcastEpisodes} 期播客精选，以及 ${stats.blogPosts} 篇博客摘要。`;
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
  const text = `今日速览：${stats.xBuilders} 位顶级 builder 的实时动态，${stats.podcastEpisodes} 期深度播客，${stats.blogPosts} 篇前沿博客。`;
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

function buildTweetSegment(builder) {
  // Extract key info from tweets without LLM
  const handle = (builder.handle || "").replace(/^@/, "");
  const name = builder.name || handle;
  const bio = builder.bio || "";
  const role = bio ? `，${bio.slice(0, 30)}` : "";

  // Pick top tweets (first 3 by feed order)
  const topTweets = (builder.tweets || []).slice(0, 3);
  const tweetSummaries = topTweets
    .map((t) => {
      // Trim tweet text to reasonable length for narration
      const text = (t.text || "").replace(/https?:\/\/\S+/g, "").trim();
      return text.length > 80 ? text.slice(0, 80) : text;
    })
    .filter((t) => t.length > 5);

  const narration = tweetSummaries.length > 0
    ? `${name}${role}。${tweetSummaries.join("。")}。`
    : `${name}${role}，暂无重要更新。`;

  return {
    id: `tweet-${handle || name.toLowerCase().replace(/\s+/g, "-")}`,
    type: "tweet",
    text: narration,
    display: {
      title: name,
      subtitle: tweetSummaries.join(" · ").slice(0, 100),
      avatarUrl: builder.avatarUrl || undefined,
      avatarFallback: name ? name[0] : "?",
      qrUrl: topTweets[0]?.url || undefined,
    },
  };
}

function buildPodcastSegment(podcast) {
  const title = podcast.title || "未知播客";
  const show = podcast.show || podcast.name || "";
  const description = (podcast.description || "").slice(0, 200);

  const narration = description
    ? `${show}最新一期：${title}。${description}。`
    : `${show}最新一期：${title}。`;

  const slugId = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  return {
    id: `podcast-${slugId}`,
    type: "podcast",
    text: narration,
    display: {
      title: show,
      subtitle: title,
      qrUrl: podcast.url || undefined,
    },
  };
}

function buildBlogSegment(blog) {
  const blogName = blog.name || blog.source || "博客";
  const posts = blog.posts || [];

  const postSummaries = posts
    .slice(0, 3)
    .map((p) => {
      const summary = (p.summary || p.description || "").slice(0, 100);
      return summary ? `${p.title}：${summary}` : p.title;
    })
    .filter(Boolean);

  const narration = postSummaries.length > 0
    ? `${blogName}发布新文章。${postSummaries.join("。")}。`
    : `${blogName}暂无新文章。`;

  const slugId = blogName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  return {
    id: `blog-${slugId}`,
    type: "blog",
    text: narration,
    display: {
      title: blogName,
      subtitle: posts.map((p) => p.title).join(" · ").slice(0, 80),
    },
  };
}

function buildOutroSegment() {
  return {
    id: "outro",
    type: "outro",
    text: "以上就是今天的 AI Builders 简报全部内容。关注我们，追踪 AI 前沿动态。明天见！",
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
  let adjusted = trimTweetSegments(segments);

  if (totalDuration(adjusted) > MAX_DURATION_SECONDS) {
    adjusted = reducePodcasts(adjusted);
  }

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

  // Build all segments (no API calls)
  const tweetSegments = (digest.x || []).map((builder) =>
    buildTweetSegment(builder)
  );

  const podcastSegments = (digest.podcasts || []).map((podcast) =>
    buildPodcastSegment(podcast)
  );

  const blogSegments = (digest.blogs || []).map((blog) =>
    buildBlogSegment(blog)
  );

  const rawSegments = [
    buildIntroSegment(digest),
    buildOverviewSegment(digest),
    ...tweetSegments,
    ...podcastSegments,
    ...blogSegments,
    buildOutroSegment(),
  ];

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
