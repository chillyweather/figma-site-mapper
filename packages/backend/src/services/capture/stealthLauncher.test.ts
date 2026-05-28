import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import { chromium as baselineChromium } from "playwright";
import { startFixtureServer, type FixtureServer } from "./__fixtures__/server.js";
import {
  applyStealthContextDefaults,
  getStealthLauncher,
  pickStealthUserAgent,
  STEALTH_HTTP_HEADERS,
} from "./stealthLauncher.js";

interface FingerprintProbe {
  webdriver: unknown;
  pluginsLength: number;
  chromeRuntime: boolean;
  webglVendor: string | null;
  webglRenderer: string | null;
  notificationPermissionMatchesPermissionsQuery: boolean;
  acceptLanguage: string;
  userAgent: string;
}

async function probeBrowser(
  browser: Browser,
  baseUrl: string,
  options: { applyStealthDefaults: boolean }
): Promise<FingerprintProbe> {
  const context = await browser.newContext({
    userAgent: pickStealthUserAgent(),
    viewport: { width: 1280, height: 720 },
  });
  if (options.applyStealthDefaults) {
    await applyStealthContextDefaults(context);
  }
  const page = await context.newPage();
  await page.goto(`${baseUrl}/fingerprint-probe.html`);

  const probe = await page.evaluate(async () => {
    const webdriver = (navigator as Navigator & { webdriver?: unknown }).webdriver;
    const pluginsLength = navigator.plugins.length;
    const chromeRuntime = Boolean(
      (window as unknown as { chrome?: { runtime?: unknown } }).chrome?.runtime
    );

    let webglVendor: string | null = null;
    let webglRenderer: string | null = null;
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (gl) {
        const debugInfo = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
        if (debugInfo) {
          webglVendor = String(
            (gl as WebGLRenderingContext).getParameter(
              (debugInfo as { UNMASKED_VENDOR_WEBGL: number }).UNMASKED_VENDOR_WEBGL
            )
          );
          webglRenderer = String(
            (gl as WebGLRenderingContext).getParameter(
              (debugInfo as { UNMASKED_RENDERER_WEBGL: number }).UNMASKED_RENDERER_WEBGL
            )
          );
        }
      }
    } catch {
      // ignore
    }

    let notificationPermissionMatchesPermissionsQuery = true;
    try {
      const queryResult = await navigator.permissions.query({
        name: "notifications" as PermissionName,
      });
      notificationPermissionMatchesPermissionsQuery =
        queryResult.state === Notification.permission ||
        (queryResult.state === "prompt" && Notification.permission === "default");
    } catch {
      notificationPermissionMatchesPermissionsQuery = false;
    }

    const acceptLanguage = navigator.languages?.[0] ?? "";
    const userAgent = navigator.userAgent;
    return {
      webdriver,
      pluginsLength,
      chromeRuntime,
      webglVendor,
      webglRenderer,
      notificationPermissionMatchesPermissionsQuery,
      acceptLanguage,
      userAgent,
    };
  });

  await page.close();
  await context.close();
  return probe;
}

describe("stealth browser launcher (offline fingerprint probe)", () => {
  let server: FixtureServer;
  let stealthBrowser: Browser;
  let leakyBrowser: Browser;

  beforeAll(async () => {
    server = await startFixtureServer();
    const stealthLauncher = getStealthLauncher();
    stealthBrowser = await stealthLauncher.launch({ headless: true });
    leakyBrowser = await baselineChromium.launch({ headless: true });
  }, 60_000);

  afterAll(async () => {
    await stealthBrowser?.close().catch(() => undefined);
    await leakyBrowser?.close().catch(() => undefined);
    await server?.close();
  });

  it("picks a modern Chrome desktop user agent", () => {
    const ua = pickStealthUserAgent();
    expect(ua).toMatch(/Chrome\/\d+/);
    expect(ua).toMatch(/Mozilla\/5\.0/);
  });

  it("publishes the extra HTTP headers used at the context boundary", () => {
    expect(STEALTH_HTTP_HEADERS["Accept-Language"]).toBe("en-US,en;q=0.9");
    expect(STEALTH_HTTP_HEADERS["Sec-Ch-Ua-Mobile"]).toBe("?0");
  });

  it("hides navigator.webdriver compared with leaky Playwright defaults", async () => {
    const leaky = await probeBrowser(leakyBrowser, server.baseUrl, {
      applyStealthDefaults: false,
    });
    const stealth = await probeBrowser(stealthBrowser, server.baseUrl, {
      applyStealthDefaults: true,
    });

    expect(leaky.webdriver).toBe(true);
    expect(stealth.webdriver === false || stealth.webdriver === undefined).toBe(true);
  }, 60_000);

  it("populates navigator.plugins so the array length is plausible", async () => {
    const leaky = await probeBrowser(leakyBrowser, server.baseUrl, {
      applyStealthDefaults: false,
    });
    const stealth = await probeBrowser(stealthBrowser, server.baseUrl, {
      applyStealthDefaults: true,
    });

    expect(leaky.pluginsLength).toBe(0);
    expect(stealth.pluginsLength).toBeGreaterThan(0);
  }, 60_000);

  it("exposes chrome.runtime so bot detectors see a real browser shape", async () => {
    const leaky = await probeBrowser(leakyBrowser, server.baseUrl, {
      applyStealthDefaults: false,
    });
    const stealth = await probeBrowser(stealthBrowser, server.baseUrl, {
      applyStealthDefaults: true,
    });

    expect(leaky.chromeRuntime).toBe(false);
    expect(stealth.chromeRuntime).toBe(true);
  }, 60_000);

  it("returns a plausible WebGL vendor instead of a headless leak", async () => {
    const stealth = await probeBrowser(stealthBrowser, server.baseUrl, {
      applyStealthDefaults: true,
    });

    expect(stealth.webglVendor).not.toBeNull();
    expect(stealth.webglVendor).not.toMatch(/Brian Paul|Mesa\/X\.org/i);
  }, 60_000);

  it("makes permissions.query agree with Notification.permission", async () => {
    const stealth = await probeBrowser(stealthBrowser, server.baseUrl, {
      applyStealthDefaults: true,
    });

    expect(stealth.notificationPermissionMatchesPermissionsQuery).toBe(true);
  }, 60_000);
});
