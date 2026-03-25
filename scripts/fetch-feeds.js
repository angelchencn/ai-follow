#!/usr/bin/env node

// ============================================================================
// Follow Builders — Fetch Feeds
// ============================================================================
// Manually triggered: fetches latest data from RSS feeds and saves locally.
// No external dependencies — uses built-in fetch + simple XML parsing.
// ============================================================================

import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");

// ---------------------------------------------------------------------------
// Builder list (X/Twitter handles)
// ---------------------------------------------------------------------------

const BUILDERS = [
  { name: "Andrej Karpathy", handle: "karpathy" },
  { name: "Sam Altman", handle: "sama" },
  { name: "Swyx", handle: "swyx" },
  { name: "Guillermo Rauch", handle: "rauchg" },
  { name: "Amjad Masad", handle: "amasad" },
  { name: "Aaron Levie", handle: "levie" },
  { name: "Garry Tan", handle: "garrytan" },
  { name: "Alex Albert", handle: "alexalbert__" },
  { name: "Josh Woodward", handle: "joshwoodward" },
  { name: "Peter Yang", handle: "petergyang" },
  { name: "Nan Yu", handle: "thenanyu" },
  { name: "Cat Wu", handle: "_catwu" },
  { name: "Thariq", handle: "trq212" },
  { name: "Matt Turck", handle: "mattturck" },
  { name: "Zara Zhang", handle: "zarazhangrui" },
  { name: "Nikunj Kothari", handle: "nikunj" },
  { name: "Peter Steinberger", handle: "steipete" },
  { name: "Dan Shipper", handle: "danshipper" },
  { name: "Aditya Agarwal", handle: "adityaag" },
  { name: "Claude", handle: "claudeai" },
];

// ---------------------------------------------------------------------------
// Podcast RSS feeds
// ---------------------------------------------------------------------------

const PODCASTS = [
  {
    name: "Latent Space",
    rss: "https://api.substack.com/feed/podcast/1084089.rss",
  },
  {
    name: "Training Data",
    rss: "https://feeds.transistor.fm/training-data",
  },
  {
    name: "No Priors",
    rss: "https://anchor.fm/s/deaborc/podcast/rss",
  },
  {
    name: "Unsupervised Learning",
    rss: "https://api.substack.com/feed/podcast/2548.rss",
  },
  {
    name: "Data Driven NYC",
    rss: "https://feeds.simplecast.com/SqN0Dnoc",
  },
];

// ---------------------------------------------------------------------------
// Blog RSS feeds
// ---------------------------------------------------------------------------

const BLOGS = [
  {
    name: "Anthropic Engineering",
    rss: "https://www.anthropic.com/feed",
  },
];

// ---------------------------------------------------------------------------
// Simple XML parser (no dependencies)
// ---------------------------------------------------------------------------

function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

function extractCDATA(text) {
  const match = text.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return match ? match[1].trim() : text;
}

function extractAllItems(xml) {
  const items = [];
  const regex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    items.push(match[1]);
  }
  return items;
}

function extractLink(itemXml) {
  // Try <link> tag first
  const link = extractTag(itemXml, "link");
  if (link) return extractCDATA(link);
  // Try enclosure url
  const encMatch = itemXml.match(/<enclosure[^>]+url="([^"]+)"/);
  return encMatch ? encMatch[1] : "";
}

