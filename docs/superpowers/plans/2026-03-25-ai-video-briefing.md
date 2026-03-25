# AI 视频简报系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-generate vertical short video briefings from AI builder data (tweets, podcasts, blogs) using Remotion + Edge TTS.

**Architecture:** `prepare-digest.js` (existing) fetches raw data → `generate-script.js` (new) transforms into video script via Claude API → Edge TTS generates audio per segment → Remotion renders React components into 1080x1920 MP4 with audio-driven timing.

**Tech Stack:** Remotion 4.x, Edge TTS (Python CLI), Claude API (Haiku), React/TypeScript, ffprobe, qrcode

**Spec:** `docs/superpowers/specs/2026-03-25-ai-video-briefing-design.md`

---

## File Map

| File | Responsibility |
|------|----------------|
| `scripts/generate-script.js` | Transform digest JSON → VideoScript (calls Claude API for summarization) |
| `scripts/generate-video.js` | Orchestration entry point: digest → script → TTS → render |
| `video/package.json` | Remotion project dependencies |
| `video/tsconfig.json` | TypeScript config |
| `video/remotion.config.ts` | Remotion configuration |
| `video/src/Root.tsx` | Remotion entry, register Composition |
| `video/src/types.ts` | Shared TypeScript interfaces (VideoScript, Segment) |
| `video/src/VideoComposition.tsx` | Main composition: sequence all scenes by audio duration |
| `video/src/components/Intro.tsx` | Opening title animation |
| `video/src/components/Overview.tsx` | Stats counter animation |
| `video/src/components/TweetCard.tsx` | Builder tweet card with avatar + text + QR |
| `video/src/components/PodcastCard.tsx` | Podcast episode card |
| `video/src/components/BlogCard.tsx` | Blog article card |
| `video/src/components/Outro.tsx` | Closing screen |
| `video/src/styles/theme.ts` | Colors, fonts, spacing constants |
| `video/src/utils/timing.ts` | Audio duration → frame count conversion |
| `video/public/fonts/` | Noto Sans SC font files |

---

## Task 1: Remotion 项目初始化

**Files:**
- Create: `video/package.json`
- Create: `video/tsconfig.json`
- Create: `video/remotion.config.ts`
- Create: `video/src/Root.tsx`
- Create: `video/src/types.ts`

- [ ] **Step 1: Initialize Remotion project**

```bash
cd /Users/xiaojuch/Claude/follow-builders
mkdir -p video/src video/public/fonts
cd video
npm init -y
npm install remotion @remotion/cli @remotion/renderer react react-dom
npm install -D typescript @types/react @types/react-dom
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create remotion.config.ts**

```typescript
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
```

- [ ] **Step 4: Create types.ts with shared interfaces**

```typescript
// video/src/types.ts
export interface VideoScript {
  date: string;
  stats: { builders: number; podcasts: number; blogs: number };
  segments: Segment[];
}

export interface Segment {
  id: string;
  type: "intro" | "overview" | "tweet" | "podcast" | "blog" | "outro";
  text: string;
  display: {
    title?: string;
    subtitle?: string;
    points?: string[];
    avatarUrl?: string;
    avatarFallback?: string;
    qrUrl?: string;
  };
}

export interface SegmentWithAudio extends Segment {
  audioFile: string;
  durationInSeconds: number;
  durationInFrames: number;
}

