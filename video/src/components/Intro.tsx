import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../styles/theme";

export const Intro: React.FC<{ date: string }> = ({ date }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const subtitleOpacity = interpolate(frame, [15, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "transparent",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: theme.spacing.gap,
        fontFamily: theme.fonts.primary,
      }}
    >
      <div
        style={{
          transform: `scale(${titleScale})`,
          color: theme.colors.text,
          fontSize: theme.fontSize.title,
          fontWeight: 700,
          letterSpacing: "0.05em",
          textAlign: "center",
        }}
      >
        AI Builder 日报
      </div>
      <div
        style={{
          opacity: subtitleOpacity,
          color: theme.colors.accent,
          fontSize: theme.fontSize.subtitle,
          fontWeight: 400,
          textAlign: "center",
        }}
      >
        {date}
      </div>
    </AbsoluteFill>
  );
};
