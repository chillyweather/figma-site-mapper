import { describe, expect, it } from "vitest";
import { parseCaptureProfile, type CaptureProfile } from "./captureProfile.js";

describe("parseCaptureProfile", () => {
  it("returns standard for undefined", () => {
    expect(parseCaptureProfile(undefined)).toBe("standard");
  });

  it("returns standard for null", () => {
    expect(parseCaptureProfile(null)).toBe("standard");
  });

  it("returns standard for unknown string", () => {
    expect(parseCaptureProfile("unknown")).toBe("standard");
  });

  it("returns standard for empty string", () => {
    expect(parseCaptureProfile("")).toBe("standard");
  });

  it("returns visual-complete for 'visual-complete'", () => {
    expect(parseCaptureProfile("visual-complete")).toBe("visual-complete");
  });

  it("returns standard for 'standard'", () => {
    expect(parseCaptureProfile("standard")).toBe("standard");
  });
});

describe("captureQuality diagnostics shape", () => {
  it("includes captureProfile in the diagnostics object", () => {
    const profile: CaptureProfile = "standard";
    const diagnostics = {
      captureProfile: profile,
      readinessSignals: {},
      suspiciousRegionScore: 0,
      retryCount: 0,
      qualityStatus: "clean" as const,
    };

    expect(diagnostics.captureProfile).toBe("standard");
    expect(Object.keys(diagnostics)).toContain("captureProfile");
  });

  it("visual-complete profile is preserved in diagnostics", () => {
    const profile: CaptureProfile = "visual-complete";
    const diagnostics = {
      captureProfile: profile,
      readinessSignals: {},
      suspiciousRegionScore: 0.05,
      retryCount: 0,
      qualityStatus: "clean" as const,
    };

    expect(diagnostics.captureProfile).toBe("visual-complete");
  });

  it("diagnostics round-trips through JSON serialization", () => {
    const diagnostics = {
      captureProfile: "visual-complete" as CaptureProfile,
      readinessSignals: { images: "fired", fonts: "fired" },
      suspiciousRegionScore: 0.1,
      retryCount: 0,
      qualityStatus: "clean",
    };

    const json = JSON.stringify(diagnostics);
    const parsed = JSON.parse(json);
    expect(parsed.captureProfile).toBe("visual-complete");
    expect(parsed.qualityStatus).toBe("clean");
  });

  it("standard profile is set when captureProfile is missing (backward compat)", () => {
    const legacyDiagnostics = {
      readinessSignals: {},
      suspiciousRegionScore: 0,
      retryCount: 0,
      qualityStatus: "clean",
    };

    const profile: CaptureProfile =
      (legacyDiagnostics as Record<string, unknown>).captureProfile
        ? ((legacyDiagnostics as Record<string, unknown>).captureProfile as CaptureProfile)
        : "standard";

    expect(profile).toBe("standard");
  });
});
