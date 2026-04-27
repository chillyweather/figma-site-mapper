import { describe, it, expect, vi } from "vitest";
import { createJobDispatcher } from "./jobDispatcher.js";

function makeJob(type: string | undefined, extraData: Record<string, unknown> = {}) {
  return { id: "test-job-1", data: { type, ...extraData } } as any;
}

describe("createJobDispatcher", () => {
  it("calls the handler registered for the job type", async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const dispatch = createJobDispatcher({ "inventory-prepare": handler });
    await dispatch(makeJob("inventory-prepare", { projectId: "1" }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("passes the full job to the handler", async () => {
    const handler = vi.fn().mockResolvedValue(null);
    const dispatch = createJobDispatcher({ "inventory-prepare": handler });
    const job = makeJob("inventory-prepare", { projectId: "42" });
    await dispatch(job);
    expect(handler).toHaveBeenCalledWith(job);
  });

  it("calls the default handler when type has no registered handler", async () => {
    const crawlHandler = vi.fn().mockResolvedValue({ pages: 3 });
    const dispatch = createJobDispatcher({}, crawlHandler);
    await dispatch(makeJob(undefined));
    expect(crawlHandler).toHaveBeenCalledOnce();
  });

  it("prefers a registered handler over the default", async () => {
    const specific = vi.fn().mockResolvedValue("specific");
    const fallback = vi.fn().mockResolvedValue("fallback");
    const dispatch = createJobDispatcher({ "inventory-prepare": specific }, fallback);
    await dispatch(makeJob("inventory-prepare"));
    expect(specific).toHaveBeenCalledOnce();
    expect(fallback).not.toHaveBeenCalled();
  });

  it("throws when no handler matches and there is no default", async () => {
    const dispatch = createJobDispatcher({});
    await expect(dispatch(makeJob("unknown-type"))).rejects.toThrow("unknown-type");
  });

  it("returns the handler result", async () => {
    const dispatch = createJobDispatcher({ "inventory-prepare": async () => ({ built: true }) });
    const result = await dispatch(makeJob("inventory-prepare"));
    expect(result).toEqual({ built: true });
  });
});
