# AI 视频简报系统设计文档

## 概述

将现有 ai-info 系统的文字简报数据（25 个 AI builder 推文、5 个播客、Anthropic 博客）自动生成为竖屏短视频简报，以中文男声播报，支持多平台发布。

## 需求

- **格式**：图文配音视频（文字/图片动画 + AI 语音旁白）
- **时长**：3-5 分钟
- **语音**：中文男声，专业新闻播报风格
- **画面**：竖屏 1080x1920（9:16），社交媒体风格 — 大字、快节奏、深色背景 + 亮色高亮
- **发布**：多平台（Telegram、YouTube/B站、视频号、抖音等）
- **自动化**：一键命令从数据到视频

## 架构

```
ai-info 数据 (JSON)
    ↓
① generate-script.js — JSON → 视频脚本（分段文案 + 元数据）
    ↓
② TTS (Edge TTS) — 每段文案 → 音频文件（.mp3）
    ↓
③ Remotion 渲染 — React 组件 + 音频 → 竖屏动画视频
    ↓
④ 输出 MP4 → 多平台分发
```

**音频驱动时间轴**：每段画面时长由对应音频长度决定，保证音画同步。

### 错误处理

- **TTS 失败**：每段最多重试 3 次（指数退避：1s/2s/4s）。单段失败时跳过该段继续，最终视频标注"部分内容缺失"。全部失败时中止并报错。
- **数据获取失败**：`prepare-digest.js` 失败时中止流程，提示检查网络。
- **渲染失败**：Remotion 渲染出错时保留已生成的音频文件，支持重新渲染。
- **清理**：失败时自动清理 `output/audio/` 中的残留文件。

## 视频分镜结构

### 1. 开场片头（2-3 秒）
- 标题动画："AI Builder 日报 · YYYY.MM.DD"
- 暗色渐变背景 + 科技感粒子/线条动效

### 2. 今日概览（3-5 秒）
- 统计数字："今日追踪 N 位 builder 动态，N 期播客，N 篇博客"
- 数字翻牌动画

### 3. 推文板块（主体，每条 15-20 秒）
- 每位 builder 一张卡片：
  - 头像 + 名字 + 身份标签（从 bio 提取）
  - 推文摘要大字逐行淡入
  - 底部原文链接 QR 码
- 卡片之间滑动切换转场

### 4. 播客板块（每期 20-30 秒）
- 播客封面 + 节目名 + 本期标题
- 要点用列表动画呈现
- 音频波形装饰元素

### 5. 博客板块（每篇 15-20 秒）
- 文章标题 + 作者
- 核心要点摘要动画

### 6. 结尾（3-5 秒）
- "关注获取每日 AI 简报"
- 社交媒体二维码

## 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| 视频渲染 | Remotion | React 编程式视频，完全可控，支持模板复用 |
| TTS | Edge TTS (`zh-CN-YunxiNeural`) | 免费、高质量中文男声、播报风格 |
| 音频分析 | ffprobe | 获取音频时长用于时间轴计算 |
| 字体 | Noto Sans SC / HarmonyOS Sans | 免费中文字体，清晰可读 |
| QR 码 | `qrcode` npm 包 | 在 Remotion 渲染时动态生成 SVG QR 码 |
| 输出 | MP4 (H.264) | 全平台兼容 |

### TTS 升级路径
当前使用免费 Edge TTS，后期可无缝替换为 ElevenLabs 获得更自然的语音效果。

### generate-script.js 内部逻辑
此脚本调用 Claude API（Haiku 模型，低成本）将原始 feed 数据转换为视频脚本：
1. 读取 `prepare-digest.js` 输出的 JSON
2. 使用 `prompts/` 目录下的模板构造 prompt
3. 调用 Claude API 生成每个 segment 的中文播报文案
4. 从 feed 数据提取 `avatarUrl`（X/Twitter 头像）、播客封面等元数据
5. 头像无法获取时使用姓名首字母作为 fallback
6. 应用时长预算算法裁剪内容
7. 输出 `VideoScript` JSON

### 字体许可
- Noto Sans SC：Apache 2.0，可自由用于视频发布
- HarmonyOS Sans：免费商用许可，允许视频分发

### 依赖清单
```
remotion: ^4.x
@remotion/cli: ^4.x
@remotion/renderer: ^4.x
edge-tts: (Python CLI，通过 child_process 调用)
qrcode: ^1.x
ffprobe: 系统依赖（brew install ffmpeg）
@anthropic-ai/sdk: ^0.x (generate-script.js 用)
```

## 项目结构

