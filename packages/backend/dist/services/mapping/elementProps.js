// Element property summarizer (issue #58).
//
// Pure, dependency-free module. Turns the raw computed-style object captured by
// the crawler (stored in `elements.styles`) plus an instance bbox into a small,
// ordered, display-ready list of `{ label, value }` rows for the mapping board's
// props column. All formatting decisions (curated subset, rgb→hex, px rounding,
// noise suppression) live here so they can be unit-tested without the Figma
// runtime or the database.
// Values that carry no design information — never emit a row for these.
const NOISE = new Set(["", "none", "auto", "normal", "initial", "inherit", "unset"]);
function isNoise(value) {
    if (value == null)
        return true;
    return NOISE.has(value.trim().toLowerCase());
}
/** Return a style value only when it carries design information. */
function meaningful(styles, key) {
    const value = styles[key];
    return isNoise(value) ? undefined : value;
}
/** Round a single "<n>px" token to a whole pixel. Leaves non-px tokens intact. */
function roundPxToken(token) {
    const match = token.match(/^(-?\d+(?:\.\d+)?)px$/);
    if (!match || match[1] === undefined)
        return token;
    return `${Math.round(parseFloat(match[1]))}px`;
}
/** Round every px token in a (possibly multi-value) string. */
function roundPx(value) {
    return value.trim().split(/\s+/).map(roundPxToken).join(" ");
}
function clampByte(n) {
    return Math.max(0, Math.min(255, Math.round(n)));
}
function toHexByte(n) {
    return clampByte(n).toString(16).padStart(2, "0").toUpperCase();
}
/**
 * Convert an `rgb(...)`/`rgba(...)` color to an uppercase `#RRGGBB` string.
 * Returns null for fully transparent colors (alpha 0) and for unparseable input.
 * Existing hex values are normalised to uppercase; other strings pass through.
 * Alpha between 0 and 1 is preserved as a trailing percentage note.
 */
export function rgbToHex(value) {
    const trimmed = value.trim();
    const match = trimmed.match(/^rgba?\(([^)]+)\)$/i);
    if (!match || match[1] === undefined) {
        if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed))
            return trimmed.toUpperCase();
        return trimmed || null;
    }
    const parts = match[1].split(",").map((p) => parseFloat(p.trim()));
    const r = parts[0];
    const g = parts[1];
    const b = parts[2];
    const a = parts[3];
    if (r === undefined || g === undefined || b === undefined)
        return null;
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b))
        return null;
    if (a === 0)
        return null; // fully transparent
    const hex = `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
    if (a !== undefined && a < 1 && !Number.isNaN(a)) {
        return `${hex} ${Math.round(a * 100)}%`;
    }
    return hex;
}
/** Strip quotes and pick the first concrete font family from a font-family list. */
function primaryFontFamily(fontFamily) {
    if (fontFamily === undefined)
        return null;
    const first = fontFamily.split(",")[0];
    const cleaned = first?.trim().replace(/^["']|["']$/g, "");
    return cleaned || null;
}
function buildFontRow(styles) {
    const family = primaryFontFamily(meaningful(styles, "font-family"));
    const sizeRaw = meaningful(styles, "font-size");
    const size = sizeRaw ? roundPx(sizeRaw) : null;
    const weightRaw = meaningful(styles, "font-weight");
    const weight = weightRaw && weightRaw !== "400" ? weightRaw : null;
    const head = [family, size].filter(Boolean).join(" ");
    if (!head)
        return null;
    return { label: "Font", value: weight ? `${head} / ${weight}` : head };
}
function buildBorderRow(styles) {
    const style = meaningful(styles, "border-style");
    const width = meaningful(styles, "border-width");
    if (!style || !width || roundPx(width) === "0px")
        return null;
    const colorRaw = meaningful(styles, "border-color");
    const color = colorRaw ? rgbToHex(colorRaw) : null;
    const value = [roundPx(width), style, color].filter(Boolean).join(" ");
    return value ? { label: "Border", value } : null;
}
function buildShadowRow(styles) {
    const raw = meaningful(styles, "box-shadow");
    if (!raw)
        return null;
    // Hex-ify any rgb/rgba colors embedded in the shadow definition.
    const value = raw.replace(/rgba?\([^)]+\)/gi, (m) => rgbToHex(m) ?? m);
    return { label: "Shadow", value: roundPx(value) };
}
/**
 * Produce the curated, ordered prop rows for a mapped element. Rows whose value
 * is missing or carries no design information are omitted. Returns an empty
 * array when no styles are available (e.g. vision-only instances).
 */
export function summarizeElementProps(styles, bbox) {
    const rows = [];
    // Size — derived from the bbox (consistent with the rendered crop), not the
    // CSS width/height which can carry sub-pixel/DPR drift.
    if (bbox && bbox.width > 0 && bbox.height > 0) {
        rows.push({ label: "Size", value: `${Math.round(bbox.width)}×${Math.round(bbox.height)}` });
    }
    if (!styles || typeof styles !== "object")
        return rows;
    const radius = meaningful(styles, "border-radius");
    if (radius && roundPx(radius) !== "0px") {
        rows.push({ label: "Radius", value: roundPx(radius) });
    }
    const fontRow = buildFontRow(styles);
    if (fontRow)
        rows.push(fontRow);
    const lineHeight = meaningful(styles, "line-height");
    if (lineHeight)
        rows.push({ label: "Line", value: roundPx(lineHeight) });
    const color = meaningful(styles, "color");
    if (color) {
        const hex = rgbToHex(color);
        if (hex)
            rows.push({ label: "Text", value: hex });
    }
    const background = meaningful(styles, "background-color");
    if (background) {
        const hex = rgbToHex(background);
        if (hex)
            rows.push({ label: "Bg", value: hex });
    }
    const borderRow = buildBorderRow(styles);
    if (borderRow)
        rows.push(borderRow);
    const shadowRow = buildShadowRow(styles);
    if (shadowRow)
        rows.push(shadowRow);
    return rows;
}
