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
        stats: { builders: 0, podcasts: 0, blogs: 0 },
      } satisfies CompositionProps}
      calculateMetadata={({ props }) => {
        const totalFrames = props.segments.reduce(
          (sum, seg) => sum + seg.durationInFrames,
          0
        );
        return {
          durationInFrames: totalFrames > 0 ? totalFrames : 300,
        };
      }}
    />
  );
};
