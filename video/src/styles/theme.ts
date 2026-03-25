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
