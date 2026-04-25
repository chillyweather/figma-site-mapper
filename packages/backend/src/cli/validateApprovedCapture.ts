import "../logger.js";
import { createServer } from "node:http";
import { buildServer } from "../app.js";
import { db } from "../db.js";
import { crawlQueue } from "../queue.js";
import { projects, discoveryRuns, discoveryCandidates, crawlRuns, pages, elements } from "../schema.js";
import { eq } from "drizzle-orm";

function assertEqual(actual: unknown, expected: unknown, label: string): boolean {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    process.stderr.write(`  ❌ ${label}\n     expected: ${e}\n     actual:   ${a}\n`);
    return false;
  }
  process.stdout.write(`  ✅ ${label}\n`);
  return true;
}

function assertTrue(condition: boolean, label: string): boolean {
  if (!condition) {
    process.stderr.write(`  ❌ ${label}\n`);
    return false;
  }
  process.stdout.write(`  ✅ ${label}\n`);
  return true;
}

async function startFixtureServer(): Promise<{ origin: string; close: () => Promise<void> }> {
  const fixtureServer = createServer((req, res) => {
    const path = req.url?.split("?")[0] ?? "/";
    res.setHeader("content-type", "text/html; charset=utf-8");
    if (path === "/" || path === "/page-a" || path === "/page-b") {
      res.end(`<html><head><title>${path}</title></head><body><h1>${path}</h1><a href="/not-approved">Ignored</a></body></html>`);
      return;
    }
    res.statusCode = 404;
    res.end("<html><body>Not found</body></html>");
  });

  await new Promise<void>((resolve, reject) => {
    fixtureServer.once("error", reject);
    fixtureServer.listen(0, "127.0.0.1", () => resolve());
  });

  const address = fixtureServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start fixture server");
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => {
      fixtureServer.close((err) => err ? reject(err) : resolve());
    }),
  };
}

