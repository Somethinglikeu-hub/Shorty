import fs from "node:fs/promises";
import path from "node:path";
import { AppConfig } from "../config";
import { ShortyError } from "../lib/errors";
import { ensureDir } from "../lib/file-system";
import { probeDuration } from "../lib/media";
import { runCommand } from "../lib/shell";
import { normalizeWhitespace, truncate } from "../lib/text";
import { ShortyJob } from "../types";

function escapeForFfmpegFilter(value: string): string {
  return value.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function escapeDrawtext(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%");
}

function hashSeed(value: string): number {
  return Array.from(value).reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);
}

export class RenderService {
  constructor(private readonly config: AppConfig, private readonly dataDir: string) {}

  async measureDuration(filePath: string): Promise<number> {
    return await probeDuration(filePath);
  }

  private async pickLocalMusic(job: ShortyJob): Promise<string | undefined> {
    const musicDir = path.join(this.dataDir, "music");
    try {
      const entries = await fs.readdir(musicDir, { withFileTypes: true });
      const files = entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((name) => /\.(mp3|wav|m4a|aac)$/i.test(name))
        .sort();

      if (files.length === 0) {
        return undefined;
      }

      const selected = files[hashSeed(job.id) % files.length];
      return path.join(musicDir, selected);
    } catch {
      return undefined;
    }
  }