export interface CompositionProps {
  segments: SegmentWithAudio[];
  date: string;
}
```

- [ ] **Step 5: Create Root.tsx with placeholder Composition**

```tsx
// video/src/Root.tsx
import { Composition } from "remotion";
import { VideoComposition } from "./VideoComposition";
import type { CompositionProps } from "./types";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="VideoComposition"
      component={VideoComposition}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        segments: [],
        date: "2026-03-25",
      } satisfies CompositionProps}
    />
  );
};
```

- [ ] **Step 6: Verify Remotion project starts**

```bash
cd /Users/xiaojuch/Claude/follow-builders/video
npx remotion studio
```
Expected: Remotion Studio opens in browser with a blank composition.

- [ ] **Step 7: Commit**

```bash
git add video/
git commit -m "feat: initialize Remotion project with types and root composition"
```

---

## Task 2: 主题样式 & 中文字体

**Files:**
- Create: `video/src/styles/theme.ts`
- Download: `video/public/fonts/NotoSansSC-Variable.ttf`

- [ ] **Step 1: Download Noto Sans SC font**

```bash
cd /Users/xiaojuch/Claude/follow-builders/video/public/fonts
curl -L -o NotoSansSC-Variable.ttf "https://github.com/google/fonts/raw/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf"
```

Note: This is a variable font (.ttf) supporting all weights. If the URL changes, install via `npm install @fontsource/noto-sans-sc` or download from Google Fonts directly.

- [ ] **Step 2: Create theme.ts**

```typescript
// video/src/styles/theme.ts
export const theme = {
  colors: {
    bgPrimary: "#0a0a0f",
    bgSecondary: "#1a1a2e",
    accent: "#00d4ff",
    accentGreen: "#00ff88",
    text: "#ffffff",
    textSecondary: "#888888",
    cardBg: "rgba(255, 255, 255, 0.05)",
    cardBorder: "rgba(255, 255, 255, 0.1)",
  },
  fonts: {
    primary: "Noto Sans SC, sans-serif",
  },
  fontSize: {
    title: 56,
    subtitle: 40,
    body: 34,
    caption: 28,
    stat: 72,
  },
  spacing: {
    page: 60,
    card: 40,
    gap: 24,
  },
  video: {
    width: 1080,
    height: 1920,
    fps: 30,
  },
} as const;
```

- [ ] **Step 3: Verify font loads in Remotion**

Create a temporary test in Root.tsx that renders Chinese text. Check it displays correctly in Remotion Studio.

- [ ] **Step 4: Commit**

```bash
git add video/src/styles/ video/public/fonts/
git commit -m "feat: add theme constants and Noto Sans SC font"
```

---

## Task 3: Intro 组件（开场片头）

**Files:**
- Create: `video/src/components/Intro.tsx`
- Modify: `video/src/VideoComposition.tsx`

- [ ] **Step 1: Create Intro.tsx**

```tsx
// video/src/components/Intro.tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { theme } from "../styles/theme";

interface IntroProps {
  date: string;
}

