import fs from "node:fs/promises";
import path from "node:path";
import { AppConfig } from "../config";
import { buildAssSubtitle, buildCaptionCues } from "../lib/captions";
import { ShortyError, toShortyError } from "../lib/errors";
import { ensureDir } from "../lib/file-system";
import { countWords } from "../lib/text";
import { StoryPlan, StoryReview, ShortyJob } from "../types";
import { JobStore } from "../store/job-store";
import { GeminiClient } from "./gemini-client";
import { PexelsClient } from "./pexels-client";
import { RenderService } from "./render-service";
import { YouTubeClient } from "./youtube-client";

function mergePlan(plan: StoryPlan, review: StoryReview): StoryPlan {
  if (!review.revisedPlan) {
    return plan;
  }

  return {
    ...plan,
    ...review.revisedPlan,
    beats: review.revisedPlan.beats ? review.revisedPlan.beats : plan.beats,
    hashtags: review.revisedPlan.hashtags ? review.revisedPlan.hashtags : plan.hashtags,
    visualQueries: review.revisedPlan.visualQueries ? review.revisedPlan.visualQueries : plan.visualQueries
  };
}

export class JobRunner {
  constructor(
    private readonly store: JobStore,
    private readonly geminiClient: GeminiClient,
    private readonly pexelsClient: PexelsClient,
    private readonly renderService: RenderService,
    private readonly youtubeClient: YouTubeClient,
    private readonly config: AppConfig
  ) {}

  private async save(job: ShortyJob): Promise<ShortyJob> {
    return await this.store.saveJob(job);
  }

  private async markStatus(job: ShortyJob, status: ShortyJob["status"], message: string): Promise<ShortyJob> {
    return await this.save({
      ...job,
      status,
      error: undefined,
      events: [
        ...job.events,
        {
          at: new Date().toISOString(),
          type: status,
          message
        }
      ]
    });
  }

  private async ensureContent(job: ShortyJob): Promise<ShortyJob> {
    if (job.content.fullScript && job.operation !== "full") {
      return job;
    }

    job = await this.markStatus(job, "writing", "Yeni hikaye ve metadata uretiliyor.");
    const history = await this.store.getRecentHistory(50, job.id);
    let plan = await this.geminiClient.generateStoryPlan(job.input.seedTopic, history);
    let review = await this.geminiClient.reviewStoryPlan(plan, history);
    let attemptCount = 1;

    if (!review.accepted || review.similarityScore > 0.58 || review.clicheScore > 55 || countWords(plan.fullScript) > 125) {
      plan = review.revisedPlan ? mergePlan(plan, review) : await this.geminiClient.generateStoryPlan(job.input.seedTopic, history, review.notes);
      review = await this.geminiClient.reviewStoryPlan(plan, history);
      attemptCount = 2;
    }

    if (!review.accepted) {
      throw new ShortyError("writing", `AI editor scripti reddetti: ${review.notes}`, true);
    }

    return await this.save({
      ...job,
      content: {
        ...job.content,
        topic: plan.topic,
        hook: plan.hook,
        beats: plan.beats,
        outro: plan.outro,
        fullScript: plan.fullScript,
        title: plan.title,
        description: plan.description,
        hashtags: plan.hashtags,
        visualQueries: plan.visualQueries,
        shortSummary: plan.shortSummary,
        review: {
          ...review,
          attemptCount
        },
        wordCount: countWords(plan.fullScript)
      }
    });
  }

  private async ensureVisuals(job: ShortyJob): Promise<ShortyJob> {
    if ((job.assets.clips.length > 0 || job.assets.fallbackVisuals) && job.operation !== "regenerate-visuals") {
      return job;
    }

    job = await this.markStatus(job, "sourcing", "Pexels klipleri ve fallback gorseller hazirlaniyor.");
    const assetDir = path.join(this.store.jobDir(job.id), "assets");
    await ensureDir(assetDir);
    const prepared = await this.pexelsClient.prepareVisuals(job.id, job.content.visualQueries, assetDir);

    return await this.save({
      ...job,
      assets: {
        ...job.assets,
        clips: prepared.clips,
        fallbackVisuals: prepared.fallbackVisuals
      },
      content: {
        ...job.content,
        creditsText: prepared.creditsText
      }
    });
  }

