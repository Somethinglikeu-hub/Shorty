import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ensureDir, fileExists, readJson, writeJson } from "../lib/file-system";
import { ShortyJob, JobSummary, JobStatus, JobOperation, PrivacyStatus } from "../types";

function nowIso(): string {
  return new Date().toISOString();
}

function buildDefaultVoiceStyle(): string {
  return "Sakin, sicak ve ozguvenli bir Turkce anlatici gibi konus. Kisa cumleler kur ve her kelimeyi temiz telaffuz et.";
}

export class JobStore {
  readonly baseDir: string;
  readonly jobsDir: string;
  readonly musicDir: string;

  constructor(
    baseDir: string,
    private readonly publicBaseUrl: string,
    private readonly defaultVoice: string
  ) {
    this.baseDir = baseDir;
    this.jobsDir = path.join(baseDir, "jobs");
    this.musicDir = path.join(baseDir, "music");
  }

  async initialize(): Promise<void> {
    await ensureDir(this.jobsDir);
    await ensureDir(this.musicDir);
  }

  jobDir(jobId: string): string {
    return path.join(this.jobsDir, jobId);
  }

  jobFile(jobId: string): string {
    return path.join(this.jobDir(jobId), "job.json");
  }

  async createJob(input: {
    seedTopic?: string;
    privacy: PrivacyStatus;
    trigger: "pwa" | "n8n";
  }): Promise<ShortyJob> {
    const id = randomUUID();
    const createdAt = nowIso();

    const job: ShortyJob = {
      id,
      createdAt,
      updatedAt: createdAt,
      status: "queued",
      operation: "full",
      input,
      content: {
        beats: [],
        hashtags: [],
        visualQueries: []
      },
      assets: {
        clips: [],
        fallbackVisuals: false
      },
      audio: {
        voiceName: this.defaultVoice,
        stylePrompt: buildDefaultVoiceStyle()
      },
      captions: {
        cues: []
      },
      render: {},
      youtube: {},
      events: [
        {
          at: createdAt,
          type: "created",
          message: "Is kuyruğa eklendi."
        }
      ]
    };

    await this.saveJob(job);
    return job;
  }

  async listJobs(): Promise<ShortyJob[]> {
    if (!(await fileExists(this.jobsDir))) {
      return [];
    }

    const entries = await fs.readdir(this.jobsDir, { withFileTypes: true });
    const jobs = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => await this.getJob(entry.name))
    );

    return jobs
      .filter((job): job is ShortyJob => Boolean(job))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async getJob(jobId: string): Promise<ShortyJob | null> {
    return await readJson<ShortyJob>(this.jobFile(jobId));
  }

  async requireJob(jobId: string): Promise<ShortyJob> {
    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }
    return job;
  }

  async saveJob(job: ShortyJob): Promise<ShortyJob> {
    job.updatedAt = nowIso();
    if (job.render.videoPath) {
      job.render.previewUrl = `${this.publicBaseUrl.replace(/\/$/, "")}/media/jobs/${job.id}/final.mp4`;
    }
    await writeJson(this.jobFile(job.id), job);
    return job;
  }

  async updateJob(
    jobId: string,
    updater: (job: ShortyJob) => ShortyJob | Promise<ShortyJob>
  ): Promise<ShortyJob> {
    const job = await this.requireJob(jobId);
    const updated = await updater(job);
    return await this.saveJob(updated);
  }

  async setStatus(jobId: string, status: JobStatus, message: string): Promise<ShortyJob> {
    return await this.updateJob(jobId, (job) => ({
      ...job,
      status,
      error: undefined,
      events: [
        ...job.events,
        {
          at: nowIso(),
          type: status,
          message
        }
      ]
    }));
  }

  toSummary(job: ShortyJob): JobSummary {
    return {
      id: job.id,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      status: job.status,
      operation: job.operation,
      topic: job.content.topic,
      title: job.content.title,
      previewUrl: job.render.previewUrl,
      youtubeUrl: job.youtube.url,
      privacy: job.input.privacy,
      seedTopic: job.input.seedTopic,
      lastError: job.error?.message
    };
  }

  async getRecentHistory(limit: number, ignoreJobId?: string): Promise<string[]> {
    const jobs = await this.listJobs();
    return jobs
      .filter((job) => job.id !== ignoreJobId)
      .slice(0, limit)
      .map((job) => `${job.content.topic ?? ""} ${job.content.hook ?? ""}`.trim())
      .filter(Boolean);
  }

  async listRecoverableJobs(): Promise<ShortyJob[]> {
    const jobs = await this.listJobs();
    return jobs.filter((job) =>
      ["queued", "writing", "sourcing", "voicing", "captioning", "rendering", "uploading"].includes(job.status)
    );
  }
}

export function resetJobForOperation(job: ShortyJob, operation: JobOperation): ShortyJob {
  const at = nowIso();

  if (operation === "regenerate-audio") {
    return {
      ...job,
      operation,
      status: "queued",
      error: undefined,
      audio: {
        ...job.audio,
        sourcePath: undefined,
        durationSeconds: undefined
      },
      captions: {
        cues: [],
        assPath: undefined
      },
      render: {},
      youtube: {},
      events: [
        ...job.events,
        {
          at,
          type: "regenerate-audio",
          message: "Ses, altyazi, render ve yukleme yeniden hazirlaniyor."
        }
      ]
    };
  }

  if (operation === "regenerate-visuals") {
    return {
      ...job,
      operation,
      status: "queued",
      error: undefined,
      assets: {
        clips: [],
        fallbackVisuals: false,
        localMusicPath: job.assets.localMusicPath,
        generatedMusicPath: job.assets.generatedMusicPath
      },
      render: {},
      youtube: {},
      events: [
        ...job.events,
        {
          at,
          type: "regenerate-visuals",
          message: "Gorseller, render ve yukleme yeniden hazirlaniyor."
        }
      ]
    };
  }

  return {
    ...job,
    operation: "full"
  };
}
