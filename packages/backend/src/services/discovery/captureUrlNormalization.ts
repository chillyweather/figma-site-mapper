export function effectiveCaptureUrlKey(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith("www.")) {
      host = host.slice(4);
    }
    const port = parsed.port ? `:${parsed.port}` : "";
    let pathname = parsed.pathname.replace(/\/{2,}/g, "/");
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    return `${parsed.protocol}//${host}${port}${pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

export function dedupeEffectiveCaptureUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const url of urls) {
    const key = effectiveCaptureUrlKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(url);
  }
  return deduped;
}

export function getUrlLookupCandidates(rawUrl: string): string[] {
  const candidates = new Set<string>();
  const add = (value: string | null | undefined) => {
    if (value && value.trim()) candidates.add(value.trim());
  };

  add(rawUrl);

  try {
    const parsed = new URL(rawUrl);
    parsed.hash = "";
    add(parsed.toString());

    if (parsed.pathname !== "/") {
      const originalPath = parsed.pathname;
      if (originalPath.endsWith("/")) {
        parsed.pathname = originalPath.replace(/\/+$/, "") || "/";
      } else {
        parsed.pathname = `${originalPath}/`;
      }
      add(parsed.toString());
    }
  } catch {
    // Keep the raw candidate only for non-URL values.
  }

  return Array.from(candidates);
}
