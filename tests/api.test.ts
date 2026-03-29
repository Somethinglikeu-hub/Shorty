import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { AppConfig } from "../src/config";
import { JobStore } from "../src/store/job-store";
import { PexelsClient } from "../src/services/pexels-client";
import { YouTubeClient } from "../src/services/youtube-client";

function createTestConfig(dataDir: string): AppConfig {
  return {
    port: 3000,
    publicBaseUrl: "http://localhost:3000",
    dataDir,
    adminToken: "",
    adminUsername: "admin",
    jobConcurrency: 1,
    ffmpegFontFile: "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    geminiApiKey: "",
    geminiTextModel: "gemini-2.5-flash",
    geminiTtsModel: "gemini-2.5-flash-preview-tts",
    shortyVoiceName: "Sulafat",
    pexelsApiKey: "",
    youtubeClientId: "",
    youtubeClientSecret: "",
    youtubeRedirectUri: "http://localhost",
    youtubeRefreshToken: "",
    youtubeDefaultCategoryId: "22",
    youtubeDefaultLanguage: "tr"
  };
}

describe("api", () => {
  let tempDir = "";
  let store: JobStore;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "shorty-api-"));
    const config = createTestConfig(tempDir);
    store = new JobStore(config.dataDir, config.publicBaseUrl, config.shortyVoiceName);
    await store.initialize();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("creates and lists jobs", async () => {
    const config = createTestConfig(tempDir);
    const queued = [];
    const app = createApp({
      config,
      store,
      queue: {
        enqueue(jobId) {
          queued.push(jobId);
        },
        isBusy() {
          return false;
        }
      },
      pexelsClient: new PexelsClient(config),
      youtubeClient: new YouTubeClient(config)
    });

    const createResponse = await request(app).post("/api/jobs").send({
      seedTopic: "sabah disiplini",
      privacy: "private",
      trigger: "pwa"
    });

    expect(createResponse.status).toBe(202);
    expect(queued.length).toBe(1);
    expect(createResponse.body.job.input.seedTopic).toBe("sabah disiplini");

    const listResponse = await request(app).get("/api/jobs");
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.jobs).toHaveLength(1);
    expect(listResponse.body.jobs[0].status).toBe("queued");
  });
});
