#!/usr/bin/env node
/**
 * Atera repeatability smoke matrix (Issue 50)
 *
 * HUMAN-IN-THE-LOOP: This script captures a set of matrix URLs twice using
 * the visual-complete profile and writes screenshots + diagnostics to disk.
 * The resulting screenshots MUST be visually reviewed by a human before the
 * parent PRD is considered implementation-complete.
 *
 * Usage:
 *   pnpm --filter backend run atera-smoke
 *
 * Requirements:
 *   - Backend and Redis must be running: `pnpm dev`
 *   - Set BACKEND_URL env var if not on :3006 (default)
 *
 * Matrix targets (as of 2026-05-31):
 *   - https://www.atera.com/                          (homepage, Lottie + animations)
 *   - https://www.atera.com/features/                 (product animation regions)
 *   - https://www.atera.com/customers/                (video/customer-story regions)
 *   - https://stripe.com/                             (control: good baseline)
 *   - https://linear.app/                             (control: good baseline)
 *
 * Review checklist (run after screenshots are generated):
 *   [ ] No large unexplained blank sections (>200px blank band)
 *   [ ] Lottie/product animation regions show a non-blank representative frame
 *   [ ] Video/customer-story regions show a poster or representative frame
 *   [ ] Full-page height looks correct (no premature cutoff)
 *   [ ] captureQuality.mediaDiagnostics has no unexplained blank surfaces
 *   [ ] Two consecutive runs produce materially similar screenshots
 *
 * If any unexplained failures remain after review, file follow-up GitHub issues.
 */

import "../logger.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import { captureTiled } from "../services/capture/tiledCapture.js";
import { applyStealthContextDefaults } from "../services/capture/stealthLauncher.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MATRIX_URLS = [
  "https://www.atera.com/",
  "https://www.atera.com/features/",
  "https://www.atera.com/customers/",
  "https://stripe.com/",
  "https://linear.app/",
];

const OUT_DIR = path.join(__dirname, "..", "..", "tmp", "atera-smoke");
const RUNS = 2;

async function run(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  for (const url of MATRIX_URLS) {
    for (let run = 1; run <= RUNS; run++) {
      console.log(`\n[smoke] Run ${run}/${RUNS}: ${url}`);

      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
      });
      await applyStealthContextDefaults(context);
      const page = await context.newPage();

      try {
        await page.goto(url, { waitUntil: "commit", timeout: 30_000 });

        const result = await captureTiled(page, {
          readiness: { overallTimeoutMs: 45_000, visualStabilityQuietWindowMs: 1_000 },
          lazy: { overallTimeoutMs: 20_000 },
          tileStabilityMs: 600,
          detectMedia: true,
          onProgress: (stage) => console.log(`  [stage] ${stage}`),
        });

        const slug = url
          .replace(/https?:\/\//, "")
          .replace(/[^a-z0-9]/gi, "_")
          .replace(/_+/g, "_")
          .slice(0, 60);
        const outPath = path.join(OUT_DIR, `${slug}_run${run}.png`);
        const diagPath = path.join(OUT_DIR, `${slug}_run${run}.json`);

        fs.writeFileSync(outPath, result.buffer);
        fs.writeFileSync(
          diagPath,
          JSON.stringify(
            {
              url,
              run,
              width: result.width,
              height: result.height,
              tileCount: result.tileCount,
              suspiciousRegionScore: result.suspiciousRegionScore,
              retryCount: result.retryCount,
              mediaDiagnostics: result.mediaDiagnostics,
            },
            null,
            2
          )
        );

        console.log(
          `  → ${result.width}x${result.height}px, ${result.tileCount} tiles, ` +
            `score=${result.suspiciousRegionScore.toFixed(3)}, ` +
            `media: video=${result.mediaDiagnostics?.videoCount ?? 0} ` +
            `lottie=${result.mediaDiagnostics?.lottieCount ?? 0} ` +
            `blank=${result.mediaDiagnostics?.blankCount ?? 0}`
        );
        console.log(`  → screenshot: ${outPath}`);
      } catch (err) {
        console.error(`  ✗ Failed: ${err instanceof Error ? err.message : String(err)}`);
        fs.writeFileSync(
          path.join(
            OUT_DIR,
            `${url.replace(/[^a-z0-9]/gi, "_").slice(0, 50)}_run${run}_ERROR.txt`
          ),
          String(err)
        );
      } finally {
        await context.close();
      }
    }
  }

  await browser.close();
  console.log(`\n[smoke] Done. Screenshots in: ${OUT_DIR}`);
  console.log("[smoke] HUMAN REVIEW REQUIRED — see checklist in src/cli/ateraSmoke.ts");
}

run().catch((err) => {
  console.error("[smoke] Fatal:", err);
  process.exit(1);
});