export const Intro: React.FC<IntroProps> = ({ date }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleScale = spring({ frame, fps, config: { damping: 12 } });
  const subtitleOpacity = interpolate(frame, [15, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${theme.colors.bgPrimary} 0%, ${theme.colors.bgSecondary} 100%)`,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: theme.fonts.primary,
      }}
    >
      <div
        style={{
          transform: `scale(${titleScale})`,
          fontSize: theme.fontSize.title,
          fontWeight: 700,
          color: theme.colors.text,
          textAlign: "center",
        }}
      >
        AI Builder 日报
      </div>
      <div
        style={{
          opacity: subtitleOpacity,
          fontSize: theme.fontSize.subtitle,
          color: theme.colors.accent,
          marginTop: 20,
        }}
      >
        {date}
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Create initial VideoComposition.tsx**

```tsx
// video/src/VideoComposition.tsx
import { AbsoluteFill, Sequence } from "remotion";
import { Intro } from "./components/Intro";
import type { CompositionProps } from "./types";

export const VideoComposition: React.FC<CompositionProps> = ({ segments, date }) => {
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={90}>
        <Intro date={date} />
      </Sequence>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: Preview in Remotion Studio**

```bash
cd /Users/xiaojuch/Claude/follow-builders/video && npx remotion studio
```
Expected: See "AI Builder 日报" title with spring animation and date fade-in.

- [ ] **Step 4: Commit**

```bash
git add video/src/components/Intro.tsx video/src/VideoComposition.tsx
git commit -m "feat: add Intro component with title animation"
```

---

## Task 4: Overview 组件（今日概览）

**Files:**
- Create: `video/src/components/Overview.tsx`
- Modify: `video/src/VideoComposition.tsx`

- [ ] **Step 1: Create Overview.tsx**

```tsx
// video/src/components/Overview.tsx
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "../styles/theme";

interface OverviewProps {
  builders: number;
  podcasts: number;
  blogs: number;
}

const CountUp: React.FC<{ value: number; delay: number; label: string }> = ({
  value, delay, label,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 15 } });
  const displayValue = Math.round(progress * value);
  const opacity = interpolate(frame, [delay, delay + 5], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div style={{ textAlign: "center", opacity }}>
      <div style={{ fontSize: theme.fontSize.stat, fontWeight: 700, color: theme.colors.accent }}>
        {displayValue}
      </div>
      <div style={{ fontSize: theme.fontSize.caption, color: theme.colors.textSecondary, marginTop: 8 }}>
        {label}
      </div>
    </div>
  );
};

export const Overview: React.FC<OverviewProps> = ({ builders, podcasts, blogs }) => {
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${theme.colors.bgPrimary} 0%, ${theme.colors.bgSecondary} 100%)`,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: theme.fonts.primary,
        padding: theme.spacing.page,
      }}
    >
      <div style={{ fontSize: theme.fontSize.subtitle, color: theme.colors.text, marginBottom: 60 }}>
        今日追踪
      </div>
      <div style={{ display: "flex", gap: 80 }}>
        <CountUp value={builders} delay={0} label="位 Builder" />
        <CountUp value={podcasts} delay={10} label="期播客" />
        <CountUp value={blogs} delay={20} label="篇博客" />
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Add Overview to VideoComposition**

Add `<Sequence>` for Overview after Intro in `VideoComposition.tsx`.

- [ ] **Step 3: Preview and verify counter animations**

- [ ] **Step 4: Commit**

```bash
git add video/src/components/Overview.tsx video/src/VideoComposition.tsx
git commit -m "feat: add Overview component with count-up animations"
```

---

## Task 5: TweetCard 组件

**Files:**
- Create: `video/src/components/TweetCard.tsx`
- Install: `qrcode` package

- [ ] **Step 1: Install qrcode**

```bash
cd /Users/xiaojuch/Claude/follow-builders/video
npm install qrcode @types/qrcode
```

- [ ] **Step 2: Create TweetCard.tsx**

```tsx
// video/src/components/TweetCard.tsx
import { AbsoluteFill, useCurrentFrame, interpolate, Img } from "remotion";
import { theme } from "../styles/theme";

interface TweetCardProps {
  title: string;        // builder name + role
  subtitle: string;     // tweet summary
  avatarUrl?: string;
  avatarFallback?: string;
  qrUrl?: string;
}

const AvatarFallback: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      width: 80, height: 80, borderRadius: 40,
      background: theme.colors.accent, display: "flex",
      justifyContent: "center", alignItems: "center",
      fontSize: 36, fontWeight: 700, color: theme.colors.bgPrimary,
    }}
  >
    {text}
  </div>
);

export const TweetCard: React.FC<TweetCardProps> = ({
  title, subtitle, avatarUrl, avatarFallback, qrUrl,
}) => {
  const frame = useCurrentFrame();

  const slideIn = interpolate(frame, [0, 15], [-1080, 0], { extrapolateRight: "clamp" });
  const textOpacity = interpolate(frame, [10, 25], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${theme.colors.bgPrimary} 0%, ${theme.colors.bgSecondary} 100%)`,
        fontFamily: theme.fonts.primary,
        padding: theme.spacing.page,
        justifyContent: "center",
      }}
    >
      <div style={{ transform: `translateX(${slideIn}px)` }}>
        {/* Header: avatar + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 40 }}>
          {avatarUrl ? (
            <Img src={avatarUrl} style={{ width: 80, height: 80, borderRadius: 40 }} />
          ) : (
            <AvatarFallback text={avatarFallback || "?"} />
          )}
          <div style={{ fontSize: theme.fontSize.subtitle, fontWeight: 700, color: theme.colors.text }}>
            {title}
          </div>
        </div>

        {/* Tweet summary */}
        {/* Tweet summary */}
        <div
          style={{
            opacity: textOpacity,
            fontSize: theme.fontSize.body,
            color: theme.colors.text,
            lineHeight: 1.6,
            background: theme.colors.cardBg,
            border: `1px solid ${theme.colors.cardBorder}`,
            borderRadius: 20,
            padding: theme.spacing.card,
          }}
        >
          {subtitle}
        </div>

        {/* QR Code */}
        {qrUrl && (
          <div style={{ marginTop: 30, display: "flex", justifyContent: "center" }}>
            <QRCodeSVG value={qrUrl} size={120} bgColor="transparent" fgColor={theme.colors.textSecondary} />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 3: Preview with hardcoded test data**

- [ ] **Step 4: Commit**

```bash
git add video/src/components/TweetCard.tsx
git commit -m "feat: add TweetCard component with slide-in animation"
```

---

## Task 6: PodcastCard & BlogCard 组件

**Files:**
- Create: `video/src/components/PodcastCard.tsx`
- Create: `video/src/components/BlogCard.tsx`

- [ ] **Step 1: Create PodcastCard.tsx**

Similar layout to TweetCard but with:
- Podcast name as header
- Episode title as subtitle
- Bullet points for key insights (animated list, items fade in sequentially)
- Audio waveform decoration (simple CSS animated bars)

- [ ] **Step 2: Create BlogCard.tsx**

Similar layout with:
- Blog name + article title
- Summary text with fade-in animation

- [ ] **Step 3: Preview both components**

- [ ] **Step 4: Commit**

```bash
git add video/src/components/PodcastCard.tsx video/src/components/BlogCard.tsx
git commit -m "feat: add PodcastCard and BlogCard components"
```

---

## Task 7: Outro 组件（结尾）

**Files:**
- Create: `video/src/components/Outro.tsx`

- [ ] **Step 1: Create Outro.tsx**

```tsx
// video/src/components/Outro.tsx
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "../styles/theme";

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ frame, fps, config: { damping: 12 } });
  const subtitleOpacity = interpolate(frame, [20, 35], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${theme.colors.bgSecondary} 0%, ${theme.colors.bgPrimary} 100%)`,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: theme.fonts.primary,
      }}
    >
      <div style={{ transform: `scale(${scale})`, textAlign: "center" }}>
        <div style={{ fontSize: theme.fontSize.title, fontWeight: 700, color: theme.colors.text }}>
          AI Builder 日报
        </div>
        <div style={{ opacity: subtitleOpacity, fontSize: theme.fontSize.body, color: theme.colors.accent, marginTop: 24 }}>
          关注获取每日 AI 简报
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Preview**

