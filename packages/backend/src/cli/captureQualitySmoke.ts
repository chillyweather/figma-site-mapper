import "../logger.js";
import fs from "node:fs/promises";
import path from "node:path";
import {
  applyStealthContextDefaults,
  getStealthLauncher,
  pickStealthUserAgent,
} from "../services/capture/stealthLauncher.js";
import { captureHighFidelity } from "../services/capture/highFidelityCapture.js";
import { scoreSuspiciousRegions } from "../services/capture/blankRegionDetector.js";
import type { ReadinessReport } from "../services/capture/pageReadyDetector.js";

const OUT_ROOT = path.resolve(process.cwd(), "tmp", "smoke-matrix");

// ── URL matrix ───────────────────────────────────────────────────────────────
// Atera-style: dynamic marketing pages with lazy JS sections
const ATERA_URLS = [
  "https://www.atera.com/",
  "https://www.atera.com/features/",
  "https://www.atera.com/pricing/",
  "https://www.atera.com/blog/",
];

// Control: already-good sites that should continue rendering cleanly
const CONTROL_URLS = [
  "https://linear.app/",
  "https://stripe.com/",
  "https://vercel.com/",
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface CaptureRun {
  url: string;
  group: "atera" | "control";
  runIndex: number;
  durationMs: number;
  screenshotPath?: string;
  suspiciousScore: number;
  retryCount: number;
  qualityStatus: string;
  readinessSignals: Record<string, string>;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function slugify(url: string, runIndex: number): string {
  return (
    url
      .replace(/^https?:\/\//, "")
      .replace(/[^a-zA-Z0-9.-]+/g, "_")
      .replace(/_+$/g, "")
      .slice(0, 60) + `_run${runIndex}`
  );
}

function qualityStatusFromResult(
  score: number,
  retryCount: number,
  threshold = 0.1
): string {
  if (retryCount === 0) return score > threshold ? "suspicious" : "clean";
  return score > threshold ? "retry_unchanged" : "retry_improved";
}

function signalsLine(r: Record<string, string>): string {
  return Object.entries(r)
    .map(([k, v]) => `${k[0]}=${v === "fired" ? "✓" : "✗"}`)
    .join(" ");
}

// ── Single capture ────────────────────────────────────────────────────────────
async function smokeOne(
  url: string,
  group: "atera" | "control",
  runIndex: number
): Promise<CaptureRun> {
  const start = Date.now();
  const launcher = getStealthLauncher();
  const browser = await launcher.launch({ headless: true });
  const slug = slugify(url, runIndex);
  const screenshotPath = path.join(OUT_ROOT, group, `${slug}.png`);

  try {
    const context = await browser.newContext({
      userAgent: pickStealthUserAgent(),
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    await applyStealthContextDefaults(context);
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });

      const result = await captureHighFidelity(page, {
        readiness: {
          visualStabilityQuietWindowMs: 1200,
          overallTimeoutMs: 60_000,
        },
        suspiciousRegionThreshold: 0.1,
      });

      await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
      await fs.writeFile(screenshotPath, result.buffer);

      const qualityStatus = qualityStatusFromResult(
        result.suspiciousRegionScore,
        result.retryCount
      );

      return {
        url,
        group,
        runIndex,
        durationMs: Date.now() - start,
        screenshotPath,
        suspiciousScore: result.suspiciousRegionScore,
        retryCount: result.retryCount,
        qualityStatus,
        readinessSignals: result.readinessReport as unknown as Record<string, string>,
      };
    } finally {
      await page.close().catch(() => undefined);
      await context.close().catch(() => undefined);
    }
  } catch (error) {
    return {
      url,
      group,
      runIndex,
      durationMs: Date.now() - start,
      suspiciousScore: -1,
      retryCount: 0,
      qualityStatus: "error",
      readinessSignals: {},
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await browser.close().catch(() => undefined);
  }
}

// ── Consistency comparison ────────────────────────────────────────────────────
async function compareConsistency(
  run1: CaptureRun,
  run2: CaptureRun
): Promise<{ scoreDelta: number; pixelDiff: string }> {
  const scoreDelta = Math.abs(run1.suspiciousScore - run2.suspiciousScore);
  // Simple heuristic: if both scores are close and both clean → consistent
  const pixelDiff =
    scoreDelta < 0.05 ? "consistent" : scoreDelta < 0.15 ? "minor-variance" : "inconsistent";
  return { scoreDelta, pixelDiff };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const argUrls = process.argv.slice(2).filter((a) => a.startsWith("http"));
  const extraAtera = argUrls.length > 0 ? argUrls : [];

  const matrix: Array<{ url: string; group: "atera" | "control" }> = [
    ...ATERA_URLS.map((url) => ({ url, group: "atera" as const })),
    ...extraAtera.map((url) => ({ url, group: "atera" as const })),
    ...CONTROL_URLS.map((url) => ({ url, group: "control" as const })),
  ];

  const totalCaptures = matrix.length * 2;
  process.stdout.write(
    `\n🧪 Capture-quality smoke matrix — ${matrix.length} URLs × 2 runs = ${totalCaptures} captures\n\n`
  );

  // Run 2 captures per URL sequentially
  const runsByUrl = new Map<string, CaptureRun[]>();

  for (let i = 0; i < matrix.length; i++) {
    const { url, group } = matrix[i]!;
    process.stdout.write(`[${i + 1}/${matrix.length}] ${url}\n`);
    const runs: CaptureRun[] = [];

    for (const runIndex of [0, 1]) {
      process.stdout.write(`  run ${runIndex + 1}/2 …`);
      const run = await smokeOne(url, group, runIndex);
      runs.push(run);

      if (run.error) {
        process.stdout.write(` ❌ error: ${run.error} (${run.durationMs}ms)\n`);
      } else {
        process.stdout.write(
          ` ${run.qualityStatus === "clean" || run.qualityStatus === "retry_improved" ? "✅" : "⚠️ "} ` +
            `status=${run.qualityStatus} score=${run.suspiciousScore.toFixed(3)} ` +
            `retries=${run.retryCount} (${run.durationMs}ms)\n`
        );
        process.stdout.write(`     signals: ${signalsLine(run.readinessSignals)}\n`);
        process.stdout.write(`     → ${run.screenshotPath}\n`);
      }
    }

    if (runs[0] && runs[1] && !runs[0].error && !runs[1].error) {
      const { scoreDelta, pixelDiff } = await compareConsistency(runs[0], runs[1]);
      process.stdout.write(
        `  consistency: ${pixelDiff} (score delta=${scoreDelta.toFixed(3)})\n`
      );
    }

    runsByUrl.set(url, runs);
    process.stdout.write("\n");
  }

  // ── Summary table ──────────────────────────────────────────────────────────
  process.stdout.write("─".repeat(80) + "\n");
  process.stdout.write("SUMMARY\n");
  process.stdout.write("─".repeat(80) + "\n\n");

  const issues: string[] = [];

  for (const [url, runs] of runsByUrl) {
    const group = runs[0]?.group ?? "?";
    const label = `[${group}]`;
    const statuses = runs.map((r) => r.qualityStatus);
    const scores = runs
      .filter((r) => !r.error)
      .map((r) => r.suspiciousScore.toFixed(3));
    const retries = runs.filter((r) => !r.error && r.retryCount > 0).length;
    const errors = runs.filter((r) => !!r.error).length;

    const overallOk =
      errors === 0 &&
      statuses.every((s) => s === "clean" || s === "retry_improved");

    const icon = overallOk ? "✅" : "⚠️ ";
    process.stdout.write(
      `${icon} ${label.padEnd(10)} ${url}\n` +
        `   statuses: ${statuses.join(", ")}  scores: ${scores.join(", ")}` +
        (retries > 0 ? `  retries triggered: ${retries}` : "") +
        (errors > 0 ? `  errors: ${errors}` : "") +
        "\n\n"
    );

    if (!overallOk) {
      if (errors > 0) {
        issues.push(`${url}: capture error — ${runs.find((r) => r.error)?.error}`);
      } else if (statuses.some((s) => s === "retry_unchanged" || s === "suspicious")) {
        issues.push(`${url}: suspicious regions not resolved after retry`);
      } else if (statuses.some((s) => s === "inconsistent")) {
        issues.push(`${url}: inconsistent results between runs`);
      }
    }
  }

  process.stdout.write("─".repeat(80) + "\n");
  if (issues.length === 0) {
    process.stdout.write("✅ All captures clean — no follow-up issues needed.\n\n");
  } else {
    process.stdout.write(`⚠️  ${issues.length} issue(s) to review:\n`);
    for (const issue of issues) {
      process.stdout.write(`  • ${issue}\n`);
    }
    process.stdout.write(
      "\nReview screenshots in tmp/smoke-matrix/ and file follow-up issues for any\n" +
        "unexplained missing-section failures.\n\n"
    );
  }

  process.stdout.write(`Screenshots saved to: ${OUT_ROOT}/\n\n`);
}

main().catch((error) => {
  process.stderr.write(
    `smoke matrix failed: ${error instanceof Error ? error.stack : String(error)}\n`
  );
  process.exit(1);
});
