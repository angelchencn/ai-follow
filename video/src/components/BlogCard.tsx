import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../styles/theme";

interface BlogCardProps {
  title?: string;
  subtitle?: string;
}

export const BlogCard: React.FC<BlogCardProps> = ({ title, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideProgress = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 120 },
    durationInFrames: 15,
  });

  const translateX = interpolate(slideProgress, [0, 1], [-200, 0]);
  const headerOpacity = interpolate(slideProgress, [0, 1], [0, 1]);

  const contentOpacity = interpolate(frame, [15, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "transparent",
        justifyContent: "center",
        alignItems: "flex-start",
        flexDirection: "column",
        gap: theme.spacing.gap,
        fontFamily: theme.fonts.primary,
        padding: theme.spacing.page,
      }}
    >
      {/* Label */}
      <div
        style={{
          transform: `translateX(${translateX}px)`,
          opacity: headerOpacity,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            color: theme.colors.accent,
            fontSize: theme.fontSize.caption,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          BLOG
        </div>
        <div
          style={{
            color: theme.colors.text,
            fontSize: theme.fontSize.subtitle,
            fontWeight: 700,
            lineHeight: 1.3,
          }}
        >
          {title ?? ""}
        </div>
      </div>

      {/* Summary */}
      {subtitle && (
        <div
          style={{
            opacity: contentOpacity,
            backgroundColor: theme.colors.cardBg,
            border: `1px solid ${theme.colors.cardBorder}`,
            borderRadius: 20,
            padding: theme.spacing.card,
            width: "100%",
          }}
        >
          <div
            style={{
              color: theme.colors.text,
              fontSize: theme.fontSize.body,
              lineHeight: 1.7,
            }}
          >
            {subtitle}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
