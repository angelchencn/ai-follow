import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { QRCodeSVG } from "qrcode.react";
import { theme } from "../styles/theme";

interface TweetCardProps {
  title?: string;
  subtitle?: string;
  avatarUrl?: string;
  avatarFallback?: string;
  qrUrl?: string;
}

export const TweetCard: React.FC<TweetCardProps> = ({
  title,
  subtitle,
  avatarUrl,
  avatarFallback,
  qrUrl,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideProgress = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 120 },
    durationInFrames: 15,
  });

  const translateX = interpolate(slideProgress, [0, 1], [-200, 0]);
  const opacity = interpolate(slideProgress, [0, 1], [0, 1]);

  const contentOpacity = interpolate(frame, [10, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const initial = avatarFallback ? avatarFallback.charAt(0).toUpperCase() : "?";

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${theme.colors.bgPrimary}, ${theme.colors.bgSecondary})`,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: theme.spacing.gap,
        fontFamily: theme.fonts.primary,
        padding: theme.spacing.page,
      }}
    >
      <div
        style={{
          transform: `translateX(${translateX}px)`,
          opacity,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: theme.spacing.gap,
        }}
      >
        {/* Header: avatar + name */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.gap,
          }}
        >
          {avatarUrl ? (
            <Img
              src={avatarUrl}
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                objectFit: "cover",
                border: `2px solid ${theme.colors.accent}`,
              }}
            />
          ) : (
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                backgroundColor: theme.colors.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: theme.colors.bgPrimary,
                fontSize: theme.fontSize.subtitle,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {initial}
            </div>
          )}
          <div
            style={{
              color: theme.colors.text,
              fontSize: theme.fontSize.subtitle,
              fontWeight: 600,
            }}
          >
            {title ?? ""}
          </div>
        </div>

        {/* Tweet text card */}
        <div
          style={{
            opacity: contentOpacity,
            backgroundColor: theme.colors.cardBg,
            border: `1px solid ${theme.colors.cardBorder}`,
            borderRadius: 20,
            padding: theme.spacing.card,
          }}
        >
          <div
            style={{
              color: theme.colors.text,
              fontSize: theme.fontSize.body,
              lineHeight: 1.6,
            }}
          >
            {subtitle ?? ""}
          </div>
        </div>

        {/* QR code */}
        {qrUrl && (
          <div
            style={{
              opacity: contentOpacity,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              marginTop: 8,
            }}
          >
            <QRCodeSVG
              value={qrUrl}
              size={160}
              bgColor={theme.colors.bgPrimary}
              fgColor={theme.colors.accent}
              level="M"
            />
            <div
              style={{
                color: theme.colors.textSecondary,
                fontSize: theme.fontSize.caption,
              }}
            >
              扫码查看原文
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
