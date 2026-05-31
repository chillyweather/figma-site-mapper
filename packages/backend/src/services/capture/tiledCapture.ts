import type { Page } from "playwright";
import sharp from "sharp";
import {
  triggerLazyContent,
  type TriggerLazyContentOptions,
} from "./lazyContentTrigger.js";
import {
  waitUntilStable,
  type ReadinessReport,
  type WaitUntilStableOptions,
} from "./pageReadyDetector.js";
import { scoreSuspiciousRegions } from "./blankRegionDetector.js";
import type { CaptureOptions, CaptureResult } from "./highFidelityCapture.js";
import {
  detectMediaRegions,
  type MediaDiagnostics,
  type MediaSurface,
} from "./mediaRegionDetector.js";
import { activateVideos } from "./videoDriver.js";
import { activateLottiePlayers } from "./lottieDriver.js";
import { warmUpAnimatedRegions } from "./canvasDriver.js";

export interface TiledCaptureOptions extends CaptureOptions {
  onProgress?: (stage: string) => void;
  /** Maximum tile height in CSS pixels. Default: viewport height. */
  tileHeightCss?: number;
  /** Per-tile quiet window for visual stability in ms. Default: 400. */
  tileStabilityMs?: number;
  /** Whether to run media region diagnostics. Default: true. */
  detectMedia?: boolean;
}

export interface TiledCaptureResult extends CaptureResult {
  tileCount: number;
  mediaDiagnostics?: MediaDiagnostics;
}

