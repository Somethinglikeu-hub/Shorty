import fs from "node:fs/promises";
import path from "node:path";
import { AppConfig } from "../config";
import { ShortyError } from "../lib/errors";
import { ensureDir } from "../lib/file-system";
import { slugify } from "../lib/text";
import { VideoClipAsset } from "../types";

interface PexelsVideoFile {
  link: string;
  width: number;
  height: number;
  file_type: string;
}

interface PexelsVideo {
  id: number;
  duration: number;
  url: string;
  user?: {
    name?: string;
    url?: string;
  };
  video_files: PexelsVideoFile[];
}

interface PexelsSearchResponse {
  videos: PexelsVideo[];
}

function pickBestFile(video: PexelsVideo): PexelsVideoFile | undefined {
  return video.video_files
    .filter((file) => file.file_type === "video/mp4")
    .sort((left, right) => {
      const leftScore = Math.abs(left.height - 1920) + Math.abs(left.width - 1080);
      const rightScore = Math.abs(right.height - 1920) + Math.abs(right.width - 1080);
      return leftScore - rightScore;
    })[0];
}

async function downloadFile(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
}

export class PexelsClient {
  constructor(private readonly config: AppConfig) {}

  isConfigured(): boolean {
    return Boolean(this.config.pexelsApiKey);
  }

  async prepareVisuals(jobId: string, queries: string[], outputDir: string): Promise<{
    clips: VideoClipAsset[];
    fallbackVisuals: boolean;
    creditsText: string;
  }> {
    await ensureDir(outputDir);

    if (!this.isConfigured()) {
      return {
        clips: [],
        fallbackVisuals: true,
        creditsText: "Pexels anahtari tanimli olmadigi icin branded fallback gorseller kullanildi."
      };
    }

    const seen = new Set<number>();
    const clips: VideoClipAsset[] = [];

    for (const query of queries) {
      if (clips.length >= 4) {
        break;
      }

      const endpoint = `https://api.pexels.com/videos/search?query=${encodeURIComponent(
        query
      )}&per_page=6&orientation=portrait&size=medium`;
      const response = await fetch(endpoint, {
        headers: {
          Authorization: this.config.pexelsApiKey
        }
      });

      if (!response.ok) {
        throw new ShortyError("sourcing", "Pexels aramasi basarisiz oldu.", true, await response.text());
      }

      const payload = (await response.json()) as PexelsSearchResponse;
      for (const video of payload.videos ?? []) {
        if (clips.length >= 4) {
          break;
        }
        if (seen.has(video.id)) {
          continue;
        }
        const file = pickBestFile(video);
        if (!file) {
          continue;
        }

        const localPath = path.join(outputDir, `${jobId}-${slugify(query)}-${video.id}.mp4`);
        await downloadFile(file.link, localPath);
        clips.push({
          id: String(video.id),
          query,
          width: file.width,
          height: file.height,
          durationSeconds: video.duration,
          photographer: video.user?.name ?? "Unknown",
          photographerUrl: video.user?.url,
          pexelsUrl: video.url,
          localPath,
          fileUrl: file.link
        });
        seen.add(video.id);
      }
    }

    const creditsText =
      clips.length > 0
        ? clips
            .map((clip) => {
              const byline = clip.photographerUrl
                ? `${clip.photographer} (${clip.photographerUrl})`
                : clip.photographer;
              return `Pexels: ${byline}${clip.pexelsUrl ? ` - ${clip.pexelsUrl}` : ""}`;
            })
            .join("\n")
        : "Pexels'tan uygun dikey klip bulunamadi; fallback motion background kullanildi.";

    return {
      clips,
      fallbackVisuals: clips.length < 2,
      creditsText
    };
  }
}
