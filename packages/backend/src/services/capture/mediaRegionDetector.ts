import type { Page } from "playwright";
import sharp from "sharp";
import { scoreSuspiciousRegions } from "./blankRegionDetector.js";

export type MediaSurfaceKind =
  | "video"
  | "canvas"
  | "svg-animation"
  | "lottie"
  | "dotlottie"
  | "iframe"
  | "unknown";

export type MediaSurfaceStatus =
  | "ok"
  | "blank"
  | "blocked"
  | "unsupported"
  | "pending";

export interface MediaSurface {
  kind: MediaSurfaceKind;
  selector: string;
  bbox: { x: number; y: number; width: number; height: number };
  status: MediaSurfaceStatus;
  warning?: string;
}

export interface MediaDiagnostics {
  videoCount: number;
  canvasCount: number;
  svgAnimationCount: number;
  lottieCount: number;
  iframeCount: number;
  blankCount: number;
  blockedCount: number;
  surfaces: MediaSurface[];
  warnings: string[];
}

/** Minimum area to consider a surface worth diagnosing (px²). */
const MIN_AREA_PX = 20 * 20;

// Discover and score media surfaces on the current page. The page should be
// at its final scroll-to-top state before calling this.
export async function detectMediaRegions(
  page: Page,
  fullPageBuffer: Buffer
): Promise<MediaDiagnostics> {
  const discovered = await discoverSurfaces(page);

  const scored = await scoreRegions(fullPageBuffer, discovered);

  const videoCount = scored.filter((s) => s.kind === "video").length;
  const canvasCount = scored.filter((s) => s.kind === "canvas").length;
  const svgAnimationCount = scored.filter((s) => s.kind === "svg-animation").length;
  const lottieCount = scored.filter(
    (s) => s.kind === "lottie" || s.kind === "dotlottie"
  ).length;
  const iframeCount = scored.filter((s) => s.kind === "iframe").length;
  const blankCount = scored.filter((s) => s.status === "blank").length;
  const blockedCount = scored.filter((s) => s.status === "blocked").length;

  const warnings: string[] = [];
  for (const s of scored) {
    if (s.warning) warnings.push(s.warning);
  }

  return {
    videoCount,
    canvasCount,
    svgAnimationCount,
    lottieCount,
    iframeCount,
    blankCount,
    blockedCount,
    surfaces: scored,
    warnings,
  };
}

