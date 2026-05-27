import type { Page } from "playwright";

export type SignalOutcome = "fired" | "timeout";

export interface ReadinessReport {
  images: SignalOutcome;
  fonts: SignalOutcome;
  backgroundImages: SignalOutcome;
  animations: SignalOutcome;
  videos: SignalOutcome;
  requests: SignalOutcome;
}

export interface WaitUntilStableOptions {
  imagesTimeoutMs?: number;
  fontsTimeoutMs?: number;
  backgroundImagesTimeoutMs?: number;
  animationsTimeoutMs?: number;
  videosTimeoutMs?: number;
  requestsTimeoutMs?: number;
  /** Quiet window for request-settling — resolves N ms after last response. */
  requestSettleQuietWindowMs?: number;
  /** Quiet window for DOM stability — the image-decode signal waits for the
   * DOM to be free of mutations for this long before declaring images
   * settled, so late-hydrated <img> elements get picked up. */
  domQuietWindowMs?: number;
  /** Overall ceiling. Every per-signal timeout is clamped to this value, so
   * the whole call returns within roughly this budget even if a signal hangs. */
  overallTimeoutMs?: number;
}

const DEFAULT_SIGNAL_TIMEOUT_MS = 15_000;
const DEFAULT_OVERALL_TIMEOUT_MS = 60_000;
const DEFAULT_REQUEST_QUIET_WINDOW_MS = 500;
const DEFAULT_DOM_QUIET_WINDOW_MS = 500;

export async function waitUntilStable(
  page: Page,
  opts: WaitUntilStableOptions = {}
): Promise<ReadinessReport> {
  const overall = opts.overallTimeoutMs ?? DEFAULT_OVERALL_TIMEOUT_MS;
  const cap = (t: number) => Math.min(t, overall);

  const imagesTimeoutMs = cap(opts.imagesTimeoutMs ?? DEFAULT_SIGNAL_TIMEOUT_MS);
  const fontsTimeoutMs = cap(opts.fontsTimeoutMs ?? DEFAULT_SIGNAL_TIMEOUT_MS);
  const backgroundImagesTimeoutMs = cap(
    opts.backgroundImagesTimeoutMs ?? DEFAULT_SIGNAL_TIMEOUT_MS
  );
  const animationsTimeoutMs = cap(
    opts.animationsTimeoutMs ?? DEFAULT_SIGNAL_TIMEOUT_MS
  );
  const videosTimeoutMs = cap(opts.videosTimeoutMs ?? DEFAULT_SIGNAL_TIMEOUT_MS);
  const requestsTimeoutMs = cap(
    opts.requestsTimeoutMs ?? DEFAULT_SIGNAL_TIMEOUT_MS
  );
  const requestQuietWindowMs =
    opts.requestSettleQuietWindowMs ?? DEFAULT_REQUEST_QUIET_WINDOW_MS;
  const domQuietWindowMs =
    opts.domQuietWindowMs ?? DEFAULT_DOM_QUIET_WINDOW_MS;

  const [images, fonts, backgroundImages, animations, videos, requests] = await Promise.all([
    runSignal(() => waitForAllImages(page, domQuietWindowMs), imagesTimeoutMs),
    runSignal(() => waitForFonts(page), fontsTimeoutMs),
    runSignal(() => waitForBackgroundImages(page), backgroundImagesTimeoutMs),
    runSignal(() => settleAnimations(page), animationsTimeoutMs),
    runSignal(() => waitForVideos(page), videosTimeoutMs),
    runSignal(() => waitForRequestQuiet(page, requestQuietWindowMs), requestsTimeoutMs),
  ]);

  return { images, fonts, backgroundImages, animations, videos, requests };
}

async function runSignal(
  signal: () => Promise<void>,
  timeoutMs: number
): Promise<SignalOutcome> {
  return new Promise<SignalOutcome>((resolveOutcome) => {
    const timer = setTimeout(() => resolveOutcome("timeout"), timeoutMs);
    signal()
      .then(() => {
        clearTimeout(timer);
        resolveOutcome("fired");
      })
      .catch(() => {
        clearTimeout(timer);
        resolveOutcome("timeout");
      });
  });
}

async function waitForRequestQuiet(page: Page, quietWindowMs: number): Promise<void> {
  let lastResponseAt = Date.now();
  const onResponse = () => {
    lastResponseAt = Date.now();
  };
  page.on("response", onResponse);

  try {
    while (Date.now() - lastResponseAt < quietWindowMs) {
      const remaining = quietWindowMs - (Date.now() - lastResponseAt);
      await new Promise((resolveTick) => setTimeout(resolveTick, Math.max(remaining, 25)));
    }
  } finally {
    page.off("response", onResponse);
  }
}

async function waitForVideos(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const videos = Array.from(document.querySelectorAll<HTMLVideoElement>("video"));
    await Promise.all(
      videos.map(async (video) => {
        // 1. If the video has a source, wait for metadata so it lays out at
        //    its intrinsic dimensions; otherwise this is a no-op.
        if (video.readyState < 1 && (video.currentSrc || video.src)) {
          await new Promise<void>((resolveMeta) => {
            const settle = () => resolveMeta();
            video.addEventListener("loadedmetadata", settle, { once: true });
            video.addEventListener("error", settle, { once: true });
          });
        }
        // 2. If the video has a poster, force-load and decode it so the still
        //    is in the raster before screenshot.
        const poster = video.getAttribute("poster");
        if (poster) {
          const absolute = new URL(poster, document.baseURI).toString();
          await new Promise<void>((resolveLoad) => {
            const img = new Image();
            const settle = () => resolveLoad();
            img.addEventListener("load", async () => {
              try {
                if (typeof img.decode === "function") await img.decode();
              } catch {
                /* ignore */
              }
              settle();
            }, { once: true });
            img.addEventListener("error", settle, { once: true });
            img.src = absolute;
          });
        }
      })
    );
  });
}

