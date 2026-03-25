import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../styles/theme";

interface SubtitleProps {
  text: string;
  durationInFrames: number;
}

/**
 * Split text into lines of roughly equal length for subtitle display.
 * Each line shows ~18 Chinese chars or ~40 English chars.
 */
function splitIntoLines(text: string, maxChars = 18): string[] {
  const lines: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      lines.push(remaining);
      break;
    }

    // Find a good break point (punctuation or space)
    let breakAt = maxChars;
    const punctuation = "\uff0c\u3002\uff01\uff1f\u3001\uff1b\uff1a\u201c\u201d\u2018\u2019\uff09\u300b\u2026\u2014";
    for (let i = maxChars; i >= maxChars - 6 && i >= 0; i--) {
      if (punctuation.includes(remaining[i]) || remaining[i] === " ") {
        breakAt = i + 1;
        break;
      }
    }

    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }

  return lines;
}

/**
 * Group lines into subtitle "pages" (2 lines per page).
 * Each page is shown for a proportional duration of the segment.
 */
function groupIntoPages(lines: string[], linesPerPage = 2): string[][] {
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  return pages;
}

export const Subtitle: React.FC<SubtitleProps> = ({ text, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!text || durationInFrames <= 0) return null;

  const lines = splitIntoLines(text);
  const pages = groupIntoPages(lines);

  if (pages.length === 0) return null;

  // Each page gets an equal share of the total duration
  const framesPerPage = Math.floor(durationInFrames / pages.length);
  const currentPageIndex = Math.min(
    Math.floor(frame / framesPerPage),
    pages.length - 1,
  );
  const currentPage = pages[currentPageIndex];

  // Fade in at start of each page
  const pageStartFrame = currentPageIndex * framesPerPage;
  const fadeIn = interpolate(frame - pageStartFrame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 120,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        opacity: fadeIn,
        pointerEvents: "none",
      }}
    >
      {/* Dark backdrop for readability */}
      <div
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          borderRadius: 12,
          padding: "16px 32px",
          maxWidth: "90%",
        }}
      >
        {currentPage.map((line, i) => (
          <div
            key={`${currentPageIndex}-${i}`}
            style={{
              color: theme.colors.text,
              fontSize: 32,
              fontFamily: theme.fonts.primary,
              fontWeight: 500,
              lineHeight: 1.6,
              textAlign: "center",
              textShadow: "0 2px 4px rgba(0,0,0,0.8)",
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
};
