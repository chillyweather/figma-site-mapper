import "../logger.js";
import fs from "fs";
import path from "path";
import { InventoryRenderDataSchema } from "@sitemapper/shared";
import { defaultWorkspacePath } from "../services/workspace/paths.js";
import { buildInventoryRenderData } from "../app.js";
async function fileExists(filePath) {
    return fs.promises.stat(filePath).then((s) => s.isFile()).catch(() => false);
}
async function main() {
    const projectId = process.argv[2];
    if (!projectId) {
        process.stderr.write("Usage: pnpm --filter backend run validate:render-data <projectId>\n");
        process.exit(1);
    }
    const errors = [];
    const warnings = [];
    process.stdout.write(`Validating render data for project ${projectId}\n\n`);
    // Build render data directly (not via HTTP)
    let payload;
    try {
        payload = await buildInventoryRenderData(projectId, "http://localhost:3006");
    }
    catch (error) {
        errors.push(`Failed to build render data: ${error instanceof Error ? error.message : String(error)}`);
        report(errors, warnings);
        return;
    }
    // Validate schema
    const schemaResult = InventoryRenderDataSchema.safeParse(payload);
    if (!schemaResult.success) {
        errors.push(`Schema validation failed: ${schemaResult.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`).join("; ")}`);
    }
    // Verify asset URLs map to existing files
    const workspacePath = defaultWorkspacePath(projectId);
    const allCards = payload.boards.flatMap((board) => board.sections.flatMap((section) => section.cards));
    const componentCards = payload.boards
        .flatMap((board) => board.sections)
        .filter((section) => section.kind === "components")
        .flatMap((section) => section.cards);
    const componentCardsWithImage = componentCards.filter((card) => card.assets.some((asset) => asset.kind === "image" && Boolean(asset.url)));
    const componentCardsWithSample = componentCards.filter((card) => card.links.some((link) => link.target.kind === "sample"));
    if (componentCards.length > 0 && componentCardsWithImage.length === 0) {
        warnings.push("Component cards have no crop assets. Check that the latest crawl had style extraction enabled and workspace catalog groups have cropPath/cropContextPath.");
    }
    if (componentCards.length > 0 && componentCardsWithSample.length === 0) {
        warnings.push("Component cards have no sample links. Check decision memberFingerprints or representativeElementIds.");
    }
    for (const card of allCards) {
        for (const asset of card.assets) {
            if (asset.kind === "image" && asset.url) {
                try {
                    const parsed = new URL(asset.url);
                    const match = parsed.pathname.match(/^\/workspace\/[^/]+\/(.+)$/);
                    if (match && match[1]) {
                        const localPath = path.join(workspacePath, ...match[1].split("/"));
                        if (!(await fileExists(localPath))) {
                            errors.push(`Missing asset file for card ${card.id}: ${localPath}`);
                        }
                    }
                }
                catch {
                    warnings.push(`Invalid asset URL for card ${card.id}: ${asset.url}`);
                }
            }
        }
        for (const link of card.links) {
            if (link.target.kind === "sample") {
                if (!link.target.pageId || !link.target.elementId) {
                    warnings.push(`Card ${card.id}: sample link missing pageId or elementId`);
                }
                if (!link.target.bbox || link.target.bbox.length !== 4) {
                    warnings.push(`Card ${card.id}: sample link missing valid bbox`);
                }
            }
        }
    }
    report(errors, warnings);
}
function report(errors, warnings) {
    for (const error of errors) {
        process.stderr.write(`  ❌ ${error}\n`);
    }
    for (const warning of warnings) {
        process.stdout.write(`  ⚠️  ${warning}\n`);
    }
    if (errors.length === 0) {
        process.stdout.write(`  ✅ Render data valid (${warnings.length} warning(s)).\n`);
        process.exit(0);
    }
    else {
        process.stdout.write(`\n  ${errors.length} error(s) found.\n`);
        process.exit(1);
    }
}
main();
