import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config";
import { JobStore } from "./store/job-store";
import { GeminiClient } from "./services/gemini-client";
import { PexelsClient } from "./services/pexels-client";
import { RenderService } from "./services/render-service";
import { YouTubeClient } from "./services/youtube-client";
import { JobRunner } from "./services/job-runner";

interface CliOptions {
  seedTopic?: string;
  privacy: "private" | "unlisted";
}

function parseArgs(argv: string[]): CliOptions {
  let seedTopic: string | undefined;
  let privacy: "private" | "unlisted" = "private";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--seedTopic" || arg === "--seed-topic") {
      seedTopic = argv[index + 1]?.trim() || undefined;
      index += 1;
      continue;
    }
    if (arg === "--privacy") {
      const value = argv[index + 1];
      if (value === "private" || value === "unlisted") {
        privacy = value;
      }
      index += 1;
    }
  }

  return { seedTopic, privacy };
}

async function writeSummary(summary: unknown): Promise<string> {
  const summaryPath = path.join(config.dataDir, "headless-last-run.json");
  await fs.mkdir(path.dirname(summaryPath), { recursive: true });
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return summaryPath;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const store = new JobStore(config.dataDir, config.publicBaseUrl, config.shortyVoiceName);
  await store.initialize();

  const geminiClient = new GeminiClient(config);
  const pexelsClient = new PexelsClient(config);
  const renderService = new RenderService(config, config.dataDir);
  const youtubeClient = new YouTubeClient(config);
  const runner = new JobRunner(store, geminiClient, pexelsClient, renderService, youtubeClient, config);

  const job = await store.createJob({
    seedTopic: options.seedTopic,
    privacy: options.privacy,
    trigger: "n8n"
  });

  try {
    await runner.run(job.id);
  } catch {
    // Final state is persisted by JobRunner.
  }

  const finalJob = await store.requireJob(job.id);
  const summary = {
    id: finalJob.id,
    status: finalJob.status,
    topic: finalJob.content.topic,
    title: finalJob.content.title,
    previewPath: finalJob.render.videoPath,
    youtubeUrl: finalJob.youtube.url,
    studioUrl: finalJob.youtube.studioUrl,
    error: finalJob.error
  };
  const summaryPath = await writeSummary(summary);

  console.log(JSON.stringify({ summaryPath, ...summary }, null, 2));

  if (finalJob.status !== "uploaded_private") {
    process.exitCode = 1;
  }
}

void main().catch(async (error) => {
  await writeSummary({
    status: "failed",
    error: error instanceof Error ? error.message : String(error)
  });
  console.error(error);
  process.exitCode = 1;
});