async function discoverSurfaces(page: Page): Promise<MediaSurface[]> {
  const raw = await page
    .evaluate(() => {
      type RawSurface = {
        kind: string;
        selector: string;
        bbox: { x: number; y: number; width: number; height: number };
        status: string;
        warning?: string;
      };

      const results: RawSurface[] = [];

      function getRect(el: Element): { x: number; y: number; width: number; height: number } | null {
        const r = el.getBoundingClientRect();
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;
        if (r.width < 10 || r.height < 10) return null;
        return {
          x: Math.round(r.left + scrollX),
          y: Math.round(r.top + scrollY),
          width: Math.round(r.width),
          height: Math.round(r.height),
        };
      }

      function selectorFor(el: Element, index: number): string {
        const id = el.id ? `#${el.id}` : "";
        const tag = el.tagName.toLowerCase();
        return `${tag}${id}:nth(${index})`;
      }

      // Video elements.
      document.querySelectorAll("video").forEach((el, i) => {
        const bbox = getRect(el);
        if (!bbox) return;
        const area = bbox.width * bbox.height;
        if (area < 400) return;
        const crossOrigin = el.crossOrigin !== null;
        results.push({
          kind: "video",
          selector: selectorFor(el, i),
          bbox,
          status: crossOrigin ? "blocked" : "pending",
          warning: crossOrigin
            ? `video[${i}]: cross-origin restrictions may prevent poster/frame access`
            : undefined,
        });
      });

      // Canvas elements.
      document.querySelectorAll("canvas").forEach((el, i) => {
        const bbox = getRect(el);
        if (!bbox) return;
        const area = bbox.width * bbox.height;
        if (area < 400) return;
        // Attempt to detect if canvas is readable.
        let canRead = true;
        try {
          const ctx = el.getContext("2d");
          if (ctx) ctx.getImageData(0, 0, 1, 1);
        } catch {
          canRead = false;
        }
        results.push({
          kind: "canvas",
          selector: selectorFor(el, i),
          bbox,
          status: canRead ? "pending" : "blocked",
          warning: canRead
            ? undefined
            : `canvas[${i}]: cross-origin or tainted canvas — cannot read pixels`,
        });
      });

      // SVG elements with animations (<animate>, <animateTransform>, etc.).
      document.querySelectorAll("svg").forEach((el, i) => {
        const hasAnimation =
          el.querySelector("animate, animateTransform, animateMotion, set") !== null ||
          el.querySelector("[keyframes], [dur]") !== null;
        if (!hasAnimation) return;
        const bbox = getRect(el);
        if (!bbox) return;
        const area = bbox.width * bbox.height;
        if (area < 400) return;
        results.push({
          kind: "svg-animation",
          selector: selectorFor(el, i),
          bbox,
          status: "pending",
        });
      });

      // Lottie / dotLottie players.
      const lottieSelectors = [
        "lottie-player",
        "dotlottie-player",
        "[data-lottie]",
        ".lottie",
        ".dotlottie",
        "[class*='lottie']",
      ];
      lottieSelectors.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el, i) => {
          const bbox = getRect(el);
          if (!bbox) return;
          const area = bbox.width * bbox.height;
          if (area < 400) return;
          const isDotLottie =
            el.tagName.toLowerCase() === "dotlottie-player" ||
            el.classList.contains("dotlottie");
          results.push({
            kind: isDotLottie ? "dotlottie" : "lottie",
            selector: `${sel}:nth(${i})`,
            bbox,
            status: "pending",
          });
        });
      });

      // Iframes (observable ones only).
      document.querySelectorAll("iframe").forEach((el, i) => {
        const bbox = getRect(el);
        if (!bbox) return;
        const area = bbox.width * bbox.height;
        if (area < 400) return;
        let canAccess = false;
        try {
          // Will throw for cross-origin iframes.
          const _ = el.contentDocument?.title;
          canAccess = el.contentDocument !== null;
        } catch {
          canAccess = false;
        }
        results.push({
          kind: "iframe",
          selector: selectorFor(el, i),
          bbox,
          status: canAccess ? "pending" : "blocked",
          warning: canAccess
            ? undefined
            : `iframe[${i}]: cross-origin — cannot inspect contents`,
        });
      });

      return results;
    })
    .catch(() => [] as MediaSurface[]);

  return raw as MediaSurface[];
}

// Score each surface region in the stitched buffer for blank/placeholder-like
// content. Uses the same blank-region scorer but restricted to the surface bbox.
async function scoreRegions(
  fullBuffer: Buffer,
  surfaces: MediaSurface[]
): Promise<MediaSurface[]> {
  const { width: totalWidth, height: totalHeight } = await getBufferDimensions(fullBuffer);
  const results: MediaSurface[] = [];

  for (const surface of surfaces) {
    if (surface.status === "blocked") {
      results.push(surface);
      continue;
    }

    const { x, y, width, height } = surface.bbox;
    const area = width * height;
    if (area < MIN_AREA_PX) {
      results.push({ ...surface, status: "ok" });
      continue;
    }

    // Clamp bbox to image bounds.
    const clampedX = Math.max(0, Math.min(x, totalWidth - 1));
    const clampedY = Math.max(0, Math.min(y, totalHeight - 1));
    const clampedW = Math.min(width, totalWidth - clampedX);
    const clampedH = Math.min(height, totalHeight - clampedY);

    if (clampedW < 4 || clampedH < 4) {
      results.push({ ...surface, status: "ok" });
      continue;
    }

    try {
      const cropBuffer = await cropRegion(fullBuffer, clampedX, clampedY, clampedW, clampedH);
      const blankScore = await scoreSuspiciousRegions(cropBuffer);
      const isBlank = blankScore > 0.7;
      results.push({
        ...surface,
        status: isBlank ? "blank" : "ok",
        warning: isBlank
          ? `${surface.kind} region at (${x},${y}) appears blank (score=${blankScore.toFixed(2)})`
          : surface.warning,
      });
    } catch {
      results.push(surface);
    }
  }

  return results;
}

async function getBufferDimensions(
  buffer: Buffer
): Promise<{ width: number; height: number }> {
  if (buffer.length < 24) return { width: 0, height: 0 };
  if (buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4e || buffer[3] !== 0x47) {
    return { width: 0, height: 0 };
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

async function cropRegion(
  buffer: Buffer,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<Buffer> {
  return sharp(buffer)
    .extract({ left: x, top: y, width, height })
    .png()
    .toBuffer();
}
