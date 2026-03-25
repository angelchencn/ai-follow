import { Composition } from "remotion";
import { VideoComposition } from "./VideoComposition";
import type { CompositionProps } from "./types";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="VideoComposition"
      component={VideoComposition}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        segments: [],
        date: "2026-03-25",
      } satisfies CompositionProps}
    />
  );
};
