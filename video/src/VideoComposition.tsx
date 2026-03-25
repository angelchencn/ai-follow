import { AbsoluteFill } from "remotion";
import type { CompositionProps } from "./types";

export const VideoComposition: React.FC<CompositionProps> = ({ date }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f", justifyContent: "center", alignItems: "center" }}>
      <div style={{ color: "white", fontSize: 48 }}>AI Builder 日报 · {date}</div>
    </AbsoluteFill>
  );
};
