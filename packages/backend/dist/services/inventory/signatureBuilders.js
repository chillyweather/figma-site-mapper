import { getNormalizedStyle } from "./normalizeStyles.js";
export function bucketDimension(value) {
    if (!Number.isFinite(value) || !value || value <= 0) {
        return "unknown";
    }
    const bucketSize = 8;
    const bucket = Math.round(value / bucketSize) * bucketSize;
    return `${bucket}px`;
}
export function isLikelyRenderableElement(element) {
    const bbox = element.bbox;
    if (!bbox)
        return false;
    if (element.isVisible === false)
        return false;
    if (bbox.width <= 0 || bbox.height <= 0)
        return false;
    if (bbox.width < 8 || bbox.height < 8)
        return false;
    if (bbox.width > 1600 || bbox.height > 1200)
        return false;
    return true;
}
export function buildClusterSignature(category, element) {
    const bbox = element.bbox;
    const summary = {
        width: bucketDimension(bbox?.width),
        height: bucketDimension(bbox?.height),
    };
    const addStyle = (property, outputKey = property) => {
        const value = getNormalizedStyle(element.styles, property);
        if (value) {
            summary[outputKey] = value;
        }
    };
    switch (category) {
        case "button":
        case "link":
            addStyle("font-size", "fontSize");
            addStyle("font-weight", "fontWeight");
            addStyle("color", "textColor");
            addStyle("background-color", "backgroundColor");
            addStyle("border-color", "borderColor");
            addStyle("border-radius", "borderRadius");
            addStyle("padding", "padding");
            addStyle("border-width", "borderWidth");
            break;
        case "input":
        case "select":
        case "textarea":
            addStyle("font-size", "fontSize");
            addStyle("font-weight", "fontWeight");
            addStyle("color", "textColor");
            addStyle("background-color", "backgroundColor");
            addStyle("border-color", "borderColor");
            addStyle("border-radius", "borderRadius");
            addStyle("border-width", "borderWidth");
            break;
        case "heading":
            addStyle("font-family", "fontFamily");
            addStyle("font-size", "fontSize");
            addStyle("font-weight", "fontWeight");
            addStyle("line-height", "lineHeight");
            addStyle("text-transform", "textTransform");
            addStyle("color", "textColor");
            break;
        default:
            addStyle("font-size", "fontSize");
            addStyle("color", "textColor");
            addStyle("background-color", "backgroundColor");
            addStyle("border-radius", "borderRadius");
            break;
    }
    const baseKey = Object.entries(summary)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join("|");
    return { key: `${category}|${baseKey}`, summary };
}
