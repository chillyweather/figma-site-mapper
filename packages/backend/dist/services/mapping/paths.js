import path from "path";
import { workspaceRoot } from "../workspace/paths.js";
export function mappingWorkspacePath(projectId) {
    return path.join(workspaceRoot, projectId, "mapping");
}
export function mappingManifestPath(projectId) {
    return path.join(mappingWorkspacePath(projectId), "manifest.json");
}
export function mappingMetaPath(projectId) {
    return path.join(mappingWorkspacePath(projectId), ".workspace-meta.json");
}
export function mappingPageDir(projectId, pageId) {
    return path.join(mappingWorkspacePath(projectId), "pages", pageId);
}
export function mappingReadmePath(projectId) {
    return path.join(mappingWorkspacePath(projectId), "README.md");
}
export function mappingDecisionsDir(projectId) {
    return path.join(mappingWorkspacePath(projectId), "decisions");
}
export function mappingLatestDecisionPath(projectId) {
    return path.join(mappingDecisionsDir(projectId), "latest.json");
}