// One-shot: like captureHighFidelity but uses viewport-tile capture and
// stitching instead of one-shot fullPage screenshot. Reuse is not safe —
// discard the page after calling this.
export async function captureTiled(
  page: Page,
  opts: TiledCaptureOptions = {}
): Promise<TiledCaptureResult> {
  const dismiss = opts.dismissBanners ?? (async () => undefined);
  const progress = opts.onProgress ?? ((_s: string) => undefined);
  const tileStabilityMs = opts.tileStabilityMs ?? 400;

  // 1. Pre-pass: dismiss banners.
  await dismiss();

  // 2. Prepare sticky/fixed header bands so top-pinned chrome appears only in
  //    the first tile and does not repeat down the stitched screenshot.
  await prepareStickyElementsForTiling(page);

  // 3. Trigger all lazy content by scrolling through the full page.
  progress("triggering-lazy");
  await triggerLazyContent(page, opts.lazy);

  // 4. Post-lazy banner dismiss.
  await dismiss();

  // 5. Scroll to top for tiling from y=0.
  await scrollToTop(page);
  await dismiss();

  // 6. Readiness wait on the full page before tiling.
  progress("waiting-readiness");
  const readinessReport = await waitUntilStable(page, {
    ...opts.readiness,
    settleAnimations: false,
  });

  // 7. Plan tiles.
  progress("planning-tiles");
  const { scrollHeightCss, viewportHeightCss, viewportWidthCss, dpr } =
    await getPageDimensions(page);
  const tileHeightCss = opts.tileHeightCss ?? viewportHeightCss;
  const tiles = planTiles(scrollHeightCss, tileHeightCss);
  const tileCount = tiles.length;

  // 7a. Pre-discover media surfaces for per-tile activation.
  // We need bounding-box positions to know which tile each surface falls in.
  const preSurfaces = await discoverSurfacesForActivation(page);

  // 8. Capture each tile, activating media drivers before each tile snapshot.
  const tileBuffers: Array<{ buffer: Buffer; topPx: number; heightPx: number; tileRetried: boolean }> = [];

  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i]!;
    progress(`capturing-tile-${i + 1}-of-${tileCount}`);

    // Scroll to tile top.
    await page.evaluate((y: number) => {
      window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
    }, tile.topCss);
    await setStickyBandsVisibleForTile(page, i === 0);

    // Short pause for scroll paint + any intersection-observer triggered loads.
    await page.waitForTimeout(tileStabilityMs);

    // Find surfaces that overlap this tile's y-range.
    const tileBottom = tile.topCss + tileHeightCss;
    const tileSurfaces = preSurfaces.filter(
      (s) => s.bbox.y < tileBottom && s.bbox.y + s.bbox.height > tile.topCss
    );

    // Activate media in this tile.
    if (tileSurfaces.length > 0) {
      await activateTileMedia(page, tileSurfaces);
      await page.waitForTimeout(Math.min(tileStabilityMs, 300));
    }

    const clipHeightCss = Math.min(tileHeightCss, scrollHeightCss - tile.topCss);
    const clipHeightPx = Math.round(clipHeightCss * dpr);
    const topPx = Math.round(tile.topCss * dpr);

    const buf = await page.screenshot({
      type: "png",
      clip: {
        x: 0,
        y: 0,
        width: viewportWidthCss,
        height: Math.max(1, clipHeightCss),
      },
    });

    // Tile-level retry for canvas/SVG/custom animated regions (issue 48).
    // If any suspicious blank media region is in this tile, retry once.
    let finalTileBuf = buf;
    let tileRetried = false;
    const mediaRegionsInTile = tileSurfaces.filter(
      (s) => s.kind === "canvas" || s.kind === "svg-animation" || s.kind === "lottie" || s.kind === "dotlottie"
    );

    if (mediaRegionsInTile.length > 0) {
      const tileScore = await scoreTileMediaRegions(buf, mediaRegionsInTile, tile.topCss, dpr);
      if (tileScore > 0.7) {
        // One retry: re-warm and re-capture.
        tileRetried = true;
        await activateTileMedia(page, mediaRegionsInTile);
        await page.waitForTimeout(tileStabilityMs);
        const retryBuf = await page.screenshot({
          type: "png",
          clip: { x: 0, y: 0, width: viewportWidthCss, height: Math.max(1, clipHeightCss) },
        });
        const retryScore = await scoreTileMediaRegions(retryBuf, mediaRegionsInTile, tile.topCss, dpr);
        if (retryScore < tileScore) {
          finalTileBuf = retryBuf;
        }
      }
    }

    tileBuffers.push({ buffer: finalTileBuf, topPx, heightPx: clipHeightPx, tileRetried });
  }

  // 9. Stitch tiles into one full-page buffer.
  progress("stitching");
  const totalHeightPx = tileBuffers.reduce((sum, t) => sum + t.heightPx, 0);
  const widthPx = Math.round(viewportWidthCss * dpr);

  let finalBuffer: Buffer;

  if (tileBuffers.length === 1 && tileBuffers[0]) {
    finalBuffer = tileBuffers[0].buffer;
  } else {
    const composites = tileBuffers.map((t) => ({
      input: t.buffer,
      top: t.topPx,
      left: 0,
    }));

    finalBuffer = await sharp({
      create: {
        width: widthPx,
        height: totalHeightPx,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      },
    })
      .composite(composites)
      .png()
      .toBuffer();
  }

  // 10. Score the stitched image for suspicious blank regions.
  progress("processing");
  const firstScore = await scoreSuspiciousRegions(finalBuffer);
  const threshold = opts.suspiciousRegionThreshold ?? 0.2;

  let retryCount = 0;
  let finalScore = firstScore;

  if (firstScore > threshold) {
    // Retry: re-trigger lazy, scroll to top, re-readiness, re-tile.
    await triggerLazyContent(page, opts.lazy);
    await scrollToTop(page);
    await waitUntilStable(page, { ...opts.readiness, settleAnimations: false });

    const retryBuffers: Array<{ buffer: Buffer; topPx: number; heightPx: number }> = [];
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i]!;
      await page.evaluate((y: number) => {
        window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
      }, tile.topCss);
      await setStickyBandsVisibleForTile(page, i === 0);
      await page.waitForTimeout(tileStabilityMs);

      const clipHeightCss = Math.min(tileHeightCss, scrollHeightCss - tile.topCss);
      const clipHeightPx = Math.round(clipHeightCss * dpr);
      const topPx = Math.round(tile.topCss * dpr);

      const buf = await page.screenshot({
        type: "png",
        clip: {
          x: 0,
          y: 0,
          width: viewportWidthCss,
          height: Math.max(1, clipHeightCss),
        },
      });
      retryBuffers.push({ buffer: buf, topPx, heightPx: clipHeightPx });
    }

    let retryFinalBuffer: Buffer;
    if (retryBuffers.length === 1 && retryBuffers[0]) {
      retryFinalBuffer = retryBuffers[0].buffer;
    } else {
      retryFinalBuffer = await sharp({
        create: {
          width: widthPx,
          height: totalHeightPx,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        },
      })
        .composite(retryBuffers.map((t) => ({ input: t.buffer, top: t.topPx, left: 0 })))
        .png()
        .toBuffer();
    }

    const retryScore = await scoreSuspiciousRegions(retryFinalBuffer);
    retryCount = 1;
    if (retryScore < firstScore) {
      finalBuffer = retryFinalBuffer;
      finalScore = retryScore;
    }
  }

  // 11. Run media diagnostics on the final stitched buffer.
  let mediaDiagnostics: MediaDiagnostics | undefined;
  if (opts.detectMedia !== false) {
    progress("media-diagnostics");
    try {
      mediaDiagnostics = await detectMediaRegions(page, finalBuffer);
      if (mediaDiagnostics.warnings.length > 0) {
        // Warnings are available via mediaDiagnostics.warnings for callers.
      }
    } catch {
      // Non-fatal: media detection failure should not abort the capture.
    }
  }

  // Leave the page in the same coordinate anchor expected by the crawler's
  // post-capture DOM extraction. Without this, bbox extraction can inherit the
  // last tile's scroll offset and produce viewport-relative component slices.
  await scrollToTop(page);

  return {
    buffer: finalBuffer,
    width: widthPx,
    height: totalHeightPx,
    readinessReport,
    suspiciousRegionScore: finalScore,
    retryCount,
    tileCount,
    mediaDiagnostics,
  };
}

