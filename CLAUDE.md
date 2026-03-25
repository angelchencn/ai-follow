# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An AI builder digest system that aggregates feeds from 25 AI builders (X/Twitter), 5 podcasts, and Anthropic blogs, then generates a vertical short video briefing with Chinese AI narration. Delivers to Telegram and other platforms.

## Commands

```bash
# Install dependencies (both directories)
cd scripts && npm install && cd ../video && npm install

# One-click video generation
node scripts/generate-video.js

# Generate + send to Telegram
TELEGRAM_BOT_TOKEN=xxx node scripts/generate-video.js --send

# Preview in Remotion Studio
cd video && npx remotion studio src/index.ts

# Verify Remotion compositions
cd video && npx remotion compositions src/index.ts

# Run pipeline steps individually
node scripts/prepare-digest.js                              # fetch feeds → JSON
node scripts/prepare-digest.js | node scripts/generate-script.js  # → video script JSON
```

## Required Environment

- `ANTHROPIC_API_KEY` — used by generate-script.js (Claude Haiku for narration)
- `TELEGRAM_BOT_TOKEN` — optional, for --send flag
- `ffprobe` — system dependency (`brew install ffmpeg`)
- `edge-tts` — Python package (`pip install edge-tts`), installed at `/Library/Frameworks/Python.framework/Versions/3.13/bin/edge-tts`

## Architecture

**Pipeline:** `prepare-digest.js` → `generate-script.js` → `generate-video.js` (TTS + Remotion render) → MP4

- **scripts/prepare-digest.js** — Fetches feed JSON from GitHub + loads prompt templates from `prompts/`. Outputs merged digest JSON with `x`, `podcasts`, `blogs`, `stats`, `prompts` fields.
- **scripts/generate-script.js** — Reads digest from stdin, calls Claude API (Haiku) per builder/podcast/blog to generate Chinese narration, applies 300-second duration budget (3-step cascade: trim tweets → reduce podcasts → truncate text), outputs VideoScript JSON.
- **scripts/generate-video.js** — Orchestrator: runs digest→script pipeline, generates TTS audio per segment via edge-tts (`zh-CN-YunxiNeural`), copies audio to `video/public/audio/`, writes Remotion props, renders 1080x1920 MP4.
- **video/** — Remotion project (React/TypeScript). Entry: `src/index.ts` → `Root.tsx` → `VideoComposition.tsx` which maps segment types to components (Intro, Overview, TweetCard, PodcastCard, BlogCard, Outro) via `<Sequence>` with audio-driven timing.

## Key Design Decisions

- **Audio-driven timeline**: Each segment's frame count = `Math.ceil(audioDuration * 30)`. No hardcoded durations.
- **Duration budget**: 300s hard cap enforced immutably in generate-script.js — filter/map, never splice/mutate.
- **TTS retry**: 3 attempts with exponential backoff (1s/2s/4s). Falls back to text-based duration estimation (~4 Chinese chars/sec).
- **Theme**: Dark gradient (#0a0a0f → #1a1a2e), cyan accent (#00d4ff), Noto Sans SC font. All in `video/src/styles/theme.ts`.
- **Prompt cascade**: User overrides in `~/.follow-builders/prompts/` take precedence over repo `prompts/`.

## Skill Integration

This repo powers the `/ai-info` slash command. See `SKILL.md` for the full skill definition and `.claude/commands/ai-info.md` for the command hook.
