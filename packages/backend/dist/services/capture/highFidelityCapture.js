import { triggerLazyContent, } from "./lazyContentTrigger.js";
import { waitUntilStable, } from "./pageReadyDetector.js";
import { scoreSuspiciousRegions } from "./blankRegionDetector.js";
// One-shot: this orchestrator freezes animations and zero-duration transitions
// by injecting a <style> tag that is never removed. Discard the page after
// calling this — reusing it for a second capture leaves the freeze in place
// and may also leave sticky elements hidden via inline display:none.
export async function captureHighFidelity(page, opts = {}) {
    const dismiss = opts.dismissBanners ?? (async () => undefined);
    // 1. Pre-pass: dismiss banners that were visible at first paint.
    await dismiss();
    // 2. Hide sticky / fixed elements except the topmost — otherwise they
    //    repeat down a long-page screenshot. Behaviour preserved from the
    //    legacy inline flow in crawler.ts.
    await hideRedundantStickyElements(page);
    // 3. Trigger lazy-loaded content.
    await triggerLazyContent(page, opts.lazy);
    // 4. Banners may have re-appeared once lazy content rendered.
    await dismiss();
    // 5. Scroll to top so the screenshot starts at y=0. LazyContentTrigger
    //    already returns scrolled to top, but a banner-dismiss handler may
    //    have scrolled the page, so we re-anchor here.
    await scrollToTop(page);
    // 6. One last banner pass after the final scroll position is set.
    await dismiss();
    // 7. Readiness wait. With lazy content already loaded and animations
    //    paused, this is now a final-frame guarantee rather than an
    //    open-ended timeout.
    const readinessReport = await waitUntilStable(page, opts.readiness);
    // 8. Take the screenshot.
    const firstBuffer = await page.screenshot({ fullPage: true, type: "png" });
    const firstScore = await scoreSuspiciousRegions(firstBuffer);
    const threshold = opts.suspiciousRegionThreshold ?? 0.20;
    // 9. If score exceeds threshold, retry: re-trigger lazy content, scroll to
    //    top, re-run readiness wait, then re-screenshot. Skip banner dismissal
    //    and sticky hide — those are already done.
    let finalBuffer = firstBuffer;
    let finalScore = firstScore;
    let retryCount = 0;
    if (firstScore > threshold) {
        await triggerLazyContent(page, opts.lazy);
        await scrollToTop(page);
        await waitUntilStable(page, opts.readiness);
        const retryBuffer = await page.screenshot({ fullPage: true, type: "png" });
        const retryScore = await scoreSuspiciousRegions(retryBuffer);
        retryCount = 1;
        // Keep whichever buffer has the lower blank-region score.
        if (retryScore < firstScore) {
            finalBuffer = retryBuffer;
            finalScore = retryScore;
        }
    }
    const dims = await pngDimensions(finalBuffer);
    return {
        buffer: finalBuffer,
        width: dims.width,
        height: dims.height,
        readinessReport,
        suspiciousRegionScore: finalScore,
        retryCount,
    };
}
// Hide repeating top-pinned header bands so they don't duplicate down a
// long-page screenshot. Only short, top-pinned bands qualify — scroll-pinned
// hero layers (tall, often viewport-height) are preserved. Uses computed
// style and bounding-box geometry rather than selectors, so utility-class
// stickies (e.g. Tailwind `.sticky`) and inline styles both flow through
// the same gate.
const HEADER_BAND_MAX_HEIGHT_PX = 200;
async function hideRedundantStickyElements(page) {
    await page
        .evaluate((maxBandHeight) => {
        const candidates = [];
        const all = document.querySelectorAll("*");
        all.forEach((el) => {
            const cs = window.getComputedStyle(el);
            if (cs.position !== "fixed" && cs.position !== "sticky")
                return;
            const rect = el.getBoundingClientRect();
            if (rect.height === 0 || rect.height > maxBandHeight)
                return;
            // CSS `top` near 0 means the element intends to pin to the
            // viewport top — the shape of a header/banner, not a hero pin.
            const topPx = parseFloat(cs.top);
            if (!Number.isFinite(topPx) || topPx > 8)
                return;
            candidates.push(el);
        });
        // Keep the first header band in DOM order, hide subsequent ones so
        // they don't repeat down the stitched screenshot.
        candidates.forEach((el, index) => {
            if (index > 0)
                el.style.display = "none";
        });
        document.documentElement.style.transform = "none";
        document.body.style.transform = "none";
    }, HEADER_BAND_MAX_HEIGHT_PX)
        .catch(() => undefined);
}
async function scrollToTop(page) {
    await page
        .evaluate(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        if (document.scrollingElement)
            document.scrollingElement.scrollTop = 0;
    })
        .catch(() => undefined);
    // Tiny pause for layout to settle after scroll mutations — preserved
    // from the legacy inline flow.
    await page.waitForTimeout(300);
}
async function pngDimensions(buffer) {
    // PNG dimensions live in the IHDR chunk at bytes 16..24 (big-endian uint32).
    // page.screenshot({ type: "png" }) guarantees PNG output today; the
    // signature check guards against future drift (format option change, error
    // payload returned in place of the screenshot, etc.).
    if (buffer.length < 24)
        return { width: 0, height: 0 };
    if (buffer[0] !== 0x89 ||
        buffer[1] !== 0x50 ||
        buffer[2] !== 0x4e ||
        buffer[3] !== 0x47) {
        return { width: 0, height: 0 };
    }
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
}
