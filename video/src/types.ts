export interface VideoScript {
  date: string;
  stats: { builders: number; podcasts: number; blogs: number };
  segments: Segment[];
}

export interface Segment {
  id: string;
  type: "intro" | "overview" | "tweet" | "podcast" | "blog" | "outro";
  text: string;
  display: {
    title?: string;
    subtitle?: string;
    points?: string[];
    avatarUrl?: string;
    avatarFallback?: string;
    qrUrl?: string;
  };
}

export interface SegmentWithAudio extends Segment {
  audioFile: string;
  durationInSeconds: number;
  durationInFrames: number;
}

export interface CompositionProps {
  segments: SegmentWithAudio[];
  date: string;
}