async function main(): Promise<void> {
  process.stdout.write("\nStage E: Approved Capture Crawl Validation\n\n");

  const server = await buildServer();

  // Create a test project
  const createRes = await server.inject({
    method: "POST",
    url: "/projects",
    payload: { name: "__test_approved_capture" },
  });
  const project = JSON.parse(createRes.body).project;
  const projectId = String(project.id);
  process.stdout.write(`Created test project ${projectId}\n`);

  let passed = 0;
  let failed = 0;

  function check(ok: boolean) {
    if (ok) passed++; else failed++;
  }

  // Create a discovery run directly
  const now = new Date();
  const [runRow] = db
    .insert(discoveryRuns)
    .values({
      projectId: project.id,
      startUrl: "https://example.com",
      status: "completed",
      settingsJson: "{}",
      startedAt: now,
      completedAt: now,
    })
    .returning()
    .all();
  const discoveryRunId = String(runRow!.id);

  // Insert some candidates
  const fixture = await startFixtureServer();
  const candidateUrls = [
    `${fixture.origin}/`,
    `${fixture.origin}/page-a`,
    `${fixture.origin}/page-b`,
  ];
  for (const url of candidateUrls) {
    db.insert(discoveryCandidates)
      .values({
        discoveryRunId: runRow!.id,
        projectId: project.id,
        url,
        normalizedUrl: url,
        host: new URL(url).host,
        path: new URL(url).pathname,
        source: "seed",
        pageType: "unknown",
        patternKey: "unknown:*",
        score: 0,
        reasonsJson: "[]",
        createdAt: now,
      })
      .run();
  }

  // Test invalid projectId
  const invalidRes = await server.inject({
    method: "POST",
    url: "/crawl/approved",
    payload: {
      projectId: "abc",
      discoveryRunId,
      approvedUrls: candidateUrls,
    },
  });
  check(assertEqual(invalidRes.statusCode, 400, "invalid projectId returns 400"));

  // Test missing approvedUrls
  const missingUrlsRes = await server.inject({
    method: "POST",
    url: "/crawl/approved",
    payload: {
      projectId,
      discoveryRunId,
    },
  });
  check(assertEqual(missingUrlsRes.statusCode, 400, "missing approvedUrls returns 400"));

  // Test nonexistent discovery run
  const badRunRes = await server.inject({
    method: "POST",
    url: "/crawl/approved",
    payload: {
      projectId,
      discoveryRunId: "999999",
      approvedUrls: candidateUrls,
    },
  });
  check(assertEqual(badRunRes.statusCode, 404, "nonexistent discovery run returns 404"));

  const unknownUrlRes = await server.inject({
    method: "POST",
    url: "/crawl/approved",
    payload: {
      projectId,
      discoveryRunId,
      approvedUrls: [...candidateUrls, `${fixture.origin}/not-in-run`],
    },
  });
  check(assertEqual(unknownUrlRes.statusCode, 400, "approved URL outside discovery run returns 400"));

  // Test valid POST /crawl/approved
  const approvedRes = await server.inject({
    method: "POST",
    url: "/crawl/approved",
    payload: {
      projectId,
      discoveryRunId,
      approvedUrls: [...candidateUrls, candidateUrls[0]],
      fullRefresh: true,
    },
  });
  check(assertEqual(approvedRes.statusCode, 200, "POST /crawl/approved returns 200"));

  const approvedBody = JSON.parse(approvedRes.body);
  check(assertTrue(!!approvedBody.jobId, "jobId returned"));
  check(assertEqual(approvedBody.approvedCount, 3, "approvedCount is deduped to 3"));
  const queuedJob = await crawlQueue.getJob(String(approvedBody.jobId));
  check(assertEqual(queuedJob?.data.maxRequestsPerCrawl, 3, "queued approved crawl limit equals approved URL count"));
  check(assertEqual(queuedJob?.data.approvedUrls?.length, 3, "queued approved crawl carries exactly 3 allowlisted URLs"));
  check(assertEqual(queuedJob?.data.renderInteractiveHighlights, false, "approved crawl disables automatic interactive highlight rendering"));
  check(assertEqual(queuedJob?.data.styleExtraction?.enabled, true, "approved crawl defaults style extraction on"));
  check(assertEqual(queuedJob?.data.styleExtraction?.preset, "smart", "approved crawl defaults smart style extraction"));

  // Verify crawl run record was created with discoveryRunId and approvedUrlsJson
  // Note: crawl run is created by the worker when it processes the job.
  // In this test, the job is queued but the worker isn't running, so we verify
  // the job data by checking the queue directly if possible, or we run the crawler synchronously.

  // For a stronger test, run the crawler directly with approvedUrls against example.com
  process.stdout.write("\nRunning direct crawler test with allowlist...\n");

  const { runCrawler } = await import("../crawler.js");

  // Clean any existing pages for this project
  db.delete(pages).where(eq(pages.projectId, project.id)).run();

  const firstCandidateUrl = candidateUrls[0];
  if (!firstCandidateUrl) {
    throw new Error("Fixture candidate URLs were not initialized");
  }

  const crawlResult = await runCrawler(
    firstCandidateUrl,
    "http://localhost:3006",
    10,
    1,
    undefined,
    0,
    1000,
    undefined,
    false,
    0,
    false,
    true,
    true,
    false,
    true,
    projectId,
    undefined,
    undefined,
    undefined,
    candidateUrls
  );

  check(assertEqual(crawlResult.pageCount, 3, "crawler with allowlist captures exactly 3 pages"));
  check(assertEqual(crawlResult.visitedUrls.length, 3, "crawler visits exactly 3 URLs"));

  const dbPages = db
    .select()
    .from(pages)
    .where(eq(pages.projectId, project.id))
    .all();
  check(assertEqual(dbPages.length, 3, "DB contains exactly 3 pages for project"));

  // Cleanup
  process.stdout.write("\nCleaning up test project...\n");
  // Delete elements first (FK to pages), then pages, then other tables, then project
  const pageIds = db
    .select({ id: pages.id })
    .from(pages)
    .where(eq(pages.projectId, project.id))
    .all();
  for (const p of pageIds) {
    db.delete(elements).where(eq(elements.pageId, p.id)).run();
  }
  db.delete(pages).where(eq(pages.projectId, project.id)).run();
  db.delete(crawlRuns).where(eq(crawlRuns.projectId, project.id)).run();
  db.delete(discoveryCandidates).where(eq(discoveryCandidates.projectId, project.id)).run();
  db.delete(discoveryRuns).where(eq(discoveryRuns.projectId, project.id)).run();
  db.delete(projects).where(eq(projects.id, project.id)).run();
  await fixture.close();

  process.stdout.write(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write(`Unexpected error: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
