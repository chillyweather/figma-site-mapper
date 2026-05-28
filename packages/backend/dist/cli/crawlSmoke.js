import "../logger.js";
import fs from "node:fs/promises";
import path from "node:path";
import { applyStealthContextDefaults, getStealthLauncher, pickStealthUserAgent, } from "../services/capture/stealthLauncher.js";
import { classifyPage } from "../services/capture/blockClassifier.js";
const SMOKE_ROOT = path.resolve(process.cwd(), "tmp", "smoke");
function slugify(url) {
    return url
        .replace(/^https?:\/\//, "")
        .replace(/[^a-zA-Z0-9.-]+/g, "_")
        .replace(/_+$/g, "")
        .slice(0, 80);
}
async function smokeOne(url) {
    const start = Date.now();
    const launcher = getStealthLauncher();
    const browser = await launcher.launch({ headless: true });
    try {
        const context = await browser.newContext({
            userAgent: pickStealthUserAgent(),
            viewport: { width: 1920, height: 1080 },
            deviceScaleFactor: 2,
        });
        await applyStealthContextDefaults(context);
        const page = await context.newPage();
        try {
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
            await page
                .waitForLoadState("networkidle", { timeout: 10000 })
                .catch(() => undefined);
            const classification = await classifyPage(page);
            const durationMs = Date.now() - start;
            if (classification.kind !== "ok") {
                return {
                    url,
                    kind: classification.kind,
                    provider: classification.provider,
                    reason: classification.reason,
                    durationMs,
                };
            }
            const screenshotPath = path.join(SMOKE_ROOT, `${slugify(url)}.png`);
            await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
            await page.screenshot({ path: screenshotPath, fullPage: true });
            return {
                url,
                kind: "ok",
                reason: null,
                screenshotPath,
                durationMs: Date.now() - start,
            };
        }
        finally {
            await page.close().catch(() => undefined);
            await context.close().catch(() => undefined);
        }
    }
    catch (error) {
        return {
            url,
            kind: "error",
            error: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - start,
        };
    }
    finally {
        await browser.close().catch(() => undefined);
    }
}
function format(result, index, total) {
    const header = `[${index + 1}/${total}] ${result.url}  (${result.durationMs}ms)`;
    const lines = [header, `  → kind: ${result.kind}`];
    if (result.provider)
        lines.push(`  → provider: ${result.provider}`);
    if (result.reason)
        lines.push(`  → reason: ${result.reason}`);
    if (result.screenshotPath)
        lines.push(`  → screenshot: ${result.screenshotPath}`);
    if (result.error)
        lines.push(`  → error: ${result.error}`);
    return lines.join("\n");
}
async function main() {
    const urls = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
    if (urls.length === 0) {
        process.stderr.write("Usage: pnpm --filter backend crawl:smoke <url> [<url> ...]\n\n" +
            "Runs each URL through the stealth launcher + classifier and either\n" +
            "saves a fullPage screenshot or prints the blockReason.\n" +
            "Issue #13 acceptance smoke: include >=3 previously-blocked targets\n" +
            "and >=3 previously-working targets.\n");
        process.exit(2);
    }
    process.stdout.write(`\nSmoke crawl of ${urls.length} URL(s)\n\n`);
    const results = [];
    for (let i = 0; i < urls.length; i++) {
        const result = await smokeOne(urls[i]);
        process.stdout.write(`${format(result, i, urls.length)}\n\n`);
        results.push(result);
    }
    const byKind = new Map();
    for (const r of results) {
        byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);
    }
    process.stdout.write("Summary:\n");
    for (const [kind, count] of byKind) {
        process.stdout.write(`  ${kind}: ${count}\n`);
    }
    const blockedUrls = results.filter((r) => r.kind !== "ok" && r.kind !== "error");
    const okUrls = results.filter((r) => r.kind === "ok");
    process.stdout.write(`\n  ok: ${okUrls.length} / ${results.length}\n`);
    process.stdout.write(`  recorded block reason: ${blockedUrls.length} / ${results.length}\n\n`);
    if (results.some((r) => r.kind === "error")) {
        process.stdout.write("Note: some URLs errored (network/timeout). Re-run them to confirm whether\n" +
            "the issue reproduces. Persistent failures with no block reason are gaps\n" +
            "to file as follow-up issues.\n\n");
    }
}
main().catch((error) => {
    process.stderr.write(`smoke crawl failed: ${error instanceof Error ? error.stack : String(error)}\n`);
    process.exit(1);
});
