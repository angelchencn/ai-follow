# AI Follow - AI Builder 视频简报

自动聚合 AI 领域顶级 builder 的动态，生成竖屏短视频简报。

## 功能

- 追踪 **20 位 AI builder** 的 X/Twitter 动态（via Apify）
- 聚合 **5 个顶级 AI 播客**（via RSS）
- 整合 **Anthropic/Claude 官方博客**（via 社区 RSS）
- 用 Claude AI 生成中文播报文案
- Edge TTS 中文男声语音合成
- Remotion 渲染 1080x1920 竖屏动画视频
- 一键生成 MP4，支持发送到 Telegram

## 效果预览

竖屏社交媒体风格：深色背景 + 亮色高亮 + 大字体 + 快节奏切换，3-5 分钟一期。

## 快速开始

### 环境要求

- Node.js 18+
- Python 3.x
- ffmpeg（含 ffprobe）

### 安装

```bash
git clone https://github.com/angelchencn/ai-follow.git
cd ai-follow

# 安装 Node 依赖
cd scripts && npm install && cd ../video && npm install && cd ..

# 安装 TTS
pip install edge-tts

# 安装 ffmpeg（macOS）
brew install ffmpeg
```

### 设置环境变量

```bash
# .env 文件（已加入 .gitignore）
APIFY_TOKEN=apify_api_xxx          # 必需，用于抓取 X/Twitter 数据
TELEGRAM_BOT_TOKEN=123456:ABCdef   # 可选，用于发送到 Telegram
```

Twitter 数据通过 [Apify](https://apify.com) 抓取（~$0.25/千条推文），播客和博客通过 RSS 免费获取。

### 生成视频

```bash
# 一键生成
node scripts/generate-video.js

# 生成并发送到 Telegram
node scripts/generate-video.js --send

# 预览（Remotion Studio）
cd video && npx remotion studio src/index.ts
```

## 项目结构

```
scripts/
  prepare-digest.js     获取 feed 数据（X/播客/博客）
  generate-script.js    模板生成视频脚本（无需 API）
  generate-video.js     编排：数据 → 脚本 → TTS → 渲染

video/                  Remotion 视频项目
  src/components/       6 个视频组件（Intro/Overview/TweetCard/PodcastCard/BlogCard/Outro）
  src/styles/theme.ts   主题样式（深色 + 亮蓝/绿高亮）

prompts/                摘要生成的 prompt 模板
output/                 生成的视频和音频文件
```

## 工作流程

```
GitHub Feeds (JSON)
       ↓
prepare-digest.js — 获取推文/播客/博客数据
       ↓
generate-script.js — 模板生成中文播报文案 + 时长裁剪（零成本）
       ↓
generate-video.js
  ├── Edge TTS 语音合成（zh-CN-YunxiNeural）
  ├── 音频驱动时间轴（每段画面 = 音频时长）
  └── Remotion 渲染 → MP4 (1080x1920)
       ↓
output/video/ai-briefing-YYYY-MM-DD.mp4
```

## 技术栈

| 组件 | 技术 |
|------|------|
| 视频渲染 | [Remotion](https://remotion.dev) (React) |
| 文案生成 | 模板引擎（零成本） |
| 语音合成 | Edge TTS (微软, 免费) |
| 音频分析 | ffprobe |
| 字体 | Noto Sans SC |

## 数据源

### X/Twitter — 20 位 AI Builder

| # | 姓名 | X 地址 |
|---|------|--------|
| 1 | Andrej Karpathy | https://x.com/karpathy |
| 2 | Sam Altman | https://x.com/sama |
| 3 | Swyx | https://x.com/swyx |
| 4 | Guillermo Rauch | https://x.com/rauchg |
| 5 | Amjad Masad | https://x.com/amasad |
| 6 | Aaron Levie | https://x.com/levie |
| 7 | Garry Tan | https://x.com/garrytan |
| 8 | Alex Albert | https://x.com/alexalbert__ |
| 9 | Josh Woodward | https://x.com/joshwoodward |
| 10 | Peter Yang | https://x.com/petergyang |
| 11 | Nan Yu | https://x.com/thenanyu |
| 12 | Cat Wu | https://x.com/_catwu |
| 13 | Thariq | https://x.com/trq212 |
| 14 | Matt Turck | https://x.com/mattturck |
| 15 | Zara Zhang | https://x.com/zarazhangrui |
| 16 | Nikunj Kothari | https://x.com/nikunj |
| 17 | Peter Steinberger | https://x.com/steipete |
| 18 | Dan Shipper | https://x.com/danshipper |
| 19 | Aditya Agarwal | https://x.com/adityaag |
| 20 | Claude (官方) | https://x.com/claudeai |

### 播客 — 5 个

| # | 播客名 | 主持/来源 |
|---|--------|-----------|
| 1 | Latent Space | Swyx & Alessio |
| 2 | Training Data | Sequoia Capital |
| 3 | No Priors | Sarah Guo & Elad Gil |
| 4 | Unsupervised Learning | Daniel Miessler |
| 5 | The MAD Podcast | Matt Turck (FirstMark) |

### 博客 — 1 个

| # | 博客名 | 来源 |
|---|--------|------|
| 1 | Anthropic Engineering | anthropic.com（社区 RSS 镜像） |

## 自定义

- **修改 prompt**：编辑 `prompts/` 目录下的 md 文件
- **修改主题**：编辑 `video/src/styles/theme.ts`
- **添加 builder**：编辑 `scripts/fetch-feeds.js` 中的 `BUILDERS` 数组
- **个人 prompt 覆盖**：创建 `~/.follow-builders/prompts/` 目录，放入同名文件

## License

MIT
