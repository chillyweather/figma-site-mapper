import type { Page } from "playwright";
import { sleep } from "./sleep.js";

export interface TriggerLazyContentOptions {
  /** Quiet window between scroll steps — wait this long with no new network
   * responses before advancing to the next viewport. */
  quietWindowMs?: number;
  /** Hard cap on total steps so infinite-scroll pages cannot loop forever. */
  maxSteps?: number;
  /** Overall ceiling regardless of step count. */
  overallTimeoutMs?: number;
}

const DEFAULT_QUIET_WINDOW_MS = 400;
const DEFAULT_MAX_STEPS = 40;
const DEFAULT_OVERALL_TIMEOUT_MS = 30_000;

export async function triggerLazyContent(
  page: Page,
  opts: TriggerLazyContentOptions = {}
): Promise<void> {
  const quietWindowMs = opts.quietWindowMs ?? DEFAULT_QUIET_WINDOW_MS;
  const maxSteps = opts.maxSteps ?? DEFAULT_MAX_STEPS;
  const overallTimeoutMs = opts.overallTimeoutMs ?? DEFAULT_OVERALL_TIMEOUT_MS;

  const deadline = Date.now() + overallTimeoutMs;
  let lastResponseAt = Date.now();
  const onResponse = () => {
    lastResponseAt = Date.now();
  };
  page.on("response", onResponse);

  try {
    for (let step = 0; step < maxSteps; step++) {
      if (Date.now() >= deadline) break;

      const { reachedBottom } = await page.evaluate(() => {
        const viewportHeight = window.innerHeight;
        const before = window.scrollY;
        window.scrollBy(0, viewportHeight);
        const after = window.scrollY;
        const maxScroll =
          (document.documentElement.scrollHeight || document.body.scrollHeight) -
          window.innerHeight;
        return { reachedBottom: after === before || after >= maxScroll };
      });

      await waitForQuiet(quietWindowMs, () => lastResponseAt, deadline);

      if (reachedBottom) break;
    }
  } finally {
    page.off("response", onResponse);
  }

  // Return scrolled to top — leaves the page in a known state for the
  // subsequent screenshot.
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
}

async function waitForQuiet(
  quietWindowMs: number,
  getLastResponseAt: () => number,
  deadline: number
): Promise<void> {
  while (Date.now() < deadline) {
    const sinceLast = Date.now() - getLastResponseAt();
    if (sinceLast >= quietWindowMs) return;
    const remaining = quietWindowMs - sinceLast;
    await sleep(Math.max(remaining, 25));
  }
}
