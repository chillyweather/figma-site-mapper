/** Deterministic progress to seek to (0–1). */
const SEEK_PROGRESS = 0.2;
/** Max time to wait for a player to become controllable (ms). */
const WARMUP_TIMEOUT_MS = 2_500;
// Activate known Lottie/dotLottie player elements to show a representative
// frame before tile capture. Call this after scrolling to the tile where
// players are visible, before the tile screenshot.
export async function activateLottiePlayers(page, lottieSelectors) {
    if (lottieSelectors.length === 0)
        return [];
    return page.evaluate(async ([selectors, seekProgress, warmupTimeoutMs]) => {
        const results = [];
        for (const sel of selectors) {
            // Find the element matching the selector pattern.
            const rawSel = sel.replace(/:nth\(\d+\)$/, "");
            const match = /:nth\((\d+)\)$/.exec(sel);
            const idx = match ? parseInt(match[1], 10) : 0;
            const candidates = document.querySelectorAll(rawSel);
            const el = candidates[idx];
            if (!el) {
                results.push({ selector: sel, status: "skipped", warning: "element not found" });
                continue;
            }
            // Try lottie-player API (lottie-web / @lottiefiles/lottie-player).
            const lottieEl = el;
            // Strategy 1: lottie-player native seek/pause API.
            if (typeof lottieEl.seek === "function" && typeof lottieEl.pause === "function") {
                try {
                    lottieEl.seek(`${Math.round(seekProgress * 100)}%`);
                    lottieEl.pause();
                    results.push({ selector: sel, status: "seeked" });
                    continue;
                }
                catch {
                    // Fall through to next strategy.
                }
            }
            // Strategy 2: underlying lottie animation object via getLottie().
            if (typeof lottieEl.getLottie === "function") {
                try {
                    const anim = lottieEl.getLottie();
                    if (anim && typeof anim.goToAndStop === "function" && anim.totalFrames) {
                        const frame = Math.round(anim.totalFrames * seekProgress);
                        anim.goToAndStop(frame, true);
                        results.push({ selector: sel, status: "seeked" });
                        continue;
                    }
                }
                catch {
                    // Fall through.
                }
            }
            // Strategy 3: bounded warm-up wait — let the animation run for a
            // moment so it gets past the initial blank frame, then freeze it by
            // pausing via CSS animation-play-state.
            const warmupDone = await new Promise((resolve) => {
                const timer = setTimeout(() => resolve(false), warmupTimeoutMs);
                // Poll until the element has visible rendered content (non-white bbox).
                let pollCount = 0;
                const poll = setInterval(() => {
                    pollCount++;
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        clearInterval(poll);
                        clearTimeout(timer);
                        resolve(true);
                    }
                    if (pollCount > 50) {
                        clearInterval(poll);
                        clearTimeout(timer);
                        resolve(false);
                    }
                }, warmupTimeoutMs / 50);
            });
            if (warmupDone) {
                // Freeze animations via CSS to capture a stable frame.
                el.style.animationPlayState = "paused";
                const children = el.querySelectorAll("*");
                children.forEach((child) => {
                    child.style.animationPlayState = "paused";
                });
                results.push({ selector: sel, status: "warmup" });
            }
            else {
                results.push({
                    selector: sel,
                    status: "timeout",
                    warning: `lottie element at '${sel}' did not become controllable within ${warmupTimeoutMs}ms`,
                });
            }
        }
        return results;
    }, [lottieSelectors, SEEK_PROGRESS, WARMUP_TIMEOUT_MS]);
}
