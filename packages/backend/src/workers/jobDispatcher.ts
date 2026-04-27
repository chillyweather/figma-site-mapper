import type { Job } from "bullmq";

export type JobHandler = (job: Job) => Promise<unknown>;

export function createJobDispatcher(
  handlers: Record<string, JobHandler>,
  defaultHandler?: JobHandler
): (job: Job) => Promise<unknown> {
  return async (job: Job) => {
    const type: string | undefined = job.data?.type;
    const handler = (type && handlers[type]) || defaultHandler;
    if (!handler) {
      throw new Error(`No handler registered for job type: ${type}`);
    }
    return handler(job);
  };
}
