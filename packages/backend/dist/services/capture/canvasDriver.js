/** How long to let a canvas/SVG animate before freezing it (ms). */
const WARMUP_DURATION_MS = 600;
/** Max warm-up budget per surface (ms). */
const WARMUP_TIMEOUT_MS = 2_000;
// Warm up canvas, SVG-animation, and custom animated elements so they paint
// at least one visible frame before the tile screenshot. Call this after
// scrolling to the tile, before the tile screenshot.
export async function warmUpAnimatedRegions(page, selectors, kinds) {
    if (selectors.length === 0)
        return [];
    return page.evaluate(async ([sels, kindList, warmupDurationMs, warmupTimeoutMs]) => {
        const results = [];
        for (let i = 0; i < sels.length; i++) {
            const sel = sels[i];
            const kind = kindList[i] ?? "unknown";
            const rawSel = sel.replace(/:nth\(\d+\)$/, "");
            const match = /:nth\((\d+)\)$/.exec(sel);
            const idx = match ? parseInt(match[1], 10) : 0;
            // Find the element.
            const candidates = document.querySelectorAll(rawSel || sel);
            const el = candidates[idx];
            if (!el) {
                results.push({ selector: sel, status: "skipped", warning: "element not found" });
                continue;
            }
            // For canvas elements, check if tainted (cross-origin).
            if (kind === "canvas") {
                let isTainted = false;
                try {
                    const ctx = el.getContext("2d");
                    if (ctx)
                        ctx.getImageData(0, 0, 1, 1);
                }
                catch {
                    isTainted = true;
                }
                if (isTainted) {
                    results.push({
                        selector: sel,
                        status: "blocked",
                        warning: `canvas at '${sel}' is tainted — cannot warm up`,
                    });
                    continue;
                }
            }
            // Scroll element into view to trigger intersection-observer-based init.
            el.scrollIntoView({ behavior: "instant", block: "nearest" });
            // Let animations run for warmupDurationMs.
            await new Promise((resolve) => setTimeout(resolve, warmupDurationMs));
            // Freeze CSS animations so we get a stable frame.
            el.style.animationPlayState = "paused";
            const children = el.querySelectorAll("*");
            children.forEach((child) => {
                child.style.animationPlayState = "paused";
            });
            // For SVG animations, use SVGSVGElement.pauseAnimations().
            if (kind === "svg-animation") {
                const svg = kind === "svg-animation" ? el : null;
                if (svg && typeof svg.pauseAnimations === "function") {
                    svg.pauseAnimations();
                    results.push({ selector: sel, status: "frozen" });
                    continue;
                }
            }
            results.push({ selector: sel, status: "warmed" });
        }
        return results;
    }, [selectors, kinds, WARMUP_DURATION_MS, WARMUP_TIMEOUT_MS]);
}
