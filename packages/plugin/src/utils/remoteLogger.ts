/**
 * Remote logger for Figma plugin contexts (sandbox + UI iframe).
 *
 * Call `installRemoteConsoleOverride(source)` once in each entry point.
 * After that, every console.log/info/warn/error call:
 *   1. Still goes to the local DevTools console (unchanged behaviour).
 *   2. Also fire-and-forgets a POST /log to the backend, where pino writes
 *      it to the same rolling file used by all other backend logs.
 *
 * Failures (backend unreachable, serialization errors) are silently swallowed
 * so the plugin is never broken by logging.
 */

import { BACKEND_URL } from "../plugin/constants";

const LOG_ENDPOINT = `${BACKEND_URL}/log`;

// ─── Serialization ────────────────────────────────────────────────────────────

function serializeArg(arg: unknown): unknown {
  if (arg === null || arg === undefined) return arg;
  if (arg instanceof Error) return { errorMessage: arg.message, stack: arg.stack };
  if (typeof arg === "function") return `[Function: ${arg.name || "anonymous"}]`;
  return arg;
}

function argsToData(args: unknown[]): unknown {
  if (args.length === 0) return undefined;
  if (args.length === 1) return serializeArg(args[0]);
  return args.map(serializeArg);
}

function safeStringify(value: unknown): string | null {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(value, (_key, current) => {
      if (typeof current === "function") {
        return `[Function: ${current.name || "anonymous"}]`;
      }
      if (current instanceof Error) {
        return { errorMessage: current.message, stack: current.stack };
      }
      if (current && typeof current === "object") {
        if (seen.has(current)) return "[Circular]";
        seen.add(current);
      }
      return current;
    });
  } catch {
    return null;
  }
}

function getConsoleMethod(
  name: "log" | "info" | "warn" | "error" | "debug",
  fallback?: (...args: unknown[]) => void
): (...args: unknown[]) => void {
  const candidate = (console as Partial<Record<typeof name, unknown>>)[name];
  if (typeof candidate === "function") {
    return candidate.bind(console) as (...args: unknown[]) => void;
  }
  if (fallback) return fallback;
  return () => {};
}

// ─── Fire-and-forget POST ─────────────────────────────────────────────────────

function post(level: string, source: string, msg: string, data: unknown): void {
  // Fire and forget — intentionally not awaited.
  const body = safeStringify(
    data !== undefined ? { level, source, msg, data } : { level, source, msg }
  );
  if (!body) return;
  fetch(LOG_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  }).catch(() => {
    // silently ignore — backend may not be running
  });
}

// ─── Console override ─────────────────────────────────────────────────────────

/**
 * Wraps the global console.* methods so every call is forwarded to POST /log.
 * The original behaviour (DevTools output) is preserved.
 *
 * @param source  Label that appears in the backend log, e.g. "plugin:sandbox"
 *                or "plugin:ui". Visible as the `source` field in pino output.
 */
export function installRemoteConsoleOverride(source: string): void {
  const log = getConsoleMethod("log");
  const info = getConsoleMethod("info", log);
  const warn = getConsoleMethod("warn", log);
  const error = getConsoleMethod("error", warn);
  const debug = getConsoleMethod("debug", log);

  const original = { log, info, warn, error, debug };

  console.log = (...args: unknown[]) => {
    original.log(...args);
    const [msg, ...rest] = args;
    post("info", source, String(msg ?? ""), argsToData(rest));
  };

  console.info = (...args: unknown[]) => {
    original.info(...args);
    const [msg, ...rest] = args;
    post("info", source, String(msg ?? ""), argsToData(rest));
  };

  console.warn = (...args: unknown[]) => {
    original.warn(...args);
    const [msg, ...rest] = args;
    post("warn", source, String(msg ?? ""), argsToData(rest));
  };

  console.error = (...args: unknown[]) => {
    original.error(...args);
    const [msg, ...rest] = args;
    post("error", source, String(msg ?? ""), argsToData(rest));
  };

  console.debug = (...args: unknown[]) => {
    original.debug(...args);
    const [msg, ...rest] = args;
    post("debug", source, String(msg ?? ""), argsToData(rest));
  };

  original.log(`[RemoteLogger] console override installed — source="${source}", endpoint=${LOG_ENDPOINT}`);
}
