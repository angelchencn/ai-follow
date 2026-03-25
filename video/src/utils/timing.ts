import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const FPS = 30;

export async function getAudioDuration(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "quiet",
    "-show_entries", "format=duration",
    "-of", "csv=p=0",
    filePath,
  ]);
  return parseFloat(stdout.trim());
}

export function secondsToFrames(seconds: number): number {
  return Math.ceil(seconds * FPS);
}

export function estimateDurationFromText(text: string): number {
  const charCount = text.replace(/[a-zA-Z\s]/g, "").length;
  const wordCount = (text.match(/[a-zA-Z]+/g) || []).length;
  return charCount / 4 + wordCount / 2.5;
}