- [ ] **Step 3: Commit**

```bash
git add video/src/components/Outro.tsx
git commit -m "feat: add Outro component"
```

---

## Task 8: VideoComposition 完整编排

**Files:**
- Modify: `video/src/VideoComposition.tsx`
- Modify: `video/src/Root.tsx`

- [ ] **Step 1: Update VideoComposition to sequence all segments**

```tsx
// video/src/VideoComposition.tsx
import { AbsoluteFill, Sequence, Audio, staticFile } from "remotion";
import { Intro } from "./components/Intro";
import { Overview } from "./components/Overview";
import { TweetCard } from "./components/TweetCard";
import { PodcastCard } from "./components/PodcastCard";
import { BlogCard } from "./components/BlogCard";
import { Outro } from "./components/Outro";
import type { CompositionProps, SegmentWithAudio } from "./types";

const renderSegment = (segment: SegmentWithAudio) => {
  switch (segment.type) {
    case "intro":
      return <Intro date={segment.display.title || ""} />;
    case "overview":
      return (
        <Overview
          builders={Number(segment.display.points?.[0]) || 0}
          podcasts={Number(segment.display.points?.[1]) || 0}
          blogs={Number(segment.display.points?.[2]) || 0}
        />
      );
    case "tweet":
      return (
        <TweetCard
          title={segment.display.title || ""}
          subtitle={segment.display.subtitle || ""}
          avatarUrl={segment.display.avatarUrl}
          avatarFallback={segment.display.avatarFallback}
          qrUrl={segment.display.qrUrl}
        />
      );
    case "podcast":
      return (
        <PodcastCard
          title={segment.display.title || ""}
          subtitle={segment.display.subtitle || ""}
          points={segment.display.points || []}
        />
      );
    case "blog":
      return (
        <BlogCard
          title={segment.display.title || ""}
          subtitle={segment.display.subtitle || ""}
        />
      );
    case "outro":
      return <Outro />;
    default:
      return null;
  }
};

export const VideoComposition: React.FC<CompositionProps> = ({ segments, date }) => {
  let currentFrame = 0;

  return (
    <AbsoluteFill>
      {segments.map((segment) => {
        const startFrame = currentFrame;
        currentFrame += segment.durationInFrames;
        return (
          <Sequence key={segment.id} from={startFrame} durationInFrames={segment.durationInFrames}>
            {segment.audioFile && (
              <Audio src={staticFile(segment.audioFile)} />
            )}
            {renderSegment(segment)}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Update Root.tsx to calculate total duration from props**

The `durationInFrames` in `<Composition>` needs to be dynamically calculated. Use `calculateMetadata` callback to compute total frames from segments.

- [ ] **Step 3: Preview with mock data**

Create a test script that generates mock `CompositionProps` and verify full video plays in Remotion Studio.

- [ ] **Step 4: Commit**

```bash
git add video/src/VideoComposition.tsx video/src/Root.tsx
git commit -m "feat: wire up full VideoComposition with segment sequencing and audio"
```

---

## Task 9: Edge TTS 安装 & timing 工具

**Files:**
- Create: `video/src/utils/timing.ts`

Note: TTS generation with retry logic lives in `generate-video.js` (Task 11) to avoid dead code. The `timing.ts` utility is used by Remotion for frame calculations.

- [ ] **Step 1: Install edge-tts Python package**

```bash
pip install edge-tts
# Verify:
edge-tts --text "测试语音" --voice zh-CN-YunxiNeural --write-media /tmp/test.mp3
# Play /tmp/test.mp3 to verify Chinese male voice quality
```

- [ ] **Step 2: Create timing.ts**

```typescript
// video/src/utils/timing.ts
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const FPS = 30;

