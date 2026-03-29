import { ShortyError } from "../lib/errors";
import { JobStore } from "../store/job-store";
import { JobRunner } from "./job-runner";

export class JobQueue {
  private pending = new Set<string>();
  private running = false;

  constructor(private readonly store: JobStore, private readonly runner: JobRunner) {}

  async recoverPendingJobs(): Promise<void> {
    const jobs = await this.store.listRecoverableJobs();
    for (const job of jobs) {
      this.pending.add(job.id);
    }
    void this.drain();
  }

  enqueue(jobId: string): void {
    this.pending.add(jobId);
    void this.drain();
  }

  isBusy(): boolean {
    return this.running || this.pending.size > 0;
  }

  private async drain(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    while (this.pending.size > 0) {
      const nextJobId = this.pending.values().next().value as string;
      this.pending.delete(nextJobId);
      try {
        await this.runner.run(nextJobId);
      } catch (error) {
        if (!(error instanceof ShortyError)) {
          console.error(error);
        }
      }
    }
    this.running = false;
  }
}
