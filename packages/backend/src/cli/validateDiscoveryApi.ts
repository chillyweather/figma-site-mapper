import "../logger.js";
import { buildServer } from "../app.js";
import { db } from "../db.js";
import { projects, discoveryRuns, discoveryCandidates } from "../schema.js";
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

async function main(): Promise<void> {
  process.stdout.write("\nStage D: Discovery API Validation\n\n");

  const server = await buildServer();

  // Create a test project
  const createRes = await server.inject({
    method: "POST",
    url: "/projects",
    payload: { name: "__test_discovery_api" },
  });
  const project = JSON.parse(createRes.body).project;
  const projectId = String(project.id);
  process.stdout.write(`Created test project ${projectId}\n`);

  let passed = 0;
  let failed = 0;

  function check(ok: boolean) {
    if (ok) passed++; else failed++;
  }

  // Test invalid projectId
  const invalidProjectRes = await server.inject({
    method: "POST",
    url: "/discovery/start",
    payload: { projectId: "abc", startUrl: "https://example.com" },
  });
  check(assertEqual(invalidProjectRes.statusCode, 400, "invalid projectId returns 400"));

  // Test missing projectId
  const missingProjectRes = await server.inject({
    method: "POST",
    url: "/discovery/start",
    payload: { startUrl: "https://example.com" },
  });
  check(assertEqual(missingProjectRes.statusCode, 400, "missing projectId returns 400"));

  // Test nonexistent project
  const nonexistentRes = await server.inject({
    method: "POST",
    url: "/discovery/start",
    payload: { projectId: "999999", startUrl: "https://example.com" },
  });
  check(assertEqual(nonexistentRes.statusCode, 404, "nonexistent project returns 404"));

  // Test POST /discovery/start
  const startRes = await server.inject({
    method: "POST",
    url: "/discovery/start",
    payload: {
      projectId,
      startUrl: "https://example.com",
      seedUrls: [
        "https://example.com/",
        "https://example.com/pricing",
        "https://example.com/products/ticketing",
      ],
      maxCandidates: 20,
    },
  });
  check(assertEqual(startRes.statusCode, 200, "POST /discovery/start returns 200"));

  const startBody = JSON.parse(startRes.body);
  check(assertTrue(!!startBody.discoveryRunId, "discoveryRunId returned"));
  check(assertEqual(startBody.status, "completed", "status is completed"));
  check(assertTrue(Array.isArray(startBody.recommended), "recommended array returned"));
  check(assertTrue(startBody.summary.totalCandidates > 0, "summary has candidates"));
  check(assertTrue(
    startBody.recommended.every((c: any) => c.id && c.id !== "0"),
    "recommended candidates have persisted DB ids"
  ));

  const runId = String(startBody.discoveryRunId);

  // Test GET /discovery/:runId
  const getRes = await server.inject({
    method: "GET",
    url: `/discovery/${runId}`,
  });
  check(assertEqual(getRes.statusCode, 200, "GET /discovery/:runId returns 200"));

  const getBody = JSON.parse(getRes.body);
  check(assertEqual(getBody.discoveryRunId, runId, "GET returns correct runId"));
  check(assertTrue(Array.isArray(getBody.candidates), "GET returns candidates array"));
  check(assertTrue(getBody.candidates.length > 0, "GET candidates not empty"));
  check(assertTrue(
    getBody.candidates.some((c: any) => c.isRecommended),
    "GET candidates include persisted recommendations"
  ));

  // Test invalid runId
  const invalidRunRes = await server.inject({
    method: "GET",
    url: "/discovery/abc",
  });
  check(assertEqual(invalidRunRes.statusCode, 400, "invalid runId returns 400"));

  // Test nonexistent runId
  const missingRunRes = await server.inject({
    method: "GET",
    url: "/discovery/999999",
  });
  check(assertEqual(missingRunRes.statusCode, 404, "nonexistent runId returns 404"));

  // Test POST /discovery/:runId/approval
  const candidateIds = getBody.candidates
    .filter((c: any) => c.pageType === "homepage" || c.pageType === "pricing")
    .map((c: any) => c.id);

  const approvalRes = await server.inject({
    method: "POST",
    url: `/discovery/${runId}/approval`,
    payload: {
      approvedCandidateIds: candidateIds,
      manualUrls: ["https://example.com/contact"],
      excludedCandidateIds: [],
    },
  });
  check(assertEqual(approvalRes.statusCode, 200, "POST approval returns 200"));

  const approvalBody = JSON.parse(approvalRes.body);
  check(assertEqual(approvalBody.ok, true, "approval returns ok:true"));
  check(assertTrue(Array.isArray(approvalBody.approvedUrls), "approval returns approvedUrls array"));
  check(assertTrue(approvalBody.approvedUrls.length >= candidateIds.length, "approvedUrls includes candidates"));
  check(assertTrue(approvalBody.approvedUrls.includes("https://example.com/contact"), "manual URL included in approvedUrls"));

  // Verify DB state after approval
  const approvedDb = db
    .select()
    .from(discoveryCandidates)
    .where(
      eq(discoveryCandidates.discoveryRunId, parseInt(runId, 10))
    )
    .all();
  const approvedCount = approvedDb.filter((c) => c.isApproved).length;
  check(assertTrue(approvedCount >= candidateIds.length, "DB has approved candidates"));

  const narrowedCandidateId = candidateIds[0];
  if (typeof narrowedCandidateId === "string") {
    const narrowedApprovalRes = await server.inject({
      method: "POST",
      url: `/discovery/${runId}/approval`,
      payload: {
        approvedCandidateIds: [narrowedCandidateId],
        manualUrls: [],
        excludedCandidateIds: [],
      },
    });
    check(assertEqual(narrowedApprovalRes.statusCode, 200, "second approval returns 200"));
    const narrowedApprovalBody = JSON.parse(narrowedApprovalRes.body);
    check(assertEqual(
      narrowedApprovalBody.approvedUrls.length,
      1,
      "second approval replaces previous approved set"
    ));

    const narrowedDb = db
      .select()
      .from(discoveryCandidates)
      .where(eq(discoveryCandidates.discoveryRunId, parseInt(runId, 10)))
      .all();
    check(assertEqual(
      narrowedDb.filter((c) => c.isApproved).length,
      1,
      "DB approved candidates are replaced, not accumulated"
    ));
  }

  // Cleanup
  process.stdout.write("\nCleaning up test project...\n");
  db.delete(discoveryCandidates).where(eq(discoveryCandidates.projectId, parseInt(projectId, 10))).run();
  db.delete(discoveryRuns).where(eq(discoveryRuns.projectId, parseInt(projectId, 10))).run();
  db.delete(projects).where(eq(projects.id, parseInt(projectId, 10))).run();

  process.stdout.write(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write(`Unexpected error: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