export async function getAudioDuration(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "quiet",
    "-show_entries", "format=duration",
    "-of", "csv=p=0",
    filePath,
  ]);
  return parseFloat(stdout.trim());
}

export function secondsToFrames(seconds: number): number {
  return Math.ceil(seconds * FPS);
}

export function estimateDurationFromText(text: string): number {
  // Chinese: ~4 characters per second
  const charCount = text.replace(/[a-zA-Z\s]/g, "").length;
  const wordCount = (text.match(/[a-zA-Z]+/g) || []).length;
  return charCount / 4 + wordCount / 2.5;
}
```

- [ ] **Step 3: Test edge-tts CLI works**

```bash
edge-tts --text "今日追踪十位 AI builder 的最新动态" --voice zh-CN-YunxiNeural --write-media /tmp/test-cn.mp3
ffprobe -v quiet -show_entries format=duration -of csv=p=0 /tmp/test-cn.mp3
```
Expected: Audio file generated, duration printed (should be ~3-4 seconds).

- [ ] **Step 4: Commit**

```bash
git add video/src/utils/
git commit -m "feat: add timing utility for audio-to-frame conversion"
```

---

## Task 10: generate-script.js（数据 → 视频脚本）

**Files:**
- Create: `scripts/generate-script.js`

- [ ] **Step 1: Create generate-script.js**

This script:
1. Reads `prepare-digest.js` output (piped or from file)
2. Calls Claude API (Haiku) with the prompt templates to generate segment narration text
3. Extracts display metadata (avatar URLs, titles, etc.)
4. Applies duration budget (300s max)
5. Outputs `VideoScript` JSON

```javascript
// scripts/generate-script.js
import Anthropic from "@anthropic-ai/sdk";

const MAX_DURATION_SECONDS = 300;
const CHARS_PER_SECOND = 4;

function estimateDuration(text) {
  const cnChars = text.replace(/[a-zA-Z\s\d]/g, "").length;
  const enWords = (text.match(/[a-zA-Z]+/g) || []).length;
  return cnChars / CHARS_PER_SECOND + enWords / 2.5;
}

async function generateNarration(client, systemPrompt, content) {
  const resp = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: systemPrompt + "\n\n输出要求：生成简洁的中文播报文案，适合语音朗读，每段不超过100字。",
    messages: [{ role: "user", content }],
  });
  return resp.content[0].text;
}

