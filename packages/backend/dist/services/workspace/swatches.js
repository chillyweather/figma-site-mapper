import path from "path";
import sharp from "sharp";
import { ensureDir } from "./paths.js";
function escapeXml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
function cssColor(value) {
    return value.startsWith("#") || value.startsWith("rgb") || value.startsWith("hsl")
        ? value
        : "#f8fafc";
}
export async function buildColorSwatches(tokenTable, outPath) {
    const colors = tokenTable.colors.slice(0, 96);
    const cols = 8;
    const cellW = 160;
    const cellH = 92;
    const rows = Math.max(1, Math.ceil(colors.length / cols));
    const width = cols * cellW;
    const height = rows * cellH;
    const cells = colors.map((color, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const x = col * cellW;
        const y = row * cellH;
        return `
      <rect x="${x + 10}" y="${y + 10}" width="${cellW - 20}" height="38" rx="6" fill="${escapeXml(cssColor(color.value))}" stroke="#cbd5e1"/>
      <text x="${x + 10}" y="${y + 66}" font-size="12" font-family="Arial, sans-serif" fill="#111827">${escapeXml(color.value)}</text>
      <text x="${x + 10}" y="${y + 82}" font-size="11" font-family="Arial, sans-serif" fill="#64748b">${color.usageCount} uses, ${color.pageCount} pages</text>
    `;
    });
    await ensureDir(path.dirname(outPath));
    await sharp(Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/>${cells.join("")}</svg>`))
        .png()
        .toFile(outPath);
}
