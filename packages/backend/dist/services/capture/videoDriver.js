/** Max time to wait for video metadata to load (ms). */
const METADATA_TIMEOUT_MS = 3_000;
/** Deterministic seek position as a fraction of duration (0–1). */
const SEEK_FRACTION = 0.15;
// Activate video elements before tile capture so they show a poster or
// representative frame instead of a blank/grey placeholder. Call this after
// scrolling to the tile where videos are visible.
export async function activateVideos(page, videoSelectors) {
    if (videoSelectors.length === 0)
        return [];
    return page.evaluate(async ([selectors, metaTimeoutMs, seekFraction]) => {
        const results = [];
        for (const sel of selectors) {
            // Find video by parsing the selector index.
            const match = /^video.*:nth\((\d+)\)$/.exec(sel);
            const idx = match ? parseInt(match[1], 10) : 0;
            const videos = document.querySelectorAll("video");
            const el = videos[idx];
            if (!el) {
                results.push({ selector: sel, status: "skipped", warning: "element not found" });
                continue;
            }
            // Cross-origin check.
            if (el.crossOrigin !== null) {
                results.push({
                    selector: sel,
                    status: "cross-origin",
                    warning: `video[${idx}]: cross-origin restrictions prevent access`,
                });
                continue;
            }
            // If the poster is set and the video hasn't loaded metadata yet, the
            // poster is the best representative image available. Mark as done.
            if (el.poster && (el.readyState === 0 || el.readyState === 1)) {
                results.push({ selector: sel, status: "poster" });
                continue;
            }
            // Wait for metadata if needed.
            if (el.readyState < 1) {
                el.load();
                const metadataLoaded = await Promise.race([
                    new Promise((resolve) => {
                        el.addEventListener("loadedmetadata", () => resolve(true), { once: true });
                    }),
                    new Promise((resolve) => setTimeout(() => resolve(false), metaTimeoutMs)),
                ]);
                if (!metadataLoaded) {
                    results.push({
                        selector: sel,
                        status: "metadata-timeout",
                        warning: `video[${idx}]: metadata load timed out after ${metaTimeoutMs}ms`,
                    });
                    continue;
                }
            }
            // Attempt bounded muted inline playback or seeking.
            const duration = el.duration;
            if (Number.isFinite(duration) && duration > 0) {
                const target = Math.min(duration * seekFraction, duration - 0.1);
                try {
                    el.muted = true;
                    el.playsInline = true;
                    el.currentTime = target;
                    // Trigger seek by briefly playing, then pausing.
                    const played = await Promise.race([
                        el.play().then(() => true).catch(() => false),
                        new Promise((resolve) => setTimeout(() => resolve(false), 2_000)),
                    ]);
                    if (played) {
                        el.pause();
                        results.push({ selector: sel, status: "frame-captured" });
                    }
                    else {
                        results.push({
                            selector: sel,
                            status: "autoplay-blocked",
                            warning: `video[${idx}]: autoplay blocked — browser policy prevented inline play`,
                        });
                    }
                }
                catch {
                    results.push({
                        selector: sel,
                        status: "decode-failure",
                        warning: `video[${idx}]: seek/play failed`,
                    });
                }
            }
            else if (el.poster) {
                // No finite duration but has a poster — that's the best we can do.
                results.push({ selector: sel, status: "poster" });
            }
            else {
                results.push({
                    selector: sel,
                    status: "blank-frame",
                    warning: `video[${idx}]: no duration and no poster`,
                });
            }
        }
        return results;
    }, [videoSelectors, METADATA_TIMEOUT_MS, SEEK_FRACTION]);
}
