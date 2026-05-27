import type { Page } from "playwright";
import {
  triggerLazyContent,
  type TriggerLazyContentOptions,
} from "./lazyContentTrigger.js";
import {
  waitUntilStable,
  type ReadinessReport,
  type WaitUntilStableOptions,
} from "./pageReadyDetector.js";

export interface CaptureOptions {
  /** Optional callback invoked at three points where cookie banners are
   * most likely to re-appear: before lazy-trigger, after lazy-trigger,
   * and after scroll-to-top. The orchestrator does not own cookie banner
   * logic — extracting that is out of scope. */
  dismissBanners?: () => Promise<void>;
  readiness?: WaitUntilStableOptions;
  lazy?: TriggerLazyContentOptions;
}

export interface CaptureResult {
  buffer: Buffer;
  width: number;
  height: number;
  readinessReport: ReadinessReport;
}

// One-shot: this orchestrator freezes animations and zero-duration transitions
// by injecting a <style> tag that is never removed. Discard the page after
// calling this — reusing it for a second capture leaves the freeze in place
// and may also leave sticky elements hidden via inline display:none.
export async function captureHighFidelity(
  page: Page,
  opts: CaptureOptions = {}
): Promise<CaptureResult> {
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
  const buffer = await page.screenshot({ fullPage: true, type: "png" });

  const dims = await pngDimensions(buffer);

  return { buffer, width: dims.width, height: dims.height, readinessReport };
}

// Limitation: keeps the first match in DOM order, not the visually-topmost
// sticky. A late-in-DOM sticky that paints at y=0 will be hidden while an
// early-in-DOM sticky lower on the page is kept. Selector also only matches
// `.sticky`, `.fixed`, or inline position:fixed/sticky — computed-style
// stickies on real sites slip through. Preserved from the legacy inline flow.
async function hideRedundantStickyElements(page: Page): Promise<void> {
  await page
    .evaluate(() => {
      const stickyElements = document.querySelectorAll(
        '[style*="position: fixed"], [style*="position: sticky"], .sticky, .fixed'
      );
      stickyElements.forEach((el, index) => {
        if (index > 0) (el as HTMLElement).style.display = "none";
      });
      document.documentElement.style.transform = "none";
      document.body.style.transform = "none";
    })
    .catch(() => undefined);
}

async function scrollToTop(page: Page): Promise<void> {
  await page
    .evaluate(() => {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
    })
    .catch(() => undefined);
  // Tiny pause for layout to settle after scroll mutations — preserved
  // from the legacy inline flow.
  await page.waitForTimeout(300);
}

async function pngDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
  // PNG dimensions live in the IHDR chunk at bytes 16..24 (big-endian uint32).
  // page.screenshot({ type: "png" }) guarantees PNG output today; the
  // signature check guards against future drift (format option change, error
  // payload returned in place of the screenshot, etc.).
  if (buffer.length < 24) return { width: 0, height: 0 };
  if (
    buffer[0] !== 0x89 ||
    buffer[1] !== 0x50 ||
    buffer[2] !== 0x4e ||
    buffer[3] !== 0x47
  ) {
    return { width: 0, height: 0 };
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}
