import "../logger.js";
import fs from "fs";
import path from "path";
import { WorkspaceMetaSchema, InventoryClusterDecisionFileSchema, InventoryTokenDecisionFileSchema, InventoryInconsistencyDecisionFileSchema, InventoryTemplateDecisionFileSchema, } from "@sitemapper/shared";
import { defaultWorkspacePath } from "../services/workspace/paths.js";
async function fileExists(filePath) {
    return fs.promises.stat(filePath).then((s) => s.isFile()).catch(() => false);
}
async function readJson(filePath) {
    const content = await fs.promises.readFile(filePath, "utf8").catch(() => null);
    if (!content)
        return null;
    try {
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
async function main() {
    const projectId = process.argv[2];
    const customPath = process.argv[3];
    if (!projectId) {
        process.stderr.write("Usage: pnpm --filter backend run validate:workspace <projectId> [workspacePath]\n");
        process.exit(1);
    }
    const workspacePath = customPath ?? defaultWorkspacePath(projectId);
    const errors = [];
    process.stdout.write(`Validating workspace: ${workspacePath}\n\n`);
    // 1. Workspace exists
    const metaPath = path.join(workspacePath, ".workspace-meta.json");
    if (!(await fileExists(metaPath))) {
        errors.push("Workspace meta file missing");
    }
    else {
        const meta = await readJson(metaPath);
        if (!meta) {
            errors.push("Workspace meta is invalid JSON");
        }
        else {
            const result = WorkspaceMetaSchema.safeParse(meta);
            if (!result.success) {
                errors.push(`Workspace meta invalid: ${result.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`).join("; ")}`);
            }
        }
    }
    // 2. Project manifest
    const projectJson = await readJson(path.join(workspacePath, "project.json"));
    if (!projectJson) {
        errors.push("project.json missing or invalid");
    }
    // 3. Page manifests
    const pagesDir = path.join(workspacePath, "pages");
    const pageDirs = await fs.promises.readdir(pagesDir, { withFileTypes: true }).catch(() => []);
    const pageIds = [];
    for (const entry of pageDirs) {
        if (!entry.isDirectory())
            continue;
        const pageId = entry.name;
        pageIds.push(pageId);
        const pageJson = await readJson(path.join(pagesDir, pageId, "page.json"));
        if (!pageJson)
            errors.push(`pages/${pageId}/page.json missing or invalid`);
        const elementsJson = await readJson(path.join(pagesDir, pageId, "elements.json"));
        if (!elementsJson)
            errors.push(`pages/${pageId}/elements.json missing or invalid`);
    }
    if (pageIds.length === 0) {
        errors.push("No page manifests found");
    }
    // 4. Catalog groups
    const catalogDir = path.join(workspacePath, "catalog");
    const folders = ["buttons", "links", "inputs", "headings", "images", "text-blocks", "other"];
    for (const folder of folders) {
        const groupsPath = path.join(catalogDir, folder, "groups.json");
        const groups = await readJson(groupsPath);
        if (!groups)
            errors.push(`catalog/${folder}/groups.json missing or invalid`);
        // 5. Contact sheets
        const contactSheetPath = path.join(catalogDir, folder, "contact-sheet.png");
        if (!(await fileExists(contactSheetPath))) {
            errors.push(`catalog/${folder}/contact-sheet.png missing`);
        }
    }
    // 6. Token files
    const tokenDir = path.join(workspacePath, "tokens");
    for (const file of ["colors.json", "typography.json", "spacing.json", "radii.json", "shadows.json"]) {
        const filePath = path.join(tokenDir, file);
        if (!(await fileExists(filePath))) {
            errors.push(`tokens/${file} missing`);
        }
    }
    // 7. Decision files
    const decisionsDir = path.join(workspacePath, "decisions");
    const decisionValidators = [
        { file: "clusters.json", schema: InventoryClusterDecisionFileSchema, label: "clusters" },
        { file: "tokens.json", schema: InventoryTokenDecisionFileSchema, label: "tokens" },
        { file: "inconsistencies.json", schema: InventoryInconsistencyDecisionFileSchema, label: "inconsistencies" },
        { file: "templates.json", schema: InventoryTemplateDecisionFileSchema, label: "templates" },
    ];
    for (const { file, schema, label } of decisionValidators) {
        const filePath = path.join(decisionsDir, file);
        const content = await fs.promises.readFile(filePath, "utf8").catch(() => null);
        if (content === null) {
            errors.push(`decisions/${file} missing`);
            continue;
        }
        let parsed;
        try {
            parsed = JSON.parse(content);
        }
        catch {
            errors.push(`decisions/${file} invalid JSON`);
            continue;
        }
        const result = schema.safeParse(parsed);
        if (!result.success) {
            errors.push(`decisions/${file} invalid: ${result.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`).join("; ")}`);
        }
    }
    // Report
    for (const error of errors) {
        process.stderr.write(`  ❌ ${error}\n`);
    }
    if (errors.length === 0) {
        process.stdout.write(`  ✅ Workspace valid (${pageIds.length} pages).\n`);
        process.exit(0);
    }
    else {
        process.stdout.write(`\n  ${errors.length} issue(s) found.\n`);
        process.exit(1);
    }
}
main();
