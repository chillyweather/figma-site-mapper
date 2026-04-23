const BUTTON_INPUT_TYPES = new Set(["button", "submit", "reset"]);
export function categorizeElement(element) {
    const tagName = (element.tagName || "").toLowerCase();
    const type = (element.type || "").toLowerCase();
    const role = (element.role || "").toLowerCase();
    if (tagName === "button" ||
        role === "button" ||
        (tagName === "input" && BUTTON_INPUT_TYPES.has(type))) {
        return "button";
    }
    if (tagName === "a" || role === "link" || !!element.href) {
        return "link";
    }
    if (tagName === "select")
        return "select";
    if (tagName === "textarea")
        return "textarea";
    if (tagName === "input") {
        return "input";
    }
    if (/^h[1-6]$/.test(tagName) || role === "heading") {
        return "heading";
    }
    if (tagName === "img" || !!element.src) {
        return "image";
    }
    if (tagName === "p" || tagName === "span") {
        return "text-block";
    }
    return "other";
}