interface TilePlan {
  topCss: number;
}

function planTiles(scrollHeightCss: number, tileHeightCss: number): TilePlan[] {
  if (scrollHeightCss <= 0) return [{ topCss: 0 }];
  const tiles: TilePlan[] = [];
  let y = 0;
  while (y < scrollHeightCss) {
    tiles.push({ topCss: y });
    y += tileHeightCss;
  }
  return tiles;
}

async function getPageDimensions(page: Page): Promise<{
  scrollHeightCss: number;
  viewportHeightCss: number;
  viewportWidthCss: number;
  dpr: number;
}> {
  const dims = await page
    .evaluate(() => ({
      scrollHeightCss: Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        document.documentElement.offsetHeight
      ),
      viewportHeightCss: window.innerHeight,
      viewportWidthCss: window.innerWidth,
      dpr: window.devicePixelRatio || 1,
    }))
    .catch(() => ({
      scrollHeightCss: 800,
      viewportHeightCss: 800,
      viewportWidthCss: 1280,
      dpr: 1,
    }));
  return dims;
}

const HEADER_BAND_MAX_HEIGHT_PX = 200;
const HEADER_BAND_MAX_TOP_PX = 80;

// Mark top-pinned header bands so they can be kept for tile 0 and hidden for
// later tiles. This preserves the source page's fixed/sticky chrome once while
// avoiding the repeated-header tiling artifact.
async function prepareStickyElementsForTiling(page: Page): Promise<void> {
  await page
    .evaluate(({ maxBandHeight, maxTop }: { maxBandHeight: number; maxTop: number }) => {
      const candidates: HTMLElement[] = [];
      const all = document.querySelectorAll<HTMLElement>("*");
      all.forEach((el) => {
        const cs = window.getComputedStyle(el);
        if (cs.position !== "fixed" && cs.position !== "sticky") return;
        const rect = el.getBoundingClientRect();
        if (rect.height === 0 || rect.height > maxBandHeight) return;
        const topPx = parseFloat(cs.top);
        if (!Number.isFinite(topPx) || topPx > maxTop || rect.top > maxTop) return;
        candidates.push(el);
      });

      candidates.forEach((el) => {
        if (!el.dataset.sitemapperTiledOriginalDisplay) {
          el.dataset.sitemapperTiledOriginalDisplay = el.style.display || "__unset__";
        }
        el.dataset.sitemapperTiledStickyBand = "true";
      });
      document.documentElement.style.transform = "none";
      document.body.style.transform = "none";
    }, { maxBandHeight: HEADER_BAND_MAX_HEIGHT_PX, maxTop: HEADER_BAND_MAX_TOP_PX })
    .catch(() => undefined);
}

async function setStickyBandsVisibleForTile(page: Page, visible: boolean): Promise<void> {
  await page
    .evaluate((show: boolean) => {
      document
        .querySelectorAll<HTMLElement>("[data-sitemapper-tiled-sticky-band='true']")
        .forEach((el) => {
          if (!show) {
            el.style.display = "none";
            return;
          }
          const original = el.dataset.sitemapperTiledOriginalDisplay;
          if (!original || original === "__unset__") {
            el.style.removeProperty("display");
          } else {
            el.style.display = original;
          }
        });
    }, visible)
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
  await page.waitForTimeout(300);
}

