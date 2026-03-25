import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { theme } from "../styles/theme";

interface VideoBgProps {
  src: string;
  children: React.ReactNode;
}

/**
 * Full-screen AI video background with dark overlay for text readability.
 * Falls back to solid color if video fails to load.
 */
export const VideoBg: React.FC<VideoBgProps> = ({ src, children }) => {
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
          backgroundColor: "rgba(0, 0, 0, 0.45)",
        }}
      />

      {/* Content on top */}
      <AbsoluteFill>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};
