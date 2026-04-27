async function extractErrorMessage(response: Response): Promise<string> {
  const fallback = `${response.status} ${response.statusText}`;
  try {
    const data = await response.json();
    if (data && typeof data.error === "string") return data.error;
  } catch {
    // ignore parse failure
  }
  return fallback;
}

export function createHttpClient(baseUrl: string) {
  async function get(path: string): Promise<unknown> {
    const response = await fetch(`${baseUrl}${path}`);
    if (!response.ok) {
      throw new Error(await extractErrorMessage(response));
    }
    return response.json();
  }

  async function post(path: string, body?: unknown): Promise<unknown> {
    const hasBody = body !== undefined;
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: hasBody ? { "Content-Type": "application/json" } : {},
      body: hasBody ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new Error(await extractErrorMessage(response));
    }
    return response.json();
  }

  async function getOrNull(path: string): Promise<unknown> {
    const response = await fetch(`${baseUrl}${path}`);
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(await extractErrorMessage(response));
    }
    return response.json();
  }

  return { get, post, getOrNull };
}
