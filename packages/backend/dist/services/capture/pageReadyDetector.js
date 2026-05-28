import { sleep } from "./sleep.js";
const DEFAULT_SIGNAL_TIMEOUT_MS = 15_000;
const DEFAULT_OVERALL_TIMEOUT_MS = 60_000;
const DEFAULT_REQUEST_QUIET_WINDOW_MS = 500;
const DEFAULT_DOM_QUIET_WINDOW_MS = 500;
const DEFAULT_VISUAL_STABILITY_QUIET_WINDOW_MS = 800;
export async function waitUntilStable(page, opts = {}) {
    const overall = opts.overallTimeoutMs ?? DEFAULT_OVERALL_TIMEOUT_MS;
    const cap = (t) => Math.min(t, overall);
    const imagesTimeoutMs = cap(opts.imagesTimeoutMs ?? DEFAULT_SIGNAL_TIMEOUT_MS);
    const fontsTimeoutMs = cap(opts.fontsTimeoutMs ?? DEFAULT_SIGNAL_TIMEOUT_MS);
    const backgroundImagesTimeoutMs = cap(opts.backgroundImagesTimeoutMs ?? DEFAULT_SIGNAL_TIMEOUT_MS);
    const animationsTimeoutMs = cap(opts.animationsTimeoutMs ?? DEFAULT_SIGNAL_TIMEOUT_MS);
    const videosTimeoutMs = cap(opts.videosTimeoutMs ?? DEFAULT_SIGNAL_TIMEOUT_MS);
    const requestsTimeoutMs = cap(opts.requestsTimeoutMs ?? DEFAULT_SIGNAL_TIMEOUT_MS);
    const requestQuietWindowMs = opts.requestSettleQuietWindowMs ?? DEFAULT_REQUEST_QUIET_WINDOW_MS;
    const domQuietWindowMs = opts.domQuietWindowMs ?? DEFAULT_DOM_QUIET_WINDOW_MS;
    const visualStabilityQuietWindowMs = cap(opts.visualStabilityQuietWindowMs ?? DEFAULT_VISUAL_STABILITY_QUIET_WINDOW_MS);
    const [images, fonts, backgroundImages, animations, videos, requests, visualStability] = await Promise.all([
        runSignal(() => waitForAllImages(page, domQuietWindowMs), imagesTimeoutMs),
        runSignal(() => waitForFonts(page), fontsTimeoutMs),
        runSignal(() => waitForBackgroundImages(page), backgroundImagesTimeoutMs),
        runSignal(() => settleAnimations(page), animationsTimeoutMs),
        runSignal(() => waitForVideos(page), videosTimeoutMs),
        runSignal(() => waitForRequestQuiet(page, requestQuietWindowMs), requestsTimeoutMs),
        runSignal(() => waitForVisualStability(page, visualStabilityQuietWindowMs), overall),
    ]);
    const imagesDiagnostic = images === "timeout"
        ? await collectImagesDiagnostic(page)
        : undefined;
    return { images, fonts, backgroundImages, animations, videos, requests, visualStability, imagesDiagnostic };
}
async function collectImagesDiagnostic(page) {
    return page
        .evaluate(() => {
        return Array.from(document.images)
            .filter((img) => {
            const hasSrc = !!(img.getAttribute("src") || img.getAttribute("srcset"));
            if (!hasSrc)
                return false;
            // complete=true covers both successfully loaded and errored images.
            if (img.complete && img.naturalWidth > 0)
                return false;
            return true;
        })
            .slice(0, 20)
            .map((img) => {
            const src = (img.currentSrc || img.src || img.getAttribute("srcset") || "").slice(0, 120);
            return `${src} complete=${img.complete} naturalWidth=${img.naturalWidth}`;
        });
    })
        .catch(() => []);
}
async function runSignal(signal, timeoutMs) {
    return new Promise((resolveOutcome) => {
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
async function waitForVisualStability(page, quietWindowMs) {
    let lastSnapshot = "";
    let lastChangeAt = Date.now();
    while (true) {
        const snapshot = await page
            .evaluate(() => {
            const all = document.querySelectorAll("*");
            const visible = [];
            const maxDocumentHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, window.innerHeight);
            for (let i = 0; i < all.length && visible.length < 250; i++) {
                const el = all[i];
                if (!el)
                    continue;
                const r = el.getBoundingClientRect();
                if (r.width <= 0 || r.height <= 0)
                    continue;
                const absoluteTop = r.top + window.scrollY;
                if (absoluteTop > maxDocumentHeight)
                    continue;
                const style = window.getComputedStyle(el);
                if (style.visibility === "hidden" || style.display === "none")
                    continue;
                const element = el;
                const img = el instanceof HTMLImageElement ? el : null;
                visible.push([
                    element.tagName,
                    Math.round(r.left + window.scrollX),
                    Math.round(absoluteTop),
                    Math.round(r.width),
                    Math.round(r.height),
                    style.opacity,
                    style.color,
                    style.backgroundColor,
                    style.backgroundImage,
                    img?.currentSrc || img?.src || "",
                ].join(","));
            }
            return visible.join("|");
        })
            .catch(() => "");
        if (snapshot !== lastSnapshot) {
            lastSnapshot = snapshot;
            lastChangeAt = Date.now();
        }
        if (Date.now() - lastChangeAt >= quietWindowMs)
            break;
        await sleep(100);
    }
}
async function waitForRequestQuiet(page, quietWindowMs) {
    let lastResponseAt = Date.now();
    const onResponse = () => {
        lastResponseAt = Date.now();
    };
    page.on("response", onResponse);
    try {
        while (Date.now() - lastResponseAt < quietWindowMs) {
            const remaining = quietWindowMs - (Date.now() - lastResponseAt);
            await sleep(Math.max(remaining, 25));
        }
    }
    finally {
        page.off("response", onResponse);
    }
}
async function waitForVideos(page) {
    await page.evaluate(async () => {
        const videos = Array.from(document.querySelectorAll("video"));
        await Promise.all(videos.map(async (video) => {
            // 1. If the video has a source, wait for metadata so it lays out at
            //    its intrinsic dimensions; otherwise this is a no-op.
            if (video.readyState < 1 && (video.currentSrc || video.src)) {
                await new Promise((resolveMeta) => {
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
                await new Promise((resolveLoad) => {
                    const img = new Image();
                    const settle = () => resolveLoad();
                    img.addEventListener("load", async () => {
                        try {
                            if (typeof img.decode === "function")
                                await img.decode();
                        }
                        catch {
                            /* ignore */
                        }
                        settle();
                    }, { once: true });
                    img.addEventListener("error", settle, { once: true });
                    img.src = absolute;
                });
            }
        }));
    });
}
// One-shot: the injected <style> is never removed and the document.getAnimations()
// pause is never resumed. Callers must discard the page after a capture.
async function settleAnimations(page) {
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
            }
            catch {
                /* ignore */
            }
        }
    });
}
async function waitForBackgroundImages(page) {
    await page.evaluate(async () => {
        const urlPattern = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^)\s]+))\s*\)/g;
        const seen = new Set();
        const sources = [];
        for (const el of Array.from(document.querySelectorAll("*"))) {
            const style = getComputedStyle(el);
            const bg = style.backgroundImage;
            if (!bg || bg === "none")
                continue;
            let m;
            urlPattern.lastIndex = 0;
            while ((m = urlPattern.exec(bg))) {
                const raw = m[1] ?? m[2] ?? m[3];
                if (!raw || raw.startsWith("data:"))
                    continue;
                const absolute = new URL(raw, document.baseURI).toString();
                if (!seen.has(absolute)) {
                    seen.add(absolute);
                    sources.push(absolute);
                }
            }
        }
        await Promise.all(sources.map((src) => new Promise((resolveLoad) => {
            const img = new Image();
            const settle = () => resolveLoad();
            img.addEventListener("load", async () => {
                try {
                    if (typeof img.decode === "function")
                        await img.decode();
                }
                catch {
                    /* decode rejects for broken images; treat as settled */
                }
                settle();
            }, { once: true });
            img.addEventListener("error", settle, { once: true });
            img.src = src;
        })));
    });
}
async function waitForFonts(page) {
    await page.evaluate(async () => {
        if (!document.fonts)
            return;
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
async function waitForAllImages(page, domQuietWindowMs) {
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
        const involvesImage = (node) => {
            if (node.nodeType !== 1 /* Node.ELEMENT_NODE */)
                return false;
            const el = node;
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
                    for (const n of r.addedNodes)
                        if (involvesImage(n)) {
                            lastChangeAt = Date.now();
                            return;
                        }
                    for (const n of r.removedNodes)
                        if (involvesImage(n)) {
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
        const isPending = (img) => {
            if (!img.getAttribute("src") && !img.getAttribute("srcset"))
                return false;
            // complete=true means the browser is done — either successfully loaded
            // (naturalWidth>0) or errored/blocked (naturalWidth=0). Both are
            // terminal states: no further load/error events will fire, so adding
            // listeners would block forever. Treat both as settled.
            if (img.complete)
                return false;
            return true;
        };
        try {
            while (true) {
                const pending = Array.from(document.images).filter(isPending);
                if (pending.length > 0) {
                    await Promise.all(pending.map((img) => new Promise((settle) => {
                        const done = () => settle();
                        img.addEventListener("load", done, { once: true });
                        img.addEventListener("error", done, { once: true });
                    })));
                    continue; // re-check; new images may have appeared during the wait
                }
                if (Date.now() - lastChangeAt >= quietWindowMs)
                    break;
                await new Promise((tick) => setTimeout(tick, 50));
            }
            // Decode pass on every loaded image so the bitmap is in the raster
            // before screenshot.
            const loaded = Array.from(document.images).filter((img) => img.complete && img.naturalWidth > 0);
            await Promise.all(loaded.map(async (img) => {
                if (typeof img.decode === "function") {
                    try {
                        await img.decode();
                    }
                    catch {
                        /* ignore decode errors */
                    }
                }
            }));
        }
        finally {
            observer.disconnect();
        }
    }, domQuietWindowMs);
}
