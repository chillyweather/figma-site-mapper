import { chromium as stealthChromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { BrowserContext } from "playwright";

let pluginInstalled = false;
function ensureStealthPlugin(): void {
  if (pluginInstalled) return;
  stealthChromium.use(StealthPlugin());
  pluginInstalled = true;
}

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

// Only CORS-safelisted / client-hint headers may go here. setExtraHTTPHeaders
// injects headers into EVERY request including CORS-mode subresource fetches
// (webfonts, crossorigin scripts); non-safelisted headers like Cache-Control,
// Pragma, or Upgrade-Insecure-Requests make Chromium fail those requests with
// net::ERR_FAILED — fonts then silently fall back. Real Chrome also never
// sends those headers on subresources, so omitting them is the stealthier
// behaviour anyway.
export const STEALTH_HTTP_HEADERS: Record<string, string> = {
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-Ch-Ua":
    '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"macOS"',
};

export function pickStealthUserAgent(): string {
  const choice = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  return choice ?? USER_AGENTS[0]!;
}

export function getStealthLauncher(): typeof stealthChromium {
  ensureStealthPlugin();
  return stealthChromium;
}

export async function applyStealthContextDefaults(
  context: BrowserContext
): Promise<void> {
  await context.setExtraHTTPHeaders(STEALTH_HTTP_HEADERS);
  await context.addInitScript(() => {
    try {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    } catch {
      // ignore — stealth plugin already patched this
    }

    const w = window as unknown as {
      chrome?: { runtime?: Record<string, unknown> };
    };
    if (!w.chrome) {
      w.chrome = { runtime: {} };
    } else if (!w.chrome.runtime) {
      w.chrome.runtime = {};
    }
  });
}
