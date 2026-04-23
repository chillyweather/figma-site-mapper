function normalizeWhitespace(value) {
    return value.replace(/\s+/g, " ").trim();
}
function normalizeNumericToken(value) {
    const match = value.match(/^(-?\d+(?:\.\d+)?)(px|rem|em|%)?$/i);
    if (!match) {
        return normalizeWhitespace(value.toLowerCase());
    }
    const amount = Number(match[1]);
    const unit = (match[2] || "").toLowerCase();
    const rounded = Number.isFinite(amount) ? Number(amount.toFixed(2)) : amount;
    return `${rounded}${unit}`;
}
export function normalizeColorValue(value) {
    const normalized = normalizeWhitespace(value.toLowerCase());
    if (!normalized || normalized === "transparent" || normalized === "none") {
        return normalized;
    }
    return normalized
        .replace(/rgba?\(/g, (match) => match.toLowerCase())
        .replace(/,\s+/g, ",")
        .replace(/\(\s+/g, "(")
        .replace(/\s+\)/g, ")");
}
export function normalizeFontFamily(value) {
    const first = value.split(",")[0] || value;
    return normalizeWhitespace(first.replace(/["']/g, "").toLowerCase());
}
export function normalizeStyleValue(property, rawValue) {
    let stringValue;
    if (typeof rawValue !== "string") {
        if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
            stringValue = String(rawValue);
        }
        else {
            return null;
        }
    }
    else {
        stringValue = rawValue;
    }
    const value = stringValue.trim();
    if (!value)
        return null;
    switch (property) {
        case "color":
        case "background-color":
        case "border-color":
            return normalizeColorValue(value);
        case "font-family":
            return normalizeFontFamily(value);
        case "font-size":
        case "font-weight":
        case "line-height":
        case "letter-spacing":
        case "border-radius":
        case "border-width":
        case "width":
        case "height":
        case "padding":
        case "padding-top":
        case "padding-right":
        case "padding-bottom":
        case "padding-left":
        case "margin":
        case "margin-top":
        case "margin-right":
        case "margin-bottom":
        case "margin-left":
            return normalizeNumericToken(value);
        case "box-shadow":
        case "text-transform":
        case "text-decoration":
        case "display":
        case "position":
        case "border-style":
            return normalizeWhitespace(value.toLowerCase());
        default:
            return normalizeWhitespace(value);
    }
}
export function getNormalizedStyle(styles, property) {
    return normalizeStyleValue(property, styles[property]);
}
