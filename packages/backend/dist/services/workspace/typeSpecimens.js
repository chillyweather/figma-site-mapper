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
export async function buildTypographySpecimens(tokenTable, outPath) {
    const rows = tokenTable.typography.slice(0, 48);
    const rowH = 74;
    const width = 980;
    const height = Math.max(rowH, rows.length * rowH);
    const specimenText = "The quick brown fox";
    const content = rows.map((row, index) => {
        const y = index * rowH;
        const fontSize = row.type === "font-size" ? row.value : "20px";
        const fontWeight = row.type === "font-weight" ? row.value : "500";
        const fontFamily = row.type === "font-family" ? row.value : "Arial";
        return `
      <line x1="0" y1="${y + rowH - 1}" x2="${width}" y2="${y + rowH - 1}" stroke="#e5e7eb"/>
      <text x="18" y="${y + 32}" font-size="${escapeXml(fontSize)}" font-weight="${escapeXml(fontWeight)}" font-family="${escapeXml(fontFamily)}, Arial, sans-serif" fill="#111827">${specimenText}</text>
      <text x="600" y="${y + 27}" font-size="12" font-family="Arial, sans-serif" fill="#64748b">${escapeXml(row.type)}: ${escapeXml(row.value)}</text>
      <text x="600" y="${y + 47}" font-size="12" font-family="Arial, sans-serif" fill="#64748b">${row.usageCount} uses, ${row.pageCount} pages</text>
    `;
    });
    await ensureDir(path.dirname(outPath));
    await sharp(Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/>${content.join("")}</svg>`))
        .png()
        .toFile(outPath);
}
