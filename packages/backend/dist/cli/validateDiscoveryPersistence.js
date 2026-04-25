import "../logger.js";
import { db } from "../db.js";
import { projects, pages, discoveryRuns, discoveryCandidates } from "../schema.js";
import { runDiscovery } from "../services/discovery/discoveryRunner.js";
import { eq } from "drizzle-orm";
function assertEqual(actual, expected, label) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) {
        process.stderr.write(`  ❌ ${label}\n     expected: ${e}\n     actual:   ${a}\n`);
        return false;
    }
    process.stdout.write(`  ✅ ${label}\n`);
    return true;
}
function assertTrue(condition, label) {
    if (!condition) {
        process.stderr.write(`  ❌ ${label}\n`);
        return false;
    }
    process.stdout.write(`  ✅ ${label}\n`);
    return true;
}
async function main() {
    process.stdout.write("\nStage B: Discovery Persistence Validation\n\n");
    // Create a test project
    const now = new Date();
    const [project] = db
        .insert(projects)
        .values({ name: "__test_discovery_persistence", createdAt: now, updatedAt: now })
        .returning()
        .all();
    if (!project) {
        process.stderr.write("Failed to create test project\n");
        process.exit(1);
    }
    const projectId = String(project.id);
    process.stdout.write(`Created test project ${projectId}\n`);
    // Insert existing pages
    const existingUrls = [
        "https://example.com/products/old-item",
        "https://example.com/blog/existing-post",
    ];
    for (const url of existingUrls) {
        db.insert(pages)
            .values({
            projectId: project.id,
            url,
            title: "",
            screenshotPaths: "[]",
            interactiveElements: "[]",
            createdAt: now,
            updatedAt: now,
        })
            .run();
    }
    // Seed URLs with duplicates via tracking params and hashes
    const seedUrls = [
        "https://example.com/",
        "https://example.com/?utm_source=test",
        "https://example.com/#section",
        "https://example.com/products/ticketing/?utm_campaign=summer",
        "https://example.com/pricing",
        "https://example.com/login",
        "mailto:test@example.com",
        "javascript:void(0)",
    ];
    let result;
    try {
        result = await runDiscovery({
            projectId,
            startUrl: "https://example.com/",
            seedUrls,
            maxCandidates: 50,
        });
    }
    catch (err) {
        process.stderr.write(`Discovery failed: ${err instanceof Error ? err.message : String(err)}\n`);
        // Cleanup
        db.delete(discoveryCandidates).where(eq(discoveryCandidates.projectId, project.id)).run();
        db.delete(discoveryRuns).where(eq(discoveryRuns.projectId, project.id)).run();
        db.delete(pages).where(eq(pages.projectId, project.id)).run();
        db.delete(projects).where(eq(projects.id, project.id)).run();
        process.exit(1);
    }
    let passed = 0;
    let failed = 0;
    function check(ok) {
        if (ok)
            passed++;
        else
            failed++;
    }
    // Verify run created
    check(assertTrue(!!result.discoveryRunId, "discoveryRunId returned"));
    check(assertEqual(result.status, "completed", "run status is completed"));
    check(assertTrue(result.candidates.length > 0, "candidates found"));
    // Verify DB state
    const runRows = db
        .select()
        .from(discoveryRuns)
        .where(eq(discoveryRuns.projectId, project.id))
        .all();
    check(assertEqual(runRows.length, 1, "exactly one discovery run in DB"));
    const run = runRows[0];
    if (run) {
        check(assertEqual(run.status, "completed", "DB run status is completed"));
        check(assertTrue(run.candidateCount > 0, "DB run candidateCount > 0"));
    }
    const dbCandidates = db
        .select()
        .from(discoveryCandidates)
        .where(eq(discoveryCandidates.discoveryRunId, parseInt(result.discoveryRunId, 10)))
        .all();
    check(assertTrue(dbCandidates.length > 0, "candidates persisted in DB"));
    // Verify deduplication: no duplicate normalized URLs
    const normalizedUrls = dbCandidates.map((c) => c.normalizedUrl);
    const uniqueNormalized = [...new Set(normalizedUrls)];
    check(assertEqual(normalizedUrls.length, uniqueNormalized.length, "no duplicate normalized URLs"));
    // Verify existing pages included
    const hasExisting = dbCandidates.some((c) => existingUrls.some((u) => c.normalizedUrl.includes("/products/old-item") || c.normalizedUrl.includes("/blog/existing-post")));
    check(assertTrue(hasExisting, "existing DB pages included as candidates"));
    // Verify rejected URLs not present
    const hasMailto = dbCandidates.some((c) => c.url.startsWith("mailto:"));
    const hasJs = dbCandidates.some((c) => c.url.startsWith("javascript:"));
    check(assertTrue(!hasMailto, "mailto URLs rejected"));
    check(assertTrue(!hasJs, "javascript URLs rejected"));
    // Verify tracking params removed
    const hasUtm = dbCandidates.some((c) => c.normalizedUrl.includes("utm_"));
    check(assertTrue(!hasUtm, "tracking params removed from normalized URLs"));
    // Verify hashes removed
    const hasHash = dbCandidates.some((c) => c.normalizedUrl.includes("#"));
    check(assertTrue(!hasHash, "hashes removed from normalized URLs"));
    // Verify classification
    const homepage = dbCandidates.find((c) => c.pageType === "homepage");
    check(assertTrue(!!homepage, "homepage classified"));
    const pricing = dbCandidates.find((c) => c.pageType === "pricing");
    check(assertTrue(!!pricing, "pricing classified"));
    const utility = dbCandidates.find((c) => c.pageType === "utility");
    check(assertTrue(!!utility, "utility classified"));
    const recommendedRows = dbCandidates.filter((c) => c.isRecommended);
    check(assertTrue(recommendedRows.length > 0, "recommendations persisted in DB"));
    check(assertTrue(result.recommended.every((candidate) => typeof candidate.id === "number" && candidate.id > 0), "recommended result candidates have DB ids"));
    // Cleanup
    process.stdout.write("\nCleaning up test project...\n");
    db.delete(discoveryCandidates).where(eq(discoveryCandidates.projectId, project.id)).run();
    db.delete(discoveryRuns).where(eq(discoveryRuns.projectId, project.id)).run();
    db.delete(pages).where(eq(pages.projectId, project.id)).run();
    db.delete(projects).where(eq(projects.id, project.id)).run();
    process.stdout.write(`\nResults: ${passed} passed, ${failed} failed\n`);
    process.exit(failed > 0 ? 1 : 0);
}
main();
