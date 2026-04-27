import { eq, and } from "drizzle-orm";
import { db } from "../../db.js";
import { discoveryRuns, discoveryCandidates } from "../../schema.js";
import { normalizeUrl } from "./urlNormalize.js";
import { classifyPage } from "./pageClassifier.js";
import { dedupeEffectiveCaptureUrls } from "./captureUrlNormalization.js";

function toId(id: string): number {
  return parseInt(id, 10);
}

function isValidId(id: unknown): id is string {
  if (!id || typeof id !== "string") return false;
  const n = parseInt(id, 10);
  return !isNaN(n) && n > 0 && String(n) === id;
}

export interface ApproveDiscoveryRunParams {
  approvedCandidateIds?: string[];
  excludedCandidateIds?: string[];
  manualUrls?: string[];
}

export interface ApproveDiscoveryRunResult {
  ok: boolean;
  approvedUrls: string[];
}

export function approveDiscoveryRun(
  runId: string,
  params: ApproveDiscoveryRunParams
): ApproveDiscoveryRunResult {
  const run = db
    .select()
    .from(discoveryRuns)
    .where(eq(discoveryRuns.id, toId(runId)))
    .get();

  if (!run) throw Object.assign(new Error("Discovery run not found"), { code: "NOT_FOUND" });

  const approvedIds = (params.approvedCandidateIds ?? []).filter(isValidId).map(toId);
  const excludedIds = (params.excludedCandidateIds ?? []).filter(isValidId).map(toId);

  // Treat each submission as the current selection, not additive history.
  db.update(discoveryCandidates)
    .set({ isApproved: false })
    .where(eq(discoveryCandidates.discoveryRunId, run.id))
    .run();

  for (const cid of approvedIds) {
    db.update(discoveryCandidates)
      .set({ isApproved: true })
      .where(and(eq(discoveryCandidates.id, cid), eq(discoveryCandidates.discoveryRunId, run.id)))
      .run();
  }

  for (const cid of excludedIds) {
    db.update(discoveryCandidates)
      .set({ isExcluded: true })
      .where(and(eq(discoveryCandidates.id, cid), eq(discoveryCandidates.discoveryRunId, run.id)))
      .run();
  }

  const manualUrls = (params.manualUrls ?? []).filter((u) => typeof u === "string");
  const now = new Date();

  for (const rawUrl of manualUrls) {
    const norm = normalizeUrl(rawUrl);
    if (!norm) continue;
    const classification = classifyPage(norm.path);
    try {
      db.insert(discoveryCandidates)
        .values({
          discoveryRunId: run.id,
          projectId: run.projectId,
          url: rawUrl,
          normalizedUrl: norm.url,
          host: norm.host,
          path: norm.path,
          source: "manual",
          pageType: classification.pageType,
          patternKey: classification.patternKey,
          score: 0,
          reasonsJson: JSON.stringify(["manual"]),
          depth: 0,
          isRecommended: false,
          isApproved: true,
          isExcluded: false,
          createdAt: now,
        })
        .run();
    } catch (err) {
      // Unique constraint on (runId, normalizedUrl) — manual URL may already exist
      if (err && typeof err === "object" && (err as any).message?.includes("UNIQUE")) {
        db.update(discoveryCandidates)
          .set({ isApproved: true })
          .where(
            and(
              eq(discoveryCandidates.discoveryRunId, run.id),
              eq(discoveryCandidates.normalizedUrl, norm.url)
            )
          )
          .run();
      } else {
        throw err;
      }
    }
  }

  const approvedCount = db
    .select({ count: discoveryCandidates.id })
    .from(discoveryCandidates)
    .where(
      and(eq(discoveryCandidates.discoveryRunId, run.id), eq(discoveryCandidates.isApproved, true))
    )
    .all().length;

  db.update(discoveryRuns)
    .set({ approvedCount })
    .where(eq(discoveryRuns.id, run.id))
    .run();

  const approvedRows = db
    .select({ url: discoveryCandidates.normalizedUrl })
    .from(discoveryCandidates)
    .where(
      and(eq(discoveryCandidates.discoveryRunId, run.id), eq(discoveryCandidates.isApproved, true))
    )
    .all();

  return {
    ok: true,
    approvedUrls: dedupeEffectiveCaptureUrls(approvedRows.map((r) => r.url)),
  };
}
