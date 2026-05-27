import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const PAGES_DIR = resolve(fileURLToPath(new URL("./pages", import.meta.url)));

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
};

export interface FixtureServer {
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startFixtureServer(): Promise<FixtureServer> {
  const server = createServer(async (req, res) => {
    try {
      await handleRequest(req, res);
    } catch (error) {
      res.statusCode = 500;
      res.end(error instanceof Error ? error.message : String(error));
    }
  });

  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Fixture server failed to bind to a port");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    close: () =>
      new Promise<void>((resolveClose, rejectClose) =>
        server.close((err) => (err ? rejectClose(err) : resolveClose()))
      ),
  };
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const delayMs = parsePositiveInt(url.searchParams.get("delay"));
  if (delayMs > 0) {
    await sleep(delayMs);
  }

  // Long-polling fixture endpoint: never responds within the test budget.
  if (url.pathname === "/__never__") {
    return;
  }

  // Synthetic font endpoint — bytes are not a real font, but the browser will
  // still issue the request, wait for the delay, and resolve document.fonts.ready
  // after the load attempt completes (success or error). Sufficient for testing
  // that the detector waited for the network round-trip.
  if (url.pathname === "/test.font") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "font/woff2");
    res.setHeader("Cache-Control", "no-store");
    res.end(Buffer.from([0x77, 0x4f, 0x46, 0x32])); // "wOF2" magic, invalid body
    return;
  }

  // Synthetic PNG for image-decode fixtures; size is configurable via ?size=NxN.
  if (url.pathname === "/test.png") {
    const size = parseSize(url.searchParams.get("size")) ?? { width: 64, height: 64 };
    const buf = await sharp({
      create: {
        width: size.width,
        height: size.height,
        channels: 4,
        background: { r: 255, g: 64, b: 128, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    res.statusCode = 200;
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    res.end(buf);
    return;
  }

  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(requested).replace(/^([./\\])+/, "");
  const filePath = join(PAGES_DIR, safePath);

  if (!filePath.startsWith(PAGES_DIR)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    const body = await readFile(filePath);
    res.statusCode = 200;
    res.setHeader("Content-Type", CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end("Not found");
  }
}

function parseSize(raw: string | null): { width: number; height: number } | null {
  if (!raw) return null;
  const match = /^(\d+)x(\d+)$/.exec(raw);
  if (!match || !match[1] || !match[2]) return null;
  return { width: Number.parseInt(match[1], 10), height: Number.parseInt(match[2], 10) };
}

function parsePositiveInt(raw: string | null): number {
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