  private async buildMusicTrack(job: ShortyJob, durationSeconds: number, outputPath: string): Promise<string> {
    await ensureDir(path.dirname(outputPath));
    const localTrack = await this.pickLocalMusic(job);
    if (localTrack) {
      await runCommand("ffmpeg", [
        "-y",
        "-stream_loop",
        "-1",
        "-i",
        localTrack,
        "-t",
        durationSeconds.toFixed(2),
        "-vn",
        "-ac",
        "2",
        "-ar",
        "44100",
        "-af",
        `volume=0.18,afade=t=in:st=0:d=0.8,afade=t=out:st=${Math.max(0, durationSeconds - 1.2).toFixed(2)}:d=1.2`,
        outputPath
      ]);
      return outputPath;
    }

    await runCommand("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=220:sample_rate=44100:duration=${durationSeconds}`,
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=330:sample_rate=44100:duration=${durationSeconds}`,
      "-filter_complex",
      "[0:a]volume=0.022[a0];[1:a]volume=0.012[a1];[a0][a1]amix=inputs=2:normalize=0,lowpass=f=900,afade=t=in:st=0:d=0.8,afade=t=out:st=" +
        `${Math.max(0, durationSeconds - 1.2).toFixed(2)}:d=1.2`,
      outputPath
    ]);
    return outputPath;
  }

  private async buildClipVisuals(job: ShortyJob, durationSeconds: number, outputPath: string): Promise<string> {
    const renderDir = path.dirname(outputPath);
    await ensureDir(renderDir);
    const segmentDuration = durationSeconds / Math.max(job.assets.clips.length, 1);
    const normalizedFiles: string[] = [];

    for (const [index, clip] of job.assets.clips.entries()) {
      const normalizedPath = path.join(renderDir, `clip-${index}.mp4`);
      const maxOffset = Math.max(0, clip.durationSeconds - segmentDuration - 0.2);
      const offset = maxOffset > 0 ? Math.min(maxOffset, ((hashSeed(`${job.id}-${clip.id}`) % 100) / 100) * maxOffset) : 0;
      await runCommand("ffmpeg", [
        "-y",
        "-ss",
        offset.toFixed(2),
        "-t",
        segmentDuration.toFixed(2),
        "-i",
        clip.localPath,
        "-vf",
        "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,eq=contrast=1.04:saturation=1.08:brightness=0.02",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        normalizedPath
      ]);
      normalizedFiles.push(normalizedPath);
    }

    const concatPath = path.join(renderDir, "concat.txt");
    const concatBody = normalizedFiles.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n");
    await fs.writeFile(concatPath, `${concatBody}\n`, "utf8");

    await runCommand("ffmpeg", [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatPath,
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      outputPath
    ]);

    return outputPath;
  }

  private async buildFallbackVisuals(job: ShortyJob, durationSeconds: number, outputPath: string): Promise<string> {
    await ensureDir(path.dirname(outputPath));
    const topic = escapeDrawtext(truncate(normalizeWhitespace(job.content.topic ?? "Bugunun hikayesi"), 34));
    const hook = escapeDrawtext(truncate(normalizeWhitespace(job.content.hook ?? "Kisa ama etkili bir hikaye."), 56));
    const boxes =
      "drawbox=x=70:y=120:w=940:h=1680:color=0xEA580C@0.10:t=fill," +
      "drawbox=x='90+24*sin(t*0.7)':y=170:w=900:h=260:color=0xF97316@0.22:t=fill," +
      "drawbox=x=120:y=1390:w=840:h=320:color=0x111827@0.72:t=fill";
    const texts =
      `drawtext=fontfile=${escapeForFfmpegFilter(this.config.ffmpegFontFile)}:text='${topic}':fontcolor=white:fontsize=76:x=110:y=1460:` +
      "line_spacing=10," +
      `drawtext=fontfile=${escapeForFfmpegFilter(this.config.ffmpegFontFile)}:text='${hook}':fontcolor=0xF8FAFC:fontsize=42:x=110:y=1580:` +
      "line_spacing=6";

    await runCommand("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=0x140F12:s=1080x1920:r=30",
      "-t",
      durationSeconds.toFixed(2),
      "-vf",
      `${boxes},${texts}`,
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      outputPath
    ]);

    return outputPath;
  }

  private async buildVisualTrack(job: ShortyJob, durationSeconds: number, outputPath: string): Promise<string> {
    if (!job.assets.fallbackVisuals && job.assets.clips.length >= 2) {
      return await this.buildClipVisuals(job, durationSeconds, outputPath);
    }
    return await this.buildFallbackVisuals(job, durationSeconds, outputPath);
  }

  async render(job: ShortyJob): Promise<{
    visualsPath: string;
    videoPath: string;
    musicPath: string;
  }> {
    if (!job.audio.sourcePath || !job.audio.durationSeconds) {
      throw new ShortyError("rendering", "Render icin ses dosyasi hazir degil.", false);
    }
    if (!job.captions.assPath) {
      throw new ShortyError("rendering", "Render icin ASS altyazi dosyasi hazir degil.", false);
    }

    const renderDir = path.join(this.dataDir, "jobs", job.id, "render");
    const audioDir = path.join(this.dataDir, "jobs", job.id, "audio");
    await ensureDir(renderDir);
    await ensureDir(audioDir);

    const durationSeconds = job.audio.durationSeconds;
    const visualsPath = path.join(renderDir, "visuals.mp4");
    const musicPath = path.join(audioDir, "music-bed.wav");
    const videoPath = path.join(renderDir, "final.mp4");

    await this.buildVisualTrack(job, durationSeconds, visualsPath);
    await this.buildMusicTrack(job, durationSeconds, musicPath);

    await runCommand("ffmpeg", [
      "-y",
      "-i",
      visualsPath,
      "-i",
      job.audio.sourcePath,
      "-i",
      musicPath,
      "-filter_complex",
      "[2:a]volume=0.20[music];[music][1:a]sidechaincompress=threshold=0.03:ratio=10:attack=12:release=350[ducked];[1:a][ducked]amix=inputs=2:weights=1 0.55:normalize=0[mix]",
      "-map",
      "0:v",
      "-map",
      "[mix]",
      "-vf",
      `subtitles=${escapeForFfmpegFilter(job.captions.assPath)}`,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      "-shortest",
      videoPath
    ]);

    const finalDuration = await probeDuration(videoPath);
    if (finalDuration < 30 || finalDuration > 60) {
      throw new ShortyError("rendering", "Final video suresi beklenen aralikta degil.", true);
    }

    return {
      visualsPath,
      videoPath,
      musicPath
    };
  }
}