async function main() {
  // Read digest JSON from stdin
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const digest = JSON.parse(Buffer.concat(chunks).toString());

  const client = new Anthropic();
  const segments = [];

  // Intro
  segments.push({
    id: "intro",
    type: "intro",
    text: `AI Builder 日报，${digest.generatedAt?.split("T")[0] || new Date().toISOString().split("T")[0]}`,
    display: { title: digest.generatedAt?.split("T")[0] || new Date().toISOString().split("T")[0] },
  });

  // Overview
  segments.push({
    id: "overview",
    type: "overview",
    text: `今日追踪 ${digest.stats.xBuilders} 位 builder 动态，${digest.stats.podcastEpisodes} 期播客，${digest.stats.blogPosts} 篇博客。`,
    display: {
      points: [
        String(digest.stats.xBuilders),
        String(digest.stats.podcastEpisodes),
        String(digest.stats.blogPosts),
      ],
    },
  });

  // Tweets — generate narration via Claude API
  if (digest.x?.length > 0) {
    for (const builder of digest.x) {
      if (!builder.tweets?.length) continue;
      const tweetText = builder.tweets.map((t) => `${t.text} (${t.url})`).join("\n");
      const narration = await generateNarration(
        client,
        digest.prompts.summarize_tweets,
        `Builder: ${builder.name}\nBio: ${builder.bio || ""}\n\nTweets:\n${tweetText}`
      );
      segments.push({
        id: `tweet-${builder.name.toLowerCase().replace(/\s+/g, "-")}`,
        type: "tweet",
        text: narration,
        display: {
          title: `${builder.name}${builder.bio ? ` — ${builder.bio.slice(0, 40)}` : ""}`,
          subtitle: narration,
          avatarUrl: builder.avatar || undefined,
          avatarFallback: builder.name.charAt(0).toUpperCase(),
          qrUrl: builder.tweets[0]?.url,
        },
      });
    }
  }

  // Podcasts
  if (digest.podcasts?.length > 0) {
    for (const podcast of digest.podcasts) {
      const narration = await generateNarration(
        client,
        digest.prompts.summarize_podcast,
        `Podcast: ${podcast.name}\nTitle: ${podcast.title}\nTranscript/Description: ${(podcast.transcript || podcast.description || "").slice(0, 3000)}`
      );
      segments.push({
        id: `podcast-${podcast.name.toLowerCase().replace(/\s+/g, "-")}`,
        type: "podcast",
        text: narration,
        display: {
          title: podcast.name,
          subtitle: podcast.title,
          points: narration.split("\n").filter(Boolean).slice(0, 4),
        },
      });
    }
  }

  // Blogs
  if (digest.blogs?.length > 0) {
    for (const blog of digest.blogs) {
      const narration = await generateNarration(
        client,
        digest.prompts.summarize_blogs,
        `Blog: ${blog.source || "Anthropic"}\nTitle: ${blog.title}\nContent: ${(blog.content || blog.summary || "").slice(0, 3000)}`
      );
      segments.push({
        id: `blog-${blog.title?.toLowerCase().replace(/\s+/g, "-").slice(0, 30) || "post"}`,
        type: "blog",
        text: narration,
        display: {
          title: blog.title,
          subtitle: narration,
        },
      });
    }
  }

  // Outro
  segments.push({
    id: "outro",
    type: "outro",
    text: "感谢收看今日 AI Builder 日报，关注获取每日简报。",
    display: {},
  });

  // Validate digest has required prompts
  if (!digest.prompts?.summarize_tweets || !digest.prompts?.summarize_podcast || !digest.prompts?.summarize_blogs) {
    throw new Error("Digest missing required prompt templates (summarize_tweets, summarize_podcast, summarize_blogs)");
  }

  // Duration budget enforcement (immutable, 3-step cascade per spec)
  const getTotalDuration = (segs) => segs.reduce((sum, s) => sum + estimateDuration(s.text), 0);
  let trimmedSegments = [...segments];

  // Step 1: Remove low-engagement tweets (last ones first, already sorted by data order)
  while (getTotalDuration(trimmedSegments) > MAX_DURATION_SECONDS) {
    const tweetSegments = trimmedSegments.filter((s) => s.type === "tweet");
    if (tweetSegments.length <= 3) break; // keep at least 3 tweets
    const lastTweetId = tweetSegments[tweetSegments.length - 1].id;
    trimmedSegments = trimmedSegments.filter((s) => s.id !== lastTweetId);
  }

  // Step 2: Reduce podcasts to 1
  if (getTotalDuration(trimmedSegments) > MAX_DURATION_SECONDS) {
    const podcastSegs = trimmedSegments.filter((s) => s.type === "podcast");
    if (podcastSegs.length > 1) {
      const keepId = podcastSegs[0].id;
      trimmedSegments = trimmedSegments.filter((s) => s.type !== "podcast" || s.id === keepId);
    }
  }

  // Step 3: Shorten segment text (truncate to ~80 chars for tweets)
  if (getTotalDuration(trimmedSegments) > MAX_DURATION_SECONDS) {
    trimmedSegments = trimmedSegments.map((s) => {
      if (s.type === "tweet" && s.text.length > 80) {
        return { ...s, text: s.text.slice(0, 80) + "。", display: { ...s.display, subtitle: s.text.slice(0, 80) + "。" } };
      }
      return s;
    });
  }

  const script = {
    date: digest.generatedAt?.split("T")[0] || new Date().toISOString().split("T")[0],
    stats: {
      builders: segments.filter((s) => s.type === "tweet").length,
      podcasts: segments.filter((s) => s.type === "podcast").length,
      blogs: segments.filter((s) => s.type === "blog").length,
    },
    segments: trimmedSegments,
  };

  console.log(JSON.stringify(script, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});
```

- [ ] **Step 2: Install Anthropic SDK**

```bash
cd /Users/xiaojuch/Claude/follow-builders/scripts
npm install @anthropic-ai/sdk
```

- [ ] **Step 3: Test the pipeline**

```bash
cd /Users/xiaojuch/Claude/follow-builders/scripts
node prepare-digest.js 2>/dev/null | node generate-script.js
```
Expected: JSON output with segments array containing intro, tweets, podcasts, blogs, outro.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-script.js scripts/package.json scripts/package-lock.json
git commit -m "feat: add generate-script.js for digest-to-video-script transformation"
```

---

## Task 11: generate-video.js（主流程编排）

**Files:**
- Create: `scripts/generate-video.js`

- [ ] **Step 1: Create generate-video.js**

This is the one-click entry point that orchestrates:
1. Run `prepare-digest.js` → digest JSON
2. Pipe to `generate-script.js` → video script JSON
3. Run TTS for each segment → audio files
4. Run Remotion render → MP4

```javascript
// scripts/generate-video.js
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, mkdir, rm } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUTPUT = join(ROOT, "output");
const AUDIO_DIR = join(OUTPUT, "audio");
const VIDEO_DIR = join(OUTPUT, "video");

async function run() {
  console.log("=== AI Video Briefing Generator ===\n");

  // Ensure output dirs
  for (const dir of [AUDIO_DIR, VIDEO_DIR]) {
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  }

  // Step 1: Fetch digest
  console.log("1/4 Fetching digest data...");
  const { stdout: digestJSON } = await execFileAsync("node", ["prepare-digest.js"], { cwd: join(ROOT, "scripts") });
  const digest = JSON.parse(digestJSON);
  if (digest.stats.xBuilders === 0 && digest.stats.podcastEpisodes === 0 && digest.stats.blogPosts === 0) {
    console.log("No new content today. Exiting.");
    return;
  }

  // Step 2: Generate video script
  console.log("2/4 Generating video script via Claude API...");
  const scriptProc = spawn("node", ["generate-script.js"], { cwd: join(ROOT, "scripts") });
  scriptProc.stdin.write(digestJSON);
  scriptProc.stdin.end();

  const scriptChunks = [];
  for await (const chunk of scriptProc.stdout) scriptChunks.push(chunk);
  const videoScript = JSON.parse(Buffer.concat(scriptChunks).toString());

  const scriptPath = join(OUTPUT, "script.json");
  await writeFile(scriptPath, JSON.stringify(videoScript, null, 2));
  console.log(`   Script: ${videoScript.segments.length} segments`);

  // Step 3: Generate TTS audio
  console.log("3/4 Generating TTS audio...");
  for (const seg of videoScript.segments) {
    const audioPath = join(AUDIO_DIR, `${seg.id}.mp3`);
    console.log(`   TTS: ${seg.id}`);

    let success = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await execFileAsync("edge-tts", [
          "--text", seg.text,
          "--voice", "zh-CN-YunxiNeural",
          "--write-media", audioPath,
        ]);
        success = true;
        break;
      } catch {
        if (attempt < 2) await new Promise((r) => setTimeout(r, (attempt + 1) * 1000));
      }
    }

    if (success) {
      // Get duration via ffprobe
      const { stdout: dur } = await execFileAsync("ffprobe", [
        "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", audioPath,
      ]);
      seg.durationInSeconds = parseFloat(dur.trim());
      seg.durationInFrames = Math.ceil(seg.durationInSeconds * 30);
      seg.audioFile = `audio/${seg.id}.mp3`;
    } else {
      console.warn(`   WARN: TTS failed for ${seg.id}, using estimated duration`);
      const cnChars = seg.text.replace(/[a-zA-Z\s\d]/g, "").length;
      seg.durationInSeconds = cnChars / 4 + 2;
      seg.durationInFrames = Math.ceil(seg.durationInSeconds * 30);
      seg.audioFile = "";
    }
  }

  // Write enriched script with audio info
  const enrichedPath = join(OUTPUT, "script-with-audio.json");
  await writeFile(enrichedPath, JSON.stringify(videoScript, null, 2));

  // Copy audio files to video/public for Remotion staticFile access
  const videoPublicAudio = join(ROOT, "video", "public", "audio");
  if (!existsSync(videoPublicAudio)) await mkdir(videoPublicAudio, { recursive: true });
  for (const seg of videoScript.segments) {
    if (seg.audioFile) {
      const src = join(AUDIO_DIR, `${seg.id}.mp3`);
      const dest = join(videoPublicAudio, `${seg.id}.mp3`);
      await writeFile(dest, await readFile(src));
    }
  }

  // Step 4: Render video
  console.log("4/4 Rendering video with Remotion...");
  const totalFrames = videoScript.segments.reduce((sum, s) => sum + s.durationInFrames, 0);
  const outputFile = join(VIDEO_DIR, `ai-briefing-${videoScript.date}.mp4`);

  // Write props file for Remotion
  const propsPath = join(OUTPUT, "remotion-props.json");
  await writeFile(propsPath, JSON.stringify({
    segments: videoScript.segments,
    date: videoScript.date,
  }));

  await execFileAsync("npx", [
    "remotion", "render",
    "VideoComposition",
    outputFile,
    "--props", propsPath,
  ], {
    cwd: join(ROOT, "video"),
    timeout: 600000, // 10 min max
  });

  console.log(`\n=== Done! ===`);
  console.log(`Video: ${outputFile}`);
  console.log(`Duration: ${(totalFrames / 30).toFixed(1)}s`);
  console.log(`Segments: ${videoScript.stats.builders} tweets, ${videoScript.stats.podcasts} podcasts, ${videoScript.stats.blogs} blogs`);
}

run().catch(async (err) => {
  console.error(`\nERROR: ${err.message}`);
  // Cleanup partial audio files on failure
  try {
    if (existsSync(AUDIO_DIR)) await rm(AUDIO_DIR, { recursive: true });
    console.log("Cleaned up partial audio files.");
  } catch {}
  process.exit(1);
});
```

- [ ] **Step 2: Test the full pipeline end-to-end**

```bash
cd /Users/xiaojuch/Claude/follow-builders
node scripts/generate-video.js
```
Expected: MP4 file generated in `output/video/`.

- [ ] **Step 3: Watch the generated video and verify**

- Quality: Chinese voice is clear
- Timing: audio and visuals are in sync
- Content: all segments present, text readable
- Duration: within 3-5 minutes

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-video.js output/.gitkeep
git commit -m "feat: add generate-video.js orchestration script for one-click video generation"
```

---

## Task 12: Telegram 发送集成

**Files:**
- Modify: `scripts/generate-video.js`

- [ ] **Step 1: Add Telegram upload to generate-video.js**

After rendering, optionally send the video to Telegram using the existing MCP plugin. Add a `--send` flag:

```bash
node scripts/generate-video.js --send
```

When `--send` is present, use the Telegram MCP `reply` tool with the `files` parameter to send the MP4.

For automation outside Claude Code, add a simple Telegram Bot API upload:

```javascript
async function sendToTelegram(videoPath, chatId) {
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("video", new Blob([await readFile(videoPath)]), "ai-briefing.mp4");
  form.append("caption", `AI Builder 日报 · ${new Date().toISOString().split("T")[0]}`);

  const resp = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendVideo`, {
    method: "POST",
    body: form,
  });
  if (!resp.ok) throw new Error(`Telegram upload failed: ${resp.status}`);
  console.log("Video sent to Telegram!");
}
```

- [ ] **Step 2: Test sending**

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-video.js
git commit -m "feat: add Telegram video upload support"
```

---

## Task 13: .gitignore & 清理

**Files:**
- Create/Modify: `.gitignore`
- Create: `output/.gitkeep`

- [ ] **Step 1: Update .gitignore**

```
# Generated output
output/audio/
output/video/
output/script*.json
output/remotion-props.json

# Video public audio (copied at build time)
video/public/audio/

# Dependencies
node_modules/

# OS
.DS_Store
```

- [ ] **Step 2: Add .gitkeep to output dir**

```bash
touch /Users/xiaojuch/Claude/follow-builders/output/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore output/.gitkeep
git commit -m "chore: add .gitignore for generated files"
```

---

## Execution Order & Dependencies

```
Task 1 (Remotion init) ──┐
Task 2 (Theme + fonts) ──┤
                          ├── Task 3 (Intro) ──┐
                          ├── Task 4 (Overview)─┤
                          ├── Task 5 (TweetCard)┤
                          ├── Task 6 (Podcast/Blog)┤
                          ├── Task 7 (Outro) ───┤
                          │                     │
                          │                     ├── Task 8 (VideoComposition)
                          │                     │
Task 9 (TTS utils) ──────┤                     │
Task 10 (generate-script)┤                     │
                          │                     │
                          └─────────────────────┴── Task 11 (generate-video.js)
                                                        │
                                                    Task 12 (Telegram)
                                                        │
                                                    Task 13 (.gitignore)
```

**Parallelizable:** Tasks 3-7 can run in parallel (independent components). Tasks 9-10 can run in parallel with Tasks 3-7.