```
follow-builders/
├── scripts/
│   ├── prepare-digest.js         # 已有：获取原始数据
│   ├── generate-script.js        # 新增：JSON → 视频脚本
│   └── generate-video.js         # 新增：主流程编排入口
├── video/
│   ├── package.json              # Remotion + 依赖
│   ├── tsconfig.json
│   ├── remotion.config.ts
│   ├── src/
│   │   ├── Root.tsx              # Remotion 入口，注册 Composition
│   │   ├── VideoComposition.tsx  # 总合成：编排所有场景
│   │   ├── components/
│   │   │   ├── Intro.tsx         # 开场片头
│   │   │   ├── Overview.tsx      # 今日概览
│   │   │   ├── TweetCard.tsx     # 推文卡片
│   │   │   ├── PodcastCard.tsx   # 播客卡片
│   │   │   ├── BlogCard.tsx      # 博客卡片
│   │   │   └── Outro.tsx         # 结尾
│   │   ├── styles/
│   │   │   └── theme.ts          # 颜色、字体、间距常量
│   │   └── utils/
│   │       ├── tts.ts            # Edge TTS 封装
│   │       └── timing.ts         # 音频时长 → 帧数计算
│   └── public/
│       └── fonts/                # 中文字体文件
├── output/                       # 生成的视频 & 音频文件
└── prompts/                      # 已有：摘要 prompt 模板
```

## 数据流

### 输入：视频脚本格式

`generate-script.js` 输出的脚本结构：

```typescript
interface VideoScript {
  date: string;
  stats: { builders: number; podcasts: number; blogs: number };
  segments: Segment[];
}

interface Segment {
  id: string;          // 唯一标识，如 'tweet-karpathy', 'podcast-latent-space-42'
  type: 'intro' | 'overview' | 'tweet' | 'podcast' | 'blog' | 'outro';
  text: string;        // TTS 播报文案
  display: {           // 画面显示内容
    title?: string;
    subtitle?: string;
    points?: string[];
    avatarUrl?: string;   // X/Twitter 头像 URL（从 feed 数据获取）
    avatarFallback?: string; // 无头像时的首字母占位符
    qrUrl?: string;
  };
}
```

### 处理流程

1. `prepare-digest.js` → 原始 JSON（推文/播客/博客数据）
2. `generate-script.js` → 调用 Claude API 将 JSON 按 ai-info 的 prompt 规则整理成视频脚本（LLM 摘要生成）
3. TTS → 每个 segment 生成 `output/audio/segment-{i}.mp3`
4. ffprobe → 读取每段音频时长
5. Remotion → 根据音频时长计算帧数，渲染视频
6. 输出 → `output/video/ai-briefing-YYYY-MM-DD.mp4`

## 画面风格规范

- **分辨率**：1080 x 1920（9:16 竖屏）
- **帧率**：30fps
- **背景**：深色渐变（#0a0a0f → #1a1a2e）
- **主色**：亮蓝 #00d4ff，亮绿 #00ff88
- **文字**：白色 #ffffff，次要 #888888
- **标题字号**：48-56px
- **正文字号**：32-36px
- **每屏停留**：最长 20 秒
- **转场**：滑动 + 淡入淡出，200-300ms

## 运行命令

```bash
# 一键生成视频
node scripts/generate-video.js

# 预览（Remotion Studio）
cd video && npx remotion studio

# 仅渲染（跳过数据获取，使用缓存脚本）
cd video && npx remotion render VideoComposition output/video/latest.mp4
```

## 时长预算 & 智能裁剪

**总时长硬上限：300 秒（5 分钟）**

固定段落预算：
- 开场片头：3 秒
- 今日概览：5 秒
- 结尾：5 秒
- 固定合计：13 秒

可变段落预算：287 秒，分配规则：
- 推文板块：占 60%（~172 秒），每条约 17 秒 → 最多 10 条
- 播客板块：占 25%（~72 秒），每期约 25 秒 → 最多 2 期
- 博客板块：占 15%（~43 秒），每篇约 18 秒 → 最多 2 篇

**裁剪算法**（在 `generate-script.js` 中实现）：
1. 生成所有 segment 的 TTS 文案
2. 估算每段时长（中文约 4 字/秒）
3. 累加总时长，若超过 300 秒：
   - 先减少推文数（按互动量排序，移除末尾）
   - 再缩短播客到 1 期
   - 最后缩减每段文案长度
4. TTS 生成后用 ffprobe 验证实际时长，若仍超限则移除最后一条推文

## 多平台输出

单次渲染生成 9:16 竖屏 MP4，适用于：
- **Telegram**：直接通过 MCP 发送
- **抖音/视频号**：原生竖屏格式
- **YouTube Shorts**：竖屏 ≤60s 片段（可选裁剪版）
- **B站**：竖屏投稿

后期可扩展：横屏 16:9 版本用于 YouTube 长视频。
