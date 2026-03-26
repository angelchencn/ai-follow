import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../styles/theme";

interface CountUpProps {
  value: number;
  label: string;
  delay: number;
}

const CountUp: React.FC<CountUpProps> = ({ value, label, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 15, stiffness: 80 },
  });

  const displayValue = Math.round(interpolate(progress, [0, 1], [0, value]));

  const opacity = interpolate(Math.max(0, frame - delay), [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: theme.spacing.gap / 2,
        flex: 1,
      }}
    >
      <div
        style={{
          color: theme.colors.accent,
          fontSize: theme.fontSize.stat,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {displayValue}
      </div>
      <div
        style={{
          color: theme.colors.textSecondary,
          fontSize: theme.fontSize.body,
          fontWeight: 400,
        }}
      >
        {label}
      </div>
    </div>
  );
};

interface OverviewProps {
  builders: number;
  podcasts: number;
  blogs: number;
}

export const Overview: React.FC<OverviewProps> = ({ builders, podcasts, blogs }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const headerScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  return (
    <AbsoluteFill
      style={{
        background: "transparent",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: theme.spacing.gap * 2,
        fontFamily: theme.fonts.primary,
        padding: `0 ${theme.spacing.page}px`,
      }}
    >
      <div
        style={{
          opacity: headerOpacity,
          transform: `scale(${headerScale})`,
          color: theme.colors.text,
          fontSize: theme.fontSize.title,
          fontWeight: 700,
          textAlign: "center",
        }}
      >
        今日追踪
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          width: "100%",
          justifyContent: "space-around",
          alignItems: "center",
        }}
      >
        <CountUp value={builders} label="构建者" delay={0} />
        <CountUp value={podcasts} label="播客" delay={10} />
        <CountUp value={blogs} label="文章" delay={20} />
      </div>
    </AbsoluteFill>
  );
};
