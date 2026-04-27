import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHttpClient } from "./httpClient.js";

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("createHttpClient.get", () => {
  it("returns parsed JSON on success", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { pages: [] }));
    const client = createHttpClient("http://localhost:3006");
    const result = await client.get("/pages");
    expect(result).toEqual({ pages: [] });
  });

  it("throws with status text on non-ok response", async () => {
    vi.stubGlobal("fetch", mockFetch(500, {}));
    const client = createHttpClient("http://localhost:3006");
    await expect(client.get("/pages")).rejects.toThrow("500");
  });

  it("extracts error message from JSON body when present", async () => {
    vi.stubGlobal("fetch", mockFetch(400, { error: "Project not found" }));
    const client = createHttpClient("http://localhost:3006");
    await expect(client.get("/pages")).rejects.toThrow("Project not found");
  });

  it("falls back to status text when JSON body has no error field", async () => {
    vi.stubGlobal("fetch", mockFetch(503, { message: "down" }));
    const client = createHttpClient("http://localhost:3006");
    await expect(client.get("/pages")).rejects.toThrow("503");
  });
});

describe("createHttpClient.post", () => {
  it("sends Content-Type and JSON body", async () => {
    const fetchMock = mockFetch(200, { jobId: "abc" });
    vi.stubGlobal("fetch", fetchMock);
    const client = createHttpClient("http://localhost:3006");
    await client.post("/crawl", { url: "https://example.com" });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(options.body)).toEqual({ url: "https://example.com" });
  });

  it("throws with JSON error message on non-ok response", async () => {
    vi.stubGlobal("fetch", mockFetch(422, { error: "Invalid URL" }));
    const client = createHttpClient("http://localhost:3006");
    await expect(client.post("/crawl", {})).rejects.toThrow("Invalid URL");
  });

  it("sends no Content-Type or body when called without a body argument", async () => {
    const fetchMock = mockFetch(200, { jobId: "xyz" });
    vi.stubGlobal("fetch", fetchMock);
    const client = createHttpClient("http://localhost:3006");
    await client.post("/inventory/prepare/4");

    const [, options] = fetchMock.mock.calls[0];
    expect(options.body).toBeUndefined();
    expect(options.headers["Content-Type"]).toBeUndefined();
  });
});

describe("createHttpClient.getOrNull", () => {
  it("returns null on 404", async () => {
    vi.stubGlobal("fetch", mockFetch(404, {}));
    const client = createHttpClient("http://localhost:3006");
    const result = await client.getOrNull("/page?pageId=99");
    expect(result).toBeNull();
  });

  it("returns parsed JSON on success", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { page: { id: 1 } }));
    const client = createHttpClient("http://localhost:3006");
    const result = await client.getOrNull("/page?pageId=1");
    expect(result).toEqual({ page: { id: 1 } });
  });

  it("throws on non-404 errors", async () => {
    vi.stubGlobal("fetch", mockFetch(500, {}));
    const client = createHttpClient("http://localhost:3006");
    await expect(client.getOrNull("/page?pageId=1")).rejects.toThrow("500");
  });
});
