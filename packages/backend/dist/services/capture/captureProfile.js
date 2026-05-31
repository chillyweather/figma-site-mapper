export function parseCaptureProfile(value) {
    if (value === "visual-complete")
        return "visual-complete";
    return "standard";
}
