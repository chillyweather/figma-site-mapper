import fs from "fs";
import path from "path";
import { writeJson } from "./paths.js";
const DECISION_FILES = [
    "clusters.json",
    "tokens.json",
    "inconsistencies.json",
    "templates.json",
    "notes.md",
];
export async function ensureDecisionScaffold(workspacePath) {
    const decisionsDir = path.join(workspacePath, "decisions");
    await fs.promises.mkdir(decisionsDir, { recursive: true });
    for (const file of DECISION_FILES) {
        const filePath = path.join(decisionsDir, file);
        const exists = await fs.promises.stat(filePath).then(() => true).catch(() => false);
        if (exists)
            continue;
        if (file.endsWith(".md")) {
            await fs.promises.writeFile(filePath, "# Inventory Notes\n\n", "utf8");
        }
        else {
            await writeJson(filePath, {});
        }
    }
}
export async function readDecisionFiles(workspacePath) {
    const decisionsDir = path.join(workspacePath, "decisions");
    const result = {};
    for (const file of DECISION_FILES) {
        const filePath = path.join(decisionsDir, file);
        const content = await fs.promises.readFile(filePath, "utf8").catch(() => null);
        if (content === null)
            continue;
        const key = file.replace(/\.(json|md)$/, "");
        if (file.endsWith(".json")) {
            try {
                result[key] = JSON.parse(content);
            }
            catch {
                result[key] = null;
            }
        }
        else {
            result[key] = content;
        }
    }
    return result;
}
export async function decisionSummary(workspacePath) {
    const decisions = await readDecisionFiles(workspacePath);
    const clusters = decisions.clusters;
    const tokens = decisions.tokens;
    const inconsistencies = decisions.inconsistencies;
    const templates = decisions.templates;
    return {
        hasDecisions: Object.keys(decisions).length > 0,
        clusterCount: Array.isArray(clusters?.clusters) ? clusters.clusters.length : 0,
        tokenCount: tokens
            ? Object.values(tokens).reduce((count, value) => count + (Array.isArray(value) ? value.length : 0), 0)
            : 0,
        inconsistencyCount: Array.isArray(inconsistencies?.issues)
            ? inconsistencies.issues.length
            : 0,
        templateCount: Array.isArray(templates?.templates) ? templates.templates.length : 0,
    };
}
