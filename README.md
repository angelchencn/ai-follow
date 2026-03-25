# AI Follow - AI Builder 视频简报

自动聚合 AI 领域顶级 builder 的动态，生成竖屏短视频简报。

## 功能

- 追踪 **25 位 AI builder** 的 X/Twitter 动态（Andrej Karpathy、Sam Altman、Swyx 等）
- 聚合 **5 个顶级 AI 播客**（Latent Space、Training Data、No Priors 等）
- 整合 **Anthropic/Claude 官方博客**
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
export ANTHROPIC_API_KEY="sk-ant-..."          # 必须
export TELEGRAM_BOT_TOKEN="123456:ABCdef..."   # 可选，用于发送到 Telegram
```

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
  generate-script.js    Claude API 生成视频脚本
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
generate-script.js — Claude AI 生成中文播报文案 + 时长裁剪
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
| AI 摘要 | Claude API (Haiku) |
| 语音合成 | Edge TTS (微软, 免费) |
| 音频分析 | ffprobe |
| 字体 | Noto Sans SC |

## 自定义

- **修改 prompt**：编辑 `prompts/` 目录下的 md 文件
- **修改主题**：编辑 `video/src/styles/theme.ts`
- **添加 builder**：在上游 feed-x.json 中添加
- **个人 prompt 覆盖**：创建 `~/.follow-builders/prompts/` 目录，放入同名文件

## License

MIT
