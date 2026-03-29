import path from "node:path";
import express, { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AppConfig } from "./config";
import { resetJobForOperation, JobStore } from "./store/job-store";
import { PexelsClient } from "./services/pexels-client";
import { YouTubeClient } from "./services/youtube-client";

const createJobSchema = z.object({
  seedTopic: z.string().trim().max(140).optional(),
  privacy: z.enum(["private", "unlisted"]).default("private"),
  trigger: z.enum(["pwa", "n8n"]).default("pwa")
});

function buildTokenFromRequest(request: Request): string {
  const headerValue = request.header("x-shorty-token");
  if (headerValue) {
    return headerValue.trim();
  }

  const queryValue = request.query.token;
  if (typeof queryValue === "string") {
    return queryValue.trim();
  }

  return "";
}

export function createApp({
  config,
  store,
  queue,
  pexelsClient,
  youtubeClient
}: {
  config: AppConfig;
  store: JobStore;
  queue: { enqueue(jobId: string): void; isBusy(): boolean };
  pexelsClient: PexelsClient;
  youtubeClient: YouTubeClient;
}) {
  const app = express();
  const publicDir = path.join(__dirname, "..", "public");

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.get("/api/auth/status", (_request, response) => {
    response.json({
      tokenRequired: Boolean(config.adminToken),
      username: config.adminUsername
    });
  });

  app.use((request: Request, response: Response, next: NextFunction) => {
    if (!config.adminToken) {
      next();
      return;
    }

    if (request.path === "/api/auth/status") {
      next();
      return;
    }

    if (!request.path.startsWith("/api") && !request.path.startsWith("/media")) {
      next();
      return;
    }

    const token = buildTokenFromRequest(request);
    if (token && token === config.adminToken) {
      next();
      return;
    }

    response.status(401).json({
      error: "Unauthorized"
    });
  });

  app.get("/api/system", (_request, response) => {
    response.json({
      queueBusy: queue.isBusy(),
      integrations: {
        gemini: Boolean(config.geminiApiKey),
        pexels: pexelsClient.isConfigured(),
        youtube: youtubeClient.isConfigured()
      }
    });
  });

  app.get("/api/jobs", async (_request, response, next) => {
    try {
      const jobs = await store.listJobs();
      response.json({
        jobs: jobs.map((job) => store.toSummary(job))
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/jobs", async (request, response, next) => {
    try {
      const payload = createJobSchema.parse(request.body ?? {});
      const job = await store.createJob({
        seedTopic: payload.seedTopic,
        privacy: payload.privacy,
        trigger: payload.trigger
      });
      queue.enqueue(job.id);
      response.status(202).json({
        job: await store.requireJob(job.id)
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/jobs/:jobId", async (request, response, next) => {
    try {
      const job = await store.getJob(request.params.jobId);
      if (!job) {
        response.status(404).json({ error: "Not found" });
        return;
      }
      response.json({ job });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/jobs/:jobId/regenerate-audio", async (request, response, next) => {
    try {
      const existing = await store.requireJob(request.params.jobId);
      const updated = await store.saveJob(resetJobForOperation(existing, "regenerate-audio"));
      queue.enqueue(updated.id);
      response.status(202).json({ job: updated });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/jobs/:jobId/regenerate-visuals", async (request, response, next) => {
    try {
      const existing = await store.requireJob(request.params.jobId);
      const updated = await store.saveJob(resetJobForOperation(existing, "regenerate-visuals"));
      queue.enqueue(updated.id);
      response.status(202).json({ job: updated });
    } catch (error) {
      next(error);
    }
  });

  app.get("/media/jobs/:jobId/final.mp4", async (request, response, next) => {
    try {
      const job = await store.requireJob(request.params.jobId);
      if (!job.render.videoPath) {
        response.status(404).json({ error: "Preview not ready" });
        return;
      }
      response.sendFile(job.render.videoPath);
    } catch (error) {
      next(error);
    }
  });

  app.use(express.static(publicDir, { extensions: ["html"] }));

  app.get("*", (_request, response) => {
    response.sendFile(path.join(publicDir, "index.html"));
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : "Internal server error";
    const issues =
      error && typeof error === "object" && "issues" in error ? (error as { issues?: unknown }).issues : undefined;
    response.status(400).json({
      error: message,
      issues
    });
  });

  return app;
}
