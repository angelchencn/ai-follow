import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";

interface VideoBgProps {
  src: string;
  durationInFrames: number;
  children: React.ReactNode;
}

/**
 * Full-screen AI video background with dark overlay.
 * Video plays once then freezes on last frame (Remotion default).
 */
export const VideoBg: React.FC<VideoBgProps> = ({
  src,
  durationInFrames,
  children,
}) => {
  return (
    <AbsoluteFill>
      {/* AI video background */}
      <AbsoluteFill>
        <OffthreadVideo
          src={staticFile(src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
          muted
        />
      </AbsoluteFill>

      {/* Dark overlay for text readability */}
      <AbsoluteFill
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.4)",
        }}
      />

      {/* Content on top */}
      <AbsoluteFill>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};
