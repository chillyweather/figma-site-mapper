import "../logger.js";
import fs from "fs";
import path from "path";
import { InventoryClusterDecisionFileSchema, InventoryTokenDecisionFileSchema, InventoryInconsistencyDecisionFileSchema, InventoryTemplateDecisionFileSchema, } from "@sitemapper/shared";
import { defaultWorkspacePath } from "../services/workspace/paths.js";
async function validateJsonFile(filePath, schema, label) {
    const errors = [];
    const content = await fs.promises.readFile(filePath, "utf8").catch(() => null);
    if (content === null) {
        errors.push(`${label}: file not found`);
        return { ok: false, errors };
    }
    let parsed;
    try {
        parsed = JSON.parse(content);
    }
    catch {
        errors.push(`${label}: invalid JSON`);
        return { ok: false, errors };
    }
    try {
        schema.parse(parsed);
    }
    catch (err) {
        if (err && typeof err === "object" && "issues" in err && Array.isArray(err.issues)) {
            for (const issue of err.issues) {
                errors.push(`${label}: ${issue.path.join(".")} — ${issue.message}`);
            }
        }
        else {
            errors.push(`${label}: validation failed — ${err instanceof Error ? err.message : String(err)}`);
        }
        return { ok: false, errors };
    }
    return { ok: true, errors };
}
async function main() {
    const projectId = process.argv[2];
    const customPath = process.argv[3];
    if (!projectId) {
        process.stderr.write("Usage: pnpm --filter backend run inventory:validate <projectId> [workspacePath]\n");
        process.exit(1);
    }
    const workspacePath = customPath ?? defaultWorkspacePath(projectId);
    const decisionsDir = path.join(workspacePath, "decisions");
    process.stdout.write(`Validating workspace: ${workspacePath}\n\n`);
    const results = await Promise.all([
        validateJsonFile(path.join(decisionsDir, "clusters.json"), InventoryClusterDecisionFileSchema, "clusters"),
        validateJsonFile(path.join(decisionsDir, "tokens.json"), InventoryTokenDecisionFileSchema, "tokens"),
        validateJsonFile(path.join(decisionsDir, "inconsistencies.json"), InventoryInconsistencyDecisionFileSchema, "inconsistencies"),
        validateJsonFile(path.join(decisionsDir, "templates.json"), InventoryTemplateDecisionFileSchema, "templates"),
    ]);
    let allOk = true;
    for (const result of results) {
        if (!result.ok)
            allOk = false;
        for (const error of result.errors) {
            process.stderr.write(`  ❌ ${error}\n`);
        }
    }
    if (allOk) {
        process.stdout.write("  ✅ All decision files valid.\n");
        process.exit(0);
    }
    else {
        process.stdout.write("\n  Validation failed.\n");
        process.exit(1);
    }
}
main();
