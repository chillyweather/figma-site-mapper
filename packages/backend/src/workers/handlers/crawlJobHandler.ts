import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "../../db.js";
import { crawlRuns } from "../../schema.js";
import { runCrawler } from "../../crawler.js";

export async function crawlJobHandler(job: Job): Promise<unknown> {
  const {
    url,
    publicUrl,
    maxRequestsPerCrawl,
    deviceScaleFactor,
    delay,
    requestDelay,
    maxDepth,
    defaultLanguageOnly,
    fullRefresh,
    sampleSize,
    showBrowser,
    detectInteractiveElements,
    renderInteractiveHighlights,
    cookieBannerHandling,
    captureOnlyVisibleElements,
    highlightAllElements,
    projectId,
    auth,
    styleExtraction,
    approvedUrls,
    discoveryRunId,
  } = job.data;

  console.log(`👩‍🍳 Processing job ${job.id}: Crawling ${url}`);
  console.log(
    `📋 Job settings: maxDepth=${maxDepth}, defaultLanguageOnly=${defaultLanguageOnly}, fullRefresh=${fullRefresh}, sampleSize=${sampleSize}`
  );
  console.log(`🔗 Full job data:`, JSON.stringify(job.data, null, 2));
  if (auth) {
    console.log(`🔐 Authentication: ${auth.method}`);
  }
  if (styleExtraction?.enabled) {
    console.log(`🎨 Style Extraction: enabled (preset: ${styleExtraction.preset})`);
  }

  let crawlRunId: number | undefined;
  try {
    const projectNumId = projectId ? parseInt(projectId, 10) : null;
    if (projectNumId && !isNaN(projectNumId)) {
      const [row] = db
        .insert(crawlRuns)
        .values({
          projectId: projectNumId,
          jobId: String(job.id ?? ""),
          startUrl: url,
          settingsJson: JSON.stringify({
            maxRequestsPerCrawl,
            deviceScaleFactor,
            delay,
            requestDelay,
            maxDepth,
            defaultLanguageOnly,
            sampleSize,
            detectInteractiveElements,
            renderInteractiveHighlights,
            cookieBannerHandling,
            captureOnlyVisibleElements,
            highlightAllElements,
            fullRefresh,
          }),
          discoveryRunId: discoveryRunId ? parseInt(discoveryRunId, 10) : null,
          approvedUrlsJson:
            approvedUrls && Array.isArray(approvedUrls) ? JSON.stringify(approvedUrls) : null,
          status: "running",
          startedAt: new Date(),
        })
        .returning()
        .all();
      crawlRunId = row?.id;
    }

    const result = await runCrawler(
      url,
      publicUrl,
      maxRequestsPerCrawl,
      deviceScaleFactor || 1,
      job.id,
      delay || 0,
      requestDelay || 1000,
      maxDepth === 0 ? undefined : maxDepth,
      defaultLanguageOnly,
      sampleSize,
      showBrowser,
      detectInteractiveElements,
      captureOnlyVisibleElements,
      highlightAllElements,
      fullRefresh === true,
      projectId,
      auth,
      styleExtraction,
      crawlRunId,
      approvedUrls,
      cookieBannerHandling
    );

    if (crawlRunId) {
      db.update(crawlRuns)
        .set({
          status: "completed",
          pageIdsJson: JSON.stringify(result.visitedPageIds),
          pageCount: result.pageCount,
          elementCount: result.elementCount,
          completedAt: new Date(),
        })
        .where(eq(crawlRuns.id, crawlRunId))
        .run();
    }

    await job.updateData({
      ...job.data,
      visitedUrls: result.visitedUrls,
      visitedPageIds: result.visitedPageIds,
      pageCount: result.pageCount,
      lastCompletedAt: new Date().toISOString(),
    });
    console.log(`✅ Finished job ${job.id}`);
    return result;
  } catch (error) {
    if (crawlRunId) {
      db.update(crawlRuns)
        .set({ status: "failed", completedAt: new Date() })
        .where(eq(crawlRuns.id, crawlRunId))
        .run();
    }
    console.error(`❌ Job ${job.id} failed:`, error);
    throw error;
  }
}