// Lightweight surface discovery for tile-level activation — only captures
// selectors and bboxes, not a full scoring pass.
async function discoverSurfacesForActivation(page: Page): Promise<MediaSurface[]> {
  const raw = await page
    .evaluate(() => {
      type S = { kind: string; selector: string; bbox: { x: number; y: number; width: number; height: number }; status: string };
      const results: S[] = [];
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;

      function rect(el: Element): { x: number; y: number; width: number; height: number } | null {
        const r = el.getBoundingClientRect();
        if (r.width < 20 || r.height < 20) return null;
        return { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), width: Math.round(r.width), height: Math.round(r.height) };
      }

      document.querySelectorAll("video").forEach((el, i) => {
        const b = rect(el);
        if (b) results.push({ kind: "video", selector: `video:nth(${i})`, bbox: b, status: "pending" });
      });
      document.querySelectorAll("canvas").forEach((el, i) => {
        const b = rect(el);
        if (b && b.width * b.height >= 400) results.push({ kind: "canvas", selector: `canvas:nth(${i})`, bbox: b, status: "pending" });
      });
      document.querySelectorAll("svg").forEach((el, i) => {
        const hasAnim = el.querySelector("animate, animateTransform, animateMotion") !== null;
        if (!hasAnim) return;
        const b = rect(el);
        if (b && b.width * b.height >= 400) results.push({ kind: "svg-animation", selector: `svg:nth(${i})`, bbox: b, status: "pending" });
      });
      ["lottie-player", "dotlottie-player", "[data-lottie]"].forEach((sel) => {
        document.querySelectorAll(sel).forEach((el, i) => {
          const b = rect(el);
          if (b) results.push({ kind: sel.includes("dotlottie") ? "dotlottie" : "lottie", selector: `${sel}:nth(${i})`, bbox: b, status: "pending" });
        });
      });
      return results;
    })
    .catch(() => []);

  return raw as MediaSurface[];
}

// Activate media drivers for surfaces visible in the current viewport.
async function activateTileMedia(page: Page, surfaces: MediaSurface[]): Promise<void> {
  const videoSelectors = surfaces.filter((s) => s.kind === "video").map((s) => s.selector);
  const lottieSelectors = surfaces
    .filter((s) => s.kind === "lottie" || s.kind === "dotlottie")
    .map((s) => s.selector);
  const animatedSelectors = surfaces
    .filter((s) => s.kind === "canvas" || s.kind === "svg-animation")
    .map((s) => s.selector);
  const animatedKinds = surfaces
    .filter((s) => s.kind === "canvas" || s.kind === "svg-animation")
    .map((s) => s.kind);

  await Promise.all([
    videoSelectors.length > 0 ? activateVideos(page, videoSelectors).catch(() => []) : Promise.resolve([]),
    lottieSelectors.length > 0 ? activateLottiePlayers(page, lottieSelectors).catch(() => []) : Promise.resolve([]),
    animatedSelectors.length > 0
      ? warmUpAnimatedRegions(page, animatedSelectors, animatedKinds).catch(() => [])
      : Promise.resolve([]),
  ]);
}

// Score only the media-region sub-crops of a tile buffer to decide whether
// a tile-level retry is warranted.
async function scoreTileMediaRegions(
  tileBuf: Buffer,
  surfaces: MediaSurface[],
  tileCssTop: number,
  dpr: number
): Promise<number> {
  try {
    const tileMetaPng = tileBuf.length >= 24 && tileBuf[0] === 0x89;
    if (!tileMetaPng) return 0;
    const tileW = tileBuf.readUInt32BE(16);
    const tileH = tileBuf.readUInt32BE(20);

    let maxScore = 0;
    for (const surface of surfaces) {
      // Translate absolute page coordinates to tile-local coordinates.
      const relYCss = surface.bbox.y - tileCssTop;
      const x = Math.round(surface.bbox.x * dpr);
      const y = Math.round(relYCss * dpr);
      const w = Math.round(surface.bbox.width * dpr);
      const h = Math.round(surface.bbox.height * dpr);

      if (x < 0 || y < 0 || x + w > tileW || y + h > tileH || w < 4 || h < 4) continue;

      const crop = await sharp(tileBuf)
        .extract({ left: x, top: y, width: w, height: h })
        .png()
        .toBuffer();
      const score = await scoreSuspiciousRegions(crop);
      if (score > maxScore) maxScore = score;
    }
    return maxScore;
  } catch {
    return 0;
  }
}
