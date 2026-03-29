import fs from "node:fs";
import { google, youtube_v3 } from "googleapis";
import { AppConfig } from "../config";
import { ShortyError } from "../lib/errors";
import { normalizeWhitespace } from "../lib/text";
import { ShortyJob } from "../types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripHash(value: string): string {
  return value.replace(/^#+/, "").trim();
}

export class YouTubeClient {
  constructor(private readonly config: AppConfig) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.youtubeClientId &&
        this.config.youtubeClientSecret &&
        this.config.youtubeRefreshToken
    );
  }

  private getYoutubeClient(): youtube_v3.Youtube {
    if (!this.isConfigured()) {
      throw new ShortyError(
        "uploading",
        "YouTube OAuth bilgileri eksik. .env ve refresh token ayarlarini tamamla.",
        true
      );
    }

    const auth = new google.auth.OAuth2(
      this.config.youtubeClientId,
      this.config.youtubeClientSecret,
      this.config.youtubeRedirectUri
    );
    auth.setCredentials({
      refresh_token: this.config.youtubeRefreshToken
    });

    return google.youtube({
      version: "v3",
      auth
    });
  }

  private buildDescription(job: ShortyJob): string {
    const descriptionParts = [
      normalizeWhitespace(job.content.description ?? ""),
      job.content.hashtags.join(" "),
      job.content.creditsText ?? ""
    ].filter(Boolean);
    return descriptionParts.join("\n\n").trim();
  }

  async upload(job: ShortyJob): Promise<{
    videoId: string;
    url: string;
    studioUrl: string;
    processingStatus: string;
  }> {
    if (!job.render.videoPath) {
      throw new ShortyError("uploading", "Yukleme icin final video bulunamadi.", false);
    }

    const youtube = this.getYoutubeClient();
    const response = await youtube.videos.insert({
      part: ["snippet", "status"],
      notifySubscribers: false,
      requestBody: {
        snippet: {
          title: normalizeWhitespace(job.content.title ?? "Yeni Shorts"),
          description: this.buildDescription(job),
          tags: (job.content.hashtags ?? []).map(stripHash).filter(Boolean),
          categoryId: this.config.youtubeDefaultCategoryId,
          defaultLanguage: this.config.youtubeDefaultLanguage,
          defaultAudioLanguage: this.config.youtubeDefaultLanguage
        },
        status: {
          privacyStatus: job.input.privacy,
          selfDeclaredMadeForKids: false
        }
      },
      media: {
        body: fs.createReadStream(job.render.videoPath)
      }
    });

    const videoId = response.data.id;
    if (!videoId) {
      throw new ShortyError("uploading", "YouTube video kimligi dondurmedi.", true);
    }

    const processingStatus = await this.waitForProcessing(youtube, videoId);
    return {
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      studioUrl: `https://studio.youtube.com/video/${videoId}/edit`,
      processingStatus
    };
  }

  private async waitForProcessing(youtube: youtube_v3.Youtube, videoId: string): Promise<string> {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const response = await youtube.videos.list({
        id: [videoId],
        part: ["processingDetails", "status"]
      });
      const item = response.data.items?.[0];
      const status = item?.processingDetails?.processingStatus ?? "processing";
      if (status === "succeeded") {
        return status;
      }
      if (status === "failed" || status === "rejected") {
        throw new ShortyError("uploading", `YouTube isleme durumunu ${status} olarak raporladi.`, true);
      }
      await sleep(10000);
    }

    throw new ShortyError(
      "uploading",
      "YouTube videosu zamaninda islenmedi. Studio'dan kontrol edip yeniden deneyebilirsin.",
      true
    );
  }
}

