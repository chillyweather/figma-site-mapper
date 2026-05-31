export type CaptureProfile = "standard" | "visual-complete";

export function parseCaptureProfile(value: unknown): CaptureProfile {
  if (value === "visual-complete") return "visual-complete";
  return "standard";
}
