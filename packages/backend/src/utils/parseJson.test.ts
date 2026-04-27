import { describe, it, expect } from "vitest";
import { parseJson } from "./parseJson.js";

describe("parseJson", () => {
  it("parses valid JSON and returns the typed value", () => {
    expect(parseJson<string[]>('["a","b"]', [])).toEqual(["a", "b"]);
  });

  it("returns fallback for invalid JSON", () => {
    expect(parseJson<string[]>("not json", [])).toEqual([]);
  });

  it("returns fallback for null", () => {
    expect(parseJson<Record<string, string>>(null, {})).toEqual({});
  });

  it("returns fallback for undefined", () => {
    expect(parseJson<number[]>(undefined, [])).toEqual([]);
  });

  it("returns fallback for empty string", () => {
    expect(parseJson<string[]>("", [])).toEqual([]);
  });

  it("parses nested objects", () => {
    const result = parseJson<{ x: number; y: number }>('{"x":1,"y":2}', { x: 0, y: 0 });
    expect(result).toEqual({ x: 1, y: 2 });
  });

  it("does not throw on malformed input — always returns fallback", () => {
    expect(() => parseJson("{broken", null)).not.toThrow();
    expect(parseJson("{broken", null)).toBeNull();
  });
});