function extractPubDate(itemXml) {
  const pubDate = extractTag(itemXml, "pubDate");
  if (pubDate) return new Date(extractCDATA(pubDate)).toISOString();
  const dcDate = extractTag(itemXml, "dc:date");
  if (dcDate) return new Date(extractCDATA(dcDate)).toISOString();
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// RSSHub instances for Twitter/X
// ---------------------------------------------------------------------------

const RSSHUB_INSTANCES = [
  "https://rsshub.app",
  "https://rsshub.rssforever.com",
  "https://rsshub.feeded.xyz",
];

async function fetchWithTimeout(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function fetchRSS(url) {
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ---------------------------------------------------------------------------
// Fetch Twitter via RSSHub
// ---------------------------------------------------------------------------

async function fetchTwitterBuilder(builder) {
  const lookbackMs = 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - lookbackMs);

  for (const instance of RSSHUB_INSTANCES) {
    const url = `${instance}/twitter/user/${builder.handle}`;
    try {
      const xml = await fetchRSS(url);
      const channelDesc = extractTag(xml, "description");
      const items = extractAllItems(xml);

      const tweets = items
        .map((item) => {
          const title = extractCDATA(extractTag(item, "title"));
          const description = extractCDATA(extractTag(item, "description"));
          const link = extractLink(item);
          const pubDate = extractPubDate(item);

          // Use description for full text, fallback to title
          const text = description
            .replace(/<[^>]+>/g, "")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .trim() || title;

          return {
            id: link.split("/").pop() || "",
            text: text.slice(0, 500),
            createdAt: pubDate,
            url: link,
            likes: 0,
            retweets: 0,
            replies: 0,
          };
        })
        .filter((t) => new Date(t.createdAt) > cutoff && t.text.length > 5);

      console.log(`  [OK] @${builder.handle}: ${tweets.length} tweets (via ${instance})`);
      return {
        source: "x",
        name: builder.name,
        handle: builder.handle,
        bio: extractCDATA(channelDesc).replace(/<[^>]+>/g, "").slice(0, 200),
        tweets,
      };
    } catch (err) {
      console.log(`  [WARN] @${builder.handle} failed on ${instance}: ${err.message}`);
      continue;
    }
  }

  console.log(`  [FAIL] @${builder.handle}: all RSSHub instances failed`);
  return {
    source: "x",
    name: builder.name,
    handle: builder.handle,
    bio: "",
    tweets: [],
  };
}

// ---------------------------------------------------------------------------
// Fetch Podcasts
// ---------------------------------------------------------------------------

async function fetchPodcast(podcast) {
  const lookbackMs = 72 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - lookbackMs);

  try {
    const xml = await fetchRSS(podcast.rss);
    const items = extractAllItems(xml);

    const episodes = items
      .slice(0, 5)
      .map((item) => {
        const title = extractCDATA(extractTag(item, "title"));
        const description = extractCDATA(extractTag(item, "description"))
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&")
          .trim();
        const link = extractLink(item);
        const pubDate = extractPubDate(item);

        return {
          source: "podcast",
          name: podcast.name,
          title,
          url: link,
          publishedAt: pubDate,
          description: description.slice(0, 1000),
        };
      })
      .filter((ep) => new Date(ep.publishedAt) > cutoff);

    console.log(`  [OK] ${podcast.name}: ${episodes.length} episodes`);
    return episodes;
  } catch (err) {
    console.log(`  [FAIL] ${podcast.name}: ${err.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Fetch Blogs
// ---------------------------------------------------------------------------

async function fetchBlog(blog) {
  const lookbackMs = 72 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - lookbackMs);

  try {
    const xml = await fetchRSS(blog.rss);
    const items = extractAllItems(xml);

    const posts = items
      .slice(0, 5)
      .map((item) => {
        const title = extractCDATA(extractTag(item, "title"));
        const description = extractCDATA(extractTag(item, "description"))
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&")
          .trim();
        const link = extractLink(item);
        const pubDate = extractPubDate(item);

        return {
          source: "blog",
          name: blog.name,
          title,
          url: link,
          publishedAt: pubDate,
          summary: description.slice(0, 500),
        };
      })
      .filter((post) => new Date(post.publishedAt) > cutoff);

    console.log(`  [OK] ${blog.name}: ${posts.length} posts`);
    return posts;
  } catch (err) {
    console.log(`  [FAIL] ${blog.name}: ${err.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Fetch Feeds ===\n");

  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });

  // 1. Fetch Twitter/X
  console.log("Fetching X/Twitter via RSSHub...");
  const xResults = [];
  for (const builder of BUILDERS) {
    const result = await fetchTwitterBuilder(builder);
    xResults.push(result);
  }

  const feedX = {
    generatedAt: new Date().toISOString(),
    lookbackHours: 24,
    x: xResults,
    stats: {
      xBuilders: xResults.filter((b) => b.tweets.length > 0).length,
      totalTweets: xResults.reduce((sum, b) => sum + b.tweets.length, 0),
    },
  };

  await writeFile(join(DATA_DIR, "feed-x.json"), JSON.stringify(feedX, null, 2));
  console.log(`\nX/Twitter: ${feedX.stats.xBuilders} builders, ${feedX.stats.totalTweets} tweets\n`);

  // 2. Fetch Podcasts
  console.log("Fetching Podcasts via RSS...");
  const allEpisodes = [];
  for (const podcast of PODCASTS) {
    const episodes = await fetchPodcast(podcast);
    allEpisodes.push(...episodes);
  }

  const feedPodcasts = {
    generatedAt: new Date().toISOString(),
    lookbackHours: 72,
    podcasts: allEpisodes,
    stats: {
      podcastEpisodes: allEpisodes.length,
    },
  };

  await writeFile(join(DATA_DIR, "feed-podcasts.json"), JSON.stringify(feedPodcasts, null, 2));
  console.log(`\nPodcasts: ${feedPodcasts.stats.podcastEpisodes} episodes\n`);

  // 3. Fetch Blogs
  console.log("Fetching Blogs via RSS...");
  const allPosts = [];
  for (const blog of BLOGS) {
    const posts = await fetchBlog(blog);
    allPosts.push(...posts);
  }

  const feedBlogs = {
    generatedAt: new Date().toISOString(),
    lookbackHours: 72,
    blogs: allPosts,
    stats: {
      blogPosts: allPosts.length,
    },
  };

  await writeFile(join(DATA_DIR, "feed-blogs.json"), JSON.stringify(feedBlogs, null, 2));
  console.log(`\nBlogs: ${feedBlogs.stats.blogPosts} posts\n`);

  // Summary
  console.log("========================================");
  console.log(" Fetch Complete");
  console.log("========================================");
  console.log(`  Builders: ${feedX.stats.xBuilders} with tweets (${feedX.stats.totalTweets} total)`);
  console.log(`  Podcasts: ${feedPodcasts.stats.podcastEpisodes} episodes`);
  console.log(`  Blogs:    ${feedBlogs.stats.blogPosts} posts`);
  console.log(`  Data dir: ${DATA_DIR}`);
  console.log("========================================\n");
}

main().catch((err) => {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
});
