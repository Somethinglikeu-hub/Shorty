import { config } from "./config";
import { createApp } from "./app";
import { JobStore } from "./store/job-store";
import { GeminiClient } from "./services/gemini-client";
import { PexelsClient } from "./services/pexels-client";
import { RenderService } from "./services/render-service";
import { YouTubeClient } from "./services/youtube-client";
import { JobRunner } from "./services/job-runner";
import { JobQueue } from "./services/job-queue";

async function main(): Promise<void> {
  const store = new JobStore(config.dataDir, config.publicBaseUrl, config.shortyVoiceName);
  await store.initialize();

  const geminiClient = new GeminiClient(config);
  const pexelsClient = new PexelsClient(config);
  const renderService = new RenderService(config, config.dataDir);
  const youtubeClient = new YouTubeClient(config);
  const runner = new JobRunner(store, geminiClient, pexelsClient, renderService, youtubeClient, config);
  const queue = new JobQueue(store, runner);
  const app = createApp({
    config,
    store,
    queue,
    pexelsClient,
    youtubeClient
  });

  app.listen(config.port, () => {
    console.log(`Shorty service running on http://localhost:${config.port}`);
  });

  await queue.recoverPendingJobs();
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
