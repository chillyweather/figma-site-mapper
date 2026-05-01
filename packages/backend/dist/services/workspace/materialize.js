import fs from "fs";
import path from "path";
import { writeMappingContextScaffold } from "../mappingContext/scaffold.js";
import { buildContactSheets } from "./contactSheet.js";
import { ensureDecisionScaffold } from "./decisions.js";
import { allCatalogFolders, writeCatalogManifests, writePageManifests, writeProjectManifest, writeRegionManifests, } from "./manifests.js";
import { writeWorkspaceMeta } from "./meta.js";
import { ensureDir, writeJson } from "./paths.js";
import { writeWorkspaceReadme } from "./readme.js";
import { buildColorSwatches } from "./swatches.js";
import { buildTypographySpecimens } from "./typeSpecimens.js";
const GENERATED_ENTRIES = [
    "README.md",
    "project.json",
    ".workspace-meta.json",
    "pages",
    "catalog",
    "tokens",
    "regions",
    "mapping-context",
    "exports",
];
async function resetGeneratedWorkspace(workspacePath) {
    await ensureDir(workspacePath);
    for (const entry of GENERATED_ENTRIES) {
        await fs.promises.rm(path.join(workspacePath, entry), {
            recursive: true,
            force: true,
        });
    }
    await ensureDecisionScaffold(workspacePath);
}
async function writeTokenFiles(workspacePath, data) {
    const tokenDir = path.join(workspacePath, "tokens");
    await writeJson(path.join(tokenDir, "colors.json"), data.tokenTable.colors);
    await writeJson(path.join(tokenDir, "typography.json"), data.tokenTable.typography);
    await writeJson(path.join(tokenDir, "spacing.json"), data.tokenTable.spacing);
    await writeJson(path.join(tokenDir, "radii.json"), data.tokenTable.radii);
    await writeJson(path.join(tokenDir, "shadows.json"), data.tokenTable.shadows);
    await buildColorSwatches(data.tokenTable, path.join(tokenDir, "colors-swatches.png"));
    await buildTypographySpecimens(data.tokenTable, path.join(tokenDir, "typography-specimens.png"));
}
export async function materializeWorkspace(workspacePath, data, artifacts, generatedAt, options = {}) {
    await resetGeneratedWorkspace(workspacePath);
    for (const folder of allCatalogFolders()) {
        await ensureDir(path.join(workspacePath, "catalog", folder, "crops"));
    }
    await writeProjectManifest(workspacePath, data, generatedAt);
    await writeCatalogManifests(workspacePath, data, artifacts.catalogGroups);
    await writePageManifests(workspacePath, data);
    await writeRegionManifests(workspacePath, artifacts);
    await buildContactSheets(workspacePath, artifacts.catalogGroups);
    await writeTokenFiles(workspacePath, data);
    await writeMappingContextScaffold(workspacePath, data.project.id, generatedAt);
    await writeWorkspaceReadme(workspacePath, data, generatedAt);
    await writeWorkspaceMeta(workspacePath, data, generatedAt, options.metaExtra);
    await ensureDecisionScaffold(workspacePath);
}
