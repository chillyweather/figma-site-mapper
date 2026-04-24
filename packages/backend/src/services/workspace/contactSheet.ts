import fs from "fs";
import path from "path";
import sharp from "sharp";
import { ensureDir, writeJson } from "./paths.js";
import type { CatalogGroup } from "./types.js";

const SHEET_LIMIT = 96;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function buildContactSheet(
  category: string,
  groups: CatalogGroup[],
  outPath: string
): Promise<void> {
  const cols = 6;
  const cellW = 220;
  const cellH = 140;
  const pad = 8;
  const visibleGroups = groups.filter((group) => group.cropPath).slice(0, SHEET_LIMIT);
  const outDir = path.dirname(outPath);

  if (visibleGroups.length === 0) {
    await ensureDir(outDir);
    await sharp(Buffer.from(
      `<svg width="${cellW}" height="${cellH}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/><rect x="0.5" y="0.5" width="${cellW - 1}" height="${cellH - 1}" fill="none" stroke="#e5e7eb"/><text x="16" y="72" font-size="13" font-family="Arial, sans-serif" fill="#64748b">No crop-backed ${escapeXml(category)} groups</text></svg>`
    ))
      .png()
      .toFile(outPath);
    await writeJson(outPath.replace(/\.png$/, ".json"), {
      imagePath: "contact-sheet.png",
      gridColumns: cols,
      cellSize: { w: cellW, h: cellH },
      cells: [],
      omittedCount: groups.length,
    });
    return;
  }

  const rows = Math.ceil(visibleGroups.length / cols);
  const canvasW = cols * cellW;
  const canvasH = rows * cellH;
  const composites: sharp.OverlayOptions[] = [];
  const cells: Array<{
    row: number;
    col: number;
    fingerprint: string;
    instanceCount: number;
  }> = [];

  const gridLines: string[] = [];
  for (let col = 0; col <= cols; col++) {
    gridLines.push(`<line x1="${col * cellW}" y1="0" x2="${col * cellW}" y2="${canvasH}" stroke="#e5e7eb"/>`);
  }
  for (let row = 0; row <= rows; row++) {
    gridLines.push(`<line x1="0" y1="${row * cellH}" x2="${canvasW}" y2="${row * cellH}" stroke="#e5e7eb"/>`);
  }

  composites.push({
    input: Buffer.from(`<svg width="${canvasW}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">${gridLines.join("")}</svg>`),
    top: 0,
    left: 0,
  });

  for (let i = 0; i < visibleGroups.length; i++) {
    const group = visibleGroups[i]!;
    const row = Math.floor(i / cols);
    const col = i % cols;
    const cropPath = path.join(outDir, group.cropPath!);

    const stat = await fs.promises.stat(cropPath).catch(() => null);
    if (!stat?.isFile()) continue;

    const buffer = await sharp(cropPath)
      .resize({
        width: cellW - 2 * pad,
        height: cellH - 2 * pad - 24,
        fit: "inside",
        withoutEnlargement: true,
      })
      .toBuffer();

    composites.push({
      input: buffer,
      top: row * cellH + pad,
      left: col * cellW + pad,
    });

    const label = `${group.fingerprint.slice(0, 16)} x${group.instanceCount}`;
    composites.push({
      input: Buffer.from(
        `<svg width="${cellW}" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="${cellW}" height="24" fill="white" fill-opacity="0.9"/><text x="6" y="16" font-size="11" font-family="Arial, sans-serif" fill="#111827">${escapeXml(label)}</text></svg>`
      ),
      top: row * cellH + cellH - 24,
      left: col * cellW,
    });

    cells.push({
      row,
      col,
      fingerprint: group.fingerprint,
      instanceCount: group.instanceCount,
    });
  }

  await ensureDir(outDir);
  await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(outPath);

  await writeJson(outPath.replace(/\.png$/, ".json"), {
    imagePath: "contact-sheet.png",
    category,
    gridColumns: cols,
    cellSize: { w: cellW, h: cellH },
    cells,
    omittedCount: Math.max(0, groups.filter((group) => group.cropPath).length - visibleGroups.length),
  });
}

export async function buildContactSheets(
  workspacePath: string,
  groupsByFolder: Map<string, CatalogGroup[]>
): Promise<void> {
  for (const [folder, groups] of groupsByFolder.entries()) {
    await buildContactSheet(
      folder,
      groups,
      path.join(workspacePath, "catalog", folder, "contact-sheet.png")
    );
  }
}