  private async ensureAudio(job: ShortyJob): Promise<ShortyJob> {
    if (job.audio.sourcePath && job.audio.durationSeconds && job.operation !== "regenerate-audio") {
      return job;
    }

    if (!job.content.fullScript) {
      throw new ShortyError("voicing", "Seslendirme icin script bulunamadi.", false);
    }

    job = await this.markStatus(job, "voicing", "Gemini TTS ile ses olusturuluyor.");
    if (!job.content.fullScript) {
      throw new ShortyError("voicing", "Script kayboldu, is tekrar denenmeli.", false);
    }
    const audioDir = path.join(this.store.jobDir(job.id), "audio");
    await ensureDir(audioDir);
    const outputPath = path.join(audioDir, "voice.wav");
    const script = job.content.fullScript;
    await this.geminiClient.generateSpeech(script, outputPath, job.audio.voiceName, job.audio.stylePrompt);
    const durationSeconds = await this.renderService.measureDuration(outputPath);

    if (durationSeconds < 32 || durationSeconds > 50) {
      throw new ShortyError(
        "voicing",
        `Ses suresi ${durationSeconds.toFixed(1)} saniye oldu. Hedef 35-45 saniye bandi disina tasiyor.`,
        true
      );
    }

    return await this.save({
      ...job,
      audio: {
        ...job.audio,
        sourcePath: outputPath,
        durationSeconds
      }
    });
  }

  private async ensureCaptions(job: ShortyJob): Promise<ShortyJob> {
    if (job.captions.assPath && job.captions.cues.length > 0 && job.operation !== "regenerate-audio") {
      return job;
    }

    if (!job.content.fullScript || !job.audio.durationSeconds) {
      throw new ShortyError("captioning", "Altyazi icin script veya sure bulunamadi.", false);
    }

    job = await this.markStatus(job, "captioning", "Karaoke altyazilar olusturuluyor.");
    if (!job.content.fullScript || !job.audio.durationSeconds) {
      throw new ShortyError("captioning", "Script veya sure yeniden dogrulanamadi.", false);
    }
    const captionDir = path.join(this.store.jobDir(job.id), "captions");
    await ensureDir(captionDir);
    const script = job.content.fullScript;
    const cues = buildCaptionCues(script, job.audio.durationSeconds);
    const assBody = buildAssSubtitle(cues);
    const assPath = path.join(captionDir, "captions.ass");
    await fs.writeFile(assPath, assBody, "utf8");

    return await this.save({
      ...job,
      captions: {
        cues,
        assPath
      }
    });
  }

  private async render(job: ShortyJob): Promise<ShortyJob> {
    job = await this.markStatus(job, "rendering", "Video render ediliyor.");
    const rendered = await this.renderService.render(job);
    return await this.save({
      ...job,
      assets: {
        ...job.assets,
        generatedMusicPath: rendered.musicPath,
        visualsPath: rendered.visualsPath
      },
      render: {
        videoPath: rendered.videoPath,
        previewUrl: `${this.config.publicBaseUrl.replace(/\/$/, "")}/media/jobs/${job.id}/final.mp4`
      }
    });
  }

  private async upload(job: ShortyJob): Promise<ShortyJob> {
    job = await this.markStatus(job, "uploading", "YouTube private yukleme baslatildi.");
    const uploadResult = await this.youtubeClient.upload(job);
    return await this.save({
      ...job,
      status: "uploaded_private",
      youtube: {
        videoId: uploadResult.videoId,
        url: uploadResult.url,
        studioUrl: uploadResult.studioUrl,
        processingStatus: uploadResult.processingStatus,
        uploadedAt: new Date().toISOString()
      },
      events: [
        ...job.events,
        {
          at: new Date().toISOString(),
          type: "uploaded_private",
          message: "Video private olarak YouTube'a yuklendi."
        }
      ]
    });
  }

  async run(jobId: string): Promise<void> {
    let job = await this.store.requireJob(jobId);
    let currentStep = "writing";

    try {
      job = await this.ensureContent(job);
      currentStep = "sourcing";
      job = await this.ensureVisuals(job);
      currentStep = "voicing";
      job = await this.ensureAudio(job);
      currentStep = "captioning";
      job = await this.ensureCaptions(job);
      currentStep = "rendering";
      job = await this.render(job);
      currentStep = "uploading";
      await this.upload(job);
    } catch (error) {
      const shortyError = toShortyError(error, currentStep);
      const failedJob = await this.store.requireJob(jobId);
      await this.store.saveJob({
        ...failedJob,
        status: shortyError.recoverable ? "needs_attention" : "failed",
        error: {
          at: new Date().toISOString(),
          step: shortyError.step,
          message: shortyError.message,
          recoverable: shortyError.recoverable,
          details: shortyError.details
        },
        events: [
          ...failedJob.events,
          {
            at: new Date().toISOString(),
            type: shortyError.recoverable ? "needs_attention" : "failed",
            message: shortyError.message
          }
        ]
      });
      throw shortyError;
    }
  }
}
