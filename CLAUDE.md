# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An AI builder digest system that aggregates feeds from 20 AI builders (X/Twitter), 5 podcasts, and Anthropic blogs, then generates either a Chinese text briefing (via `/ai-info` skill) or a vertical short video briefing with TTS narration (via Remotion). Delivers to Telegram.

## Commands

```bash
# Install dependencies (both directories)
cd scripts && npm install && cd ../video && npm install

# Fetch latest feed data (manual trigger, zero cost)
node scripts/fetch-feeds.js

# Generate video from local or remote data
node scripts/generate-video.js

# Generate video + send to Telegram
TELEGRAM_BOT_TOKEN=xxx node scripts/generate-video.js --send

# Preview video in Remotion Studio
cd video && npx remotion studio src/index.ts

# Run pipeline steps individually
node scripts/prepare-digest.js                                    # load feeds → JSON
node scripts/prepare-digest.js | node scripts/generate-script.js  # → video script JSON
```

## Required Environment

- `ffprobe` — system dependency (`brew install ffmpeg`)
- `edge-tts` — Python package (`pip install edge-tts`), path: `/Library/Frameworks/Python.framework/Versions/3.13/bin/edge-tts`
- `TELEGRAM_BOT_TOKEN` — optional, only for `--send` flag
- No API keys needed — all scripts are template-based with zero external API costs

## Architecture

Two main workflows share the same data layer:

**Text briefing:** `/ai-info` skill → `prepare-digest.js` → Claude Code generates Chinese summary in-session → Telegram

**Video briefing:** `prepare-digest.js` → `generate-script.js` → `generate-video.js` (TTS + Remotion) → MP4

### Scripts

- **scripts/fetch-feeds.js** — Self-hosted data collection. Fetches Twitter/X via RSSHub public instances, podcasts and blogs via standard RSS. Saves to `data/` directory. Manual trigger, no API keys. Note: RSSHub Twitter routes are unreliable due to X restrictions.
- **scripts/prepare-digest.js** — Loads feeds (local `data/` first, falls back to remote GitHub URLs) + prompt templates from `prompts/`. Outputs merged digest JSON.
- **scripts/generate-script.js** — Reads digest from stdin, generates Chinese narration via templates (no API), applies 300s duration budget (3-step cascade: trim tweets → reduce podcasts → truncate text), outputs VideoScript JSON.
- **scripts/generate-video.js** — Orchestrator: digest → script → Edge TTS audio per segment (`zh-CN-YunxiNeural`) → copies audio to `video/public/audio/` → Remotion render → 1080x1920 MP4.

### Data flow

```
fetch-feeds.js → data/*.json (local, optional)
                      ↓
prepare-digest.js (local data/ or remote GitHub fallback)
                      ↓
generate-script.js (template narration + duration budget)
                      ↓
generate-video.js (TTS → Remotion render → MP4)
```

### Video project

`video/` is a Remotion React/TypeScript project. Entry: `src/index.ts` → `Root.tsx` → `VideoComposition.tsx` which maps segment types to components (Intro, Overview, TweetCard, PodcastCard, BlogCard, Outro) via `<Sequence>` with audio-driven timing. Audio files must be in `video/public/audio/` for Remotion's `staticFile()`.

## Key Design Decisions

- **Local-first data**: `prepare-digest.js` reads `data/` first, remote GitHub as fallback
- **Audio-driven timeline**: Frame count = `Math.ceil(audioDuration * 30)`. No hardcoded durations.
- **Duration budget**: 300s hard cap enforced immutably — filter/map, never splice/mutate
- **TTS retry**: 3 attempts with exponential backoff (1s/2s/4s), falls back to text estimation (~4 Chinese chars/sec)
- **Audio path**: Remotion `staticFile()` expects `audio/<id>.mp3` relative to `video/public/`
- **Prompt cascade**: User overrides in `~/.follow-builders/prompts/` take precedence over repo `prompts/`

## Skill Integration

This repo powers the `/ai-info` slash command. See `SKILL.md` for the full skill definition. The skill runs `prepare-digest.js`, then Claude Code summarizes the data in-session (using Max subscription tokens, zero API cost), and sends the briefing to Telegram.
