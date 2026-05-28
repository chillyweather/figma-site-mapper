import { describe, it, expect } from "vitest";
import { serializePage } from "./manifestBuilder.js";
import type { pages } from "../schema.js";

type PageRow = typeof pages.$inferSelect;

function makeRow(overrides: Partial<PageRow> = {}): PageRow {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: 42,
    projectId: 7,
    url: "https://example.com",
    title: "Example",
    screenshotPaths: "[]",
    interactiveElements: "[]",
    globalStyles: null,
    annotatedScreenshotPath: null,
    viewportWidth: 1920,
    blockReason: null,
    captureQualityJson: null,
    lastCrawledAt: now,
    lastCrawlJobId: null,
    lastCrawlRunId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("serializePage", () => {
  it("surfaces blockReason as null on a normal page", () => {
    const serialized = serializePage(makeRow());
    expect(serialized.blockReason).toBeNull();
  });

  it("surfaces blockReason string when set", () => {
    const serialized = serializePage(
      makeRow({ blockReason: "Cloudflare interstitial block page" })
    );
    expect(serialized.blockReason).toBe("Cloudflare interstitial block page");
  });

  it("does not change the _id / id shape", () => {
    const serialized = serializePage(makeRow());
    expect(serialized._id).toBe("42");
    expect(serialized.id).toBe(42);
  });
});
