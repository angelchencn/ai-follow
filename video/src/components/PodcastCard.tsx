import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../styles/theme";

interface WaveformProps {
  frame: number;
}

const Waveform: React.FC<WaveformProps> = ({ frame }) => {
  const barCount = 6;
  const bars = Array.from({ length: barCount }, (_, i) => {
    const phase = (i / barCount) * Math.PI * 2;
    const height = interpolate(
      Math.sin(frame * 0.15 + phase),
      [-1, 1],
      [20, 70]
    );
    return height;
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        height: 80,
      }}
    >
      {bars.map((height, i) => (
        <div
          key={i}
          style={{
            width: 12,
            height,
            backgroundColor: theme.colors.accentGreen,
            borderRadius: 6,
            opacity: 0.8,
          }}
        />
      ))}
    </div>
  );
};

interface PodcastCardProps {
  title?: string;
  subtitle?: string;
  points?: string[];
}

export const PodcastCard: React.FC<PodcastCardProps> = ({ title, subtitle, points = [] }) => {
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
      {/* Header */}
      <div
        style={{
          transform: `translateX(${translateX}px)`,
          opacity: headerOpacity,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Waveform frame={frame} />
          <div style={{ flexDirection: "column", display: "flex", gap: 8 }}>
            <div
              style={{
                color: theme.colors.accentGreen,
                fontSize: theme.fontSize.caption,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              PODCAST
            </div>
            <div
              style={{
                color: theme.colors.text,
                fontSize: theme.fontSize.subtitle,
                fontWeight: 700,
              }}
            >
              {title ?? ""}
            </div>
          </div>
        </div>
        {subtitle && (
          <div
            style={{
              color: theme.colors.textSecondary,
              fontSize: theme.fontSize.body,
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {/* Points list */}
      {points.length > 0 && (
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: theme.spacing.gap,
            marginTop: theme.spacing.gap,
          }}
        >
          {points.map((point, i) => {
            const pointOpacity = interpolate(
              frame,
              [15 + i * 8, 25 + i * 8],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            return (
              <div
                key={i}
                style={{
                  opacity: pointOpacity,
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: theme.colors.accentGreen,
                    flexShrink: 0,
                    marginTop: 12,
                  }}
                />
                <div
                  style={{
                    color: theme.colors.text,
                    fontSize: theme.fontSize.body,
                    lineHeight: 1.6,
                    flex: 1,
                  }}
                >
                  {point}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AbsoluteFill>
  );
};
