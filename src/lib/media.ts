import { runCommand } from "./shell";

export async function probeDuration(filePath: string): Promise<number> {
  const result = await runCommand("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath
  ]);

  const duration = Number(result.stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Invalid media duration for ${filePath}`);
  }

  return duration;
}
