import path from "path";
import { workspaceRoot } from "../workspace/paths.js";

export function mappingWorkspacePath(projectId: string): string {
  return path.join(workspaceRoot, projectId, "mapping");
}

export function mappingManifestPath(projectId: string): string {
  return path.join(mappingWorkspacePath(projectId), "manifest.json");
}

export function mappingMetaPath(projectId: string): string {
  return path.join(mappingWorkspacePath(projectId), ".workspace-meta.json");
}

export function mappingPageDir(projectId: string, pageId: string): string {
  return path.join(mappingWorkspacePath(projectId), "pages", pageId);
}

export function mappingReadmePath(projectId: string): string {
  return path.join(mappingWorkspacePath(projectId), "README.md");
}

export function mappingDecisionsDir(projectId: string): string {
  return path.join(mappingWorkspacePath(projectId), "decisions");
}

export function mappingLatestDecisionPath(projectId: string): string {
  return path.join(mappingDecisionsDir(projectId), "latest.json");
}
