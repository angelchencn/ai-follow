import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import type { CompositionProps, SegmentWithAudio } from "./types";
import { Intro } from "./components/Intro";
import { Overview } from "./components/Overview";
import { TweetCard } from "./components/TweetCard";
import { PodcastCard } from "./components/PodcastCard";
import { BlogCard } from "./components/BlogCard";
import { Outro } from "./components/Outro";
import { Subtitle } from "./components/Subtitle";
import { VideoBg } from "./components/VideoBg";

function renderSegment(
  segment: SegmentWithAudio,
  date: string,
  stats: { builders: number; podcasts: number; blogs: number }
): React.ReactNode {
  const { type, display } = segment;

  switch (type) {
    case "intro":
      return <Intro date={date} />;

    case "overview":
      return (
        <Overview
          builders={stats.builders}
          podcasts={stats.podcasts}
          blogs={stats.blogs}
        />
      );

    case "tweet":
      return (
        <TweetCard
          title={display.title}
          subtitle={display.subtitle}
          avatarUrl={display.avatarUrl}
          avatarFallback={display.avatarFallback}
          qrUrl={display.qrUrl}
        />
      );

    case "podcast":
      return (
        <PodcastCard
          title={display.title}
          subtitle={display.subtitle}
          points={display.points}
        />
      );

    case "blog":
      return (
        <BlogCard
          title={display.title}
          subtitle={display.subtitle}
        />
      );

    case "outro":
      return <Outro />;

    default:
      return null;
  }
}

export const VideoComposition: React.FC<CompositionProps> = ({ segments, date, stats }) => {
  const resolvedStats = stats ?? { builders: 0, podcasts: 0, blogs: 0 };
  let cumulativeFrames = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
      {segments.map((segment) => {
        const from = cumulativeFrames;
        cumulativeFrames += segment.durationInFrames;

        const content = (
          <>
            {renderSegment(segment, date, resolvedStats)}
            <Subtitle
              text={segment.text}
              durationInFrames={segment.durationInFrames}
            />
            {segment.audioFile && (
              <Audio src={staticFile(segment.audioFile)} />
            )}
          </>
        );

        return (
          <Sequence
            key={segment.id}
            from={from}
            durationInFrames={segment.durationInFrames}
          >
            {segment.videoBg ? (
              <VideoBg src={segment.videoBg} durationInFrames={segment.durationInFrames}>{content}</VideoBg>
            ) : (
              <AbsoluteFill>{content}</AbsoluteFill>
            )}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
