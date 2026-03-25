# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An AI builder digest system that aggregates feeds from 20 AI builders (X/Twitter), 5 podcasts, and Anthropic blogs, then generates either a Chinese text briefing (via `/ai-info` skill) or a vertical short video briefing with TTS narration (via Remotion). Delivers to Telegram.

## Commands

```bash
# Install dependencies (both directories)
cd scripts && npm install && cd ../video && npm install

# Fetch latest feed data (Twitter via Apify, podcasts/blogs via RSS)
node scripts/fetch-feeds.js

# Generate video (template-based script)
node scripts/generate-video.js

# Generate video with AI-processed Chinese script (from Claude Code session)
node scripts/generate-video.js --script output/ai-script.json

# Generate video + send to Telegram
node scripts/generate-video.js --send

# Preview video in Remotion Studio
cd video && npx remotion studio src/index.ts

# Run pipeline steps individually
node scripts/prepare-digest.js                                    # load feeds → JSON
node scripts/prepare-digest.js | node scripts/generate-script.js  # → video script JSON
```

## Required Environment

- `ffprobe` — system dependency (`brew install ffmpeg`)
- `edge-tts` — Python package (`pip install edge-tts`)
- `APIFY_TOKEN` — required for Twitter/X data fetching (in `.env` file, ~$0.25/1k tweets)
- `TELEGRAM_BOT_TOKEN` — optional, only for `--send` flag

## Architecture

Two main workflows share the same data layer:

**Text briefing:** `/ai-info` skill → `prepare-digest.js` → Claude Code generates Chinese summary in-session (Max subscription, zero API cost) → Telegram

**Video briefing (template):** `prepare-digest.js` → `generate-script.js` → `generate-video.js` → MP4 to `release/`

**Video briefing (AI):** Claude Code reads `data/` → writes `output/ai-script.json` (Chinese narration) → `generate-video.js --script output/ai-script.json` → MP4 to `release/`

### Scripts

- **scripts/fetch-feeds.js** — Data collection. Twitter/X via Apify (`kaitoeasyapi~twitter-x-data-tweet-scraper-pay-per-result-cheapest`), podcasts and blogs via RSS. Saves to `data/`. Filters out replies (`isReply`), normalizes URLs to `x.com`. Loads `.env` for `APIFY_TOKEN`. Batches handles in groups of 5 with OR queries.
- **scripts/prepare-digest.js** — Loads feeds (local `data/` first, falls back to remote GitHub URLs) + prompt templates from `prompts/`. User overrides from `~/.follow-builders/prompts/` take precedence. Outputs merged digest JSON to stdout.
- **scripts/generate-script.js** — Reads digest from stdin, generates Chinese narration via templates (no API), applies 300s duration budget (3-step cascade: trim tweets → reduce podcasts → truncate text), outputs VideoScript JSON.
- **scripts/generate-video.js** — Orchestrator: digest → script → Edge TTS (`zh-CN-YunxiNeural`) → copies audio to `video/public/audio/` → Remotion render → 1080x1920 MP4 to `release/`. Supports `--script [path]` to skip steps 1-2 and use a pre-built AI script.

### Data flow

```
fetch-feeds.js → data/*.json (local)
                      ↓
prepare-digest.js (local data/ or remote GitHub fallback)
         ↓                        ↓
   /ai-info skill          generate-script.js (template)
   (text briefing)               ↓
                    OR: Claude Code → ai-script.json (AI Chinese)
                                  ↓
                     generate-video.js [--script]
                       ├── Edge TTS → audio/
                       ├── Copy to video/public/audio/
                       └── Remotion render → release/*.mp4
```

### Video project

`video/` is a Remotion React/TypeScript project. Entry: `src/index.ts` → `Root.tsx` → `VideoComposition.tsx` which maps segment types to components (Intro, Overview, TweetCard, PodcastCard, BlogCard, Outro) via `<Sequence>` with audio-driven timing. Audio files must be in `video/public/audio/` for Remotion's `staticFile()`. Theme: dark bg (`#0a0a0f`), accent cyan/green, Noto Sans SC font, 1080x1920 @ 30fps.

## Key Design Decisions

- **Local-first data**: `prepare-digest.js` reads `data/` first, remote GitHub as fallback
- **Audio-driven timeline**: Frame count = `Math.ceil(audioDuration * 30)`. No hardcoded durations.
- **Duration budget**: 300s hard cap enforced immutably — filter/map, never splice/mutate
- **TTS retry**: 3 attempts with exponential backoff (1s/2s/4s), falls back to text estimation (~4 Chinese chars/sec)
- **Audio path**: Remotion `staticFile()` expects `audio/<id>.mp3` relative to `video/public/`
- **Prompt cascade**: `~/.follow-builders/prompts/` overrides repo `prompts/` (exact filename match)
- **Reply filtering**: `fetch-feeds.js` skips tweets with `isReply: true`, keeps only original posts
- **Apify batching**: 20 handles split into groups of 5, each batch uses `from:x OR from:y` search syntax
- **Telegram chat_id**: Hardcoded as `"8361396438"` in `generate-video.js`
- **Graceful degradation**: Missing APIFY_TOKEN skips Twitter; TTS failure uses text estimation; empty feeds trigger early exit

## Skill Integration

This repo powers the `/ai-info` slash command. See `SKILL.md` for the full skill definition. The skill runs `prepare-digest.js`, then Claude Code summarizes the data in-session (using Max subscription tokens, zero API cost), and sends the briefing to Telegram.