async function settleAnimations(page: Page): Promise<void> {
  await page.evaluate(() => {
    const style = document.createElement("style");
    style.setAttribute("data-page-ready-detector", "animation-freeze");
    style.textContent = `*, *::before, *::after {
      animation-play-state: paused !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }`;
    document.head.appendChild(style);

    for (const anim of document.getAnimations()) {
      try {
        anim.pause();
      } catch {
        /* ignore */
      }
    }
  });
}

async function waitForBackgroundImages(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const urlPattern = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^)\s]+))\s*\)/g;
    const seen = new Set<string>();
    const sources: string[] = [];

    for (const el of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
      const style = getComputedStyle(el);
      const bg = style.backgroundImage;
      if (!bg || bg === "none") continue;
      let m: RegExpExecArray | null;
      urlPattern.lastIndex = 0;
      while ((m = urlPattern.exec(bg))) {
        const raw = m[1] ?? m[2] ?? m[3];
        if (!raw || raw.startsWith("data:")) continue;
        const absolute = new URL(raw, document.baseURI).toString();
        if (!seen.has(absolute)) {
          seen.add(absolute);
          sources.push(absolute);
        }
      }
    }

    await Promise.all(
      sources.map(
        (src) =>
          new Promise<void>((resolveLoad) => {
            const img = new Image();
            const settle = () => resolveLoad();
            img.addEventListener("load", async () => {
              try {
                if (typeof img.decode === "function") await img.decode();
              } catch {
                /* decode rejects for broken images; treat as settled */
              }
              settle();
            }, { once: true });
            img.addEventListener("error", settle, { once: true });
            img.src = src;
          })
      )
    );
  });
}

async function waitForFonts(page: Page): Promise<void> {
  await page.evaluate(async () => {
    if (!document.fonts) return;
    // Fast path: if the FontFaceSet is already settled, do not wait on
    // document.fonts.ready — some browsers defer that promise's resolution
    // until the document itself reaches "loaded", which is too coupled to
    // unrelated page-load progress.
    if (document.fonts.status === "loaded" && document.fonts.size === 0) {
      return;
    }
    if (typeof document.fonts.ready?.then === "function") {
      await document.fonts.ready;
    }
  });
}

async function waitForAllImages(page: Page, domQuietWindowMs: number): Promise<void> {
  await page.evaluate(async (quietWindowMs) => {
    // Poll-and-observe loop so that late-inserted or late-src'd images are
    // picked up. Pure addEventListener-based waiting binds to the elements
    // present at start, which misses React-style reconciliation that
    // replaces nodes wholesale.
    //
    // The observer only treats *image-relevant* mutations as activity — an
    // <img> being added/removed, or its src/srcset attribute changing.
    // Unrelated DOM churn (analytics tickers, framework idle work) does not
    // reset the quiet window, otherwise pages with any background activity
    // would never converge.
    let lastChangeAt = Date.now();
    const involvesImage = (node: Node): boolean => {
      if (node.nodeType !== 1 /* Node.ELEMENT_NODE */) return false;
      const el = node as Element;
      return el.tagName === "IMG" || !!el.querySelector?.("img");
    };
    const observer = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "attributes") {
          // attributeFilter restricts us to src/srcset, so any hit here is
          // an image mutation.
          lastChangeAt = Date.now();
          return;
        }
        if (r.type === "childList") {
          for (const n of r.addedNodes) if (involvesImage(n)) {
            lastChangeAt = Date.now();
            return;
          }
          for (const n of r.removedNodes) if (involvesImage(n)) {
            lastChangeAt = Date.now();
            return;
          }
        }
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "srcset"],
    });

    const isPending = (img: HTMLImageElement): boolean => {
      // An <img src=""> has complete=true but naturalWidth=0 because the
      // browser never issued a request. We treat it as "not pending" — there
      // is nothing concrete to wait for; the DOM-quiet window will catch it
      // if JS later sets the src.
      if (!img.getAttribute("src") && !img.getAttribute("srcset")) return false;
      return !(img.complete && img.naturalWidth > 0);
    };

    try {
      while (true) {
        const pending = Array.from(document.images).filter(isPending);
        if (pending.length > 0) {
          await Promise.all(
            pending.map(
              (img) =>
                new Promise<void>((settle) => {
                  const done = () => settle();
                  img.addEventListener("load", done, { once: true });
                  img.addEventListener("error", done, { once: true });
                })
            )
          );
          continue; // re-check; new images may have appeared during the wait
        }
        if (Date.now() - lastChangeAt >= quietWindowMs) break;
        await new Promise((tick) => setTimeout(tick, 50));
      }

      // Decode pass on every loaded image so the bitmap is in the raster
      // before screenshot.
      const loaded = Array.from(document.images).filter(
        (img) => img.complete && img.naturalWidth > 0
      );
      await Promise.all(
        loaded.map(async (img) => {
          if (typeof img.decode === "function") {
            try {
              await img.decode();
            } catch {
              /* ignore decode errors */
            }
          }
        })
      );
    } finally {
      observer.disconnect();
    }
  }, domQuietWindowMs);
}
