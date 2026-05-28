import {
  fetchMappingOverview,
  prepareMappingWorkspace,
  fetchMappingRenderData,
  getJobStatus,
} from "../services/apiClient";
import { renderMapping } from "../../figmaRendering/renderMapping";
import type { MappingPluginToUiMessage } from "../../messages/mappingMessages";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeProgress(progress: unknown): number {
  if (typeof progress === "number") return Math.max(0, Math.min(100, Math.round(progress)));
  if (progress && typeof progress === "object") {
    const value = (progress as { progress?: unknown }).progress;
    if (typeof value === "number") return Math.max(0, Math.min(100, Math.round(value)));
  }
  return 0;
}

function postToUI(msg: MappingPluginToUiMessage): void {
  figma.ui.postMessage(msg);
}

async function fetchAndPostMappingState(projectId: string): Promise<void> {
  const overview = await fetchMappingOverview(projectId);
  postToUI({ type: "mapping/loaded", projectId, overview });
}

export async function handleLoadMappingRequest(msg: { projectId?: string | null }): Promise<void> {
  const projectId = typeof msg.projectId === "string" ? msg.projectId.trim() : "";
  if (!projectId) {
    postToUI({ type: "mapping/error", projectId: null, error: "Select a project before loading mapping." });
    return;
  }
  try {
    await fetchAndPostMappingState(projectId);
  } catch (error) {
    postToUI({
      type: "mapping/error",
      projectId,
      error: error instanceof Error ? error.message : "Failed to load mapping state.",
    });
  }
}

export async function handlePrepareMappingRequest(msg: { projectId?: string | null }): Promise<void> {
  const projectId = typeof msg.projectId === "string" ? msg.projectId.trim() : "";
  if (!projectId) {
    postToUI({ type: "mapping/error", projectId: null, error: "Select a project before preparing mapping." });
    return;
  }

  try {
    const queued = await prepareMappingWorkspace(projectId);
    postToUI({ type: "mapping/prepareStarted", projectId, jobId: queued.jobId });

    for (let attempt = 0; attempt < 400; attempt += 1) {
      const status = await getJobStatus(queued.jobId);
      const progress = normalizeProgress(status.progress);
      const stage =
        status.detailedProgress?.stage || status.result?.generatedAt || status.status || "Preparing mapping workspace";

      postToUI({
        type: "mapping/prepareStatus",
        projectId,
        jobId: queued.jobId,
        status: status.status,
        progress,
        stage,
      });

      if (status.status === "completed") {
        const overview = await fetchMappingOverview(projectId);
        postToUI({ type: "mapping/prepareCompleted", projectId, jobId: queued.jobId, overview });
        return;
      }

      if (status.status === "failed") {
        postToUI({
          type: "mapping/prepareError",
          projectId,
          jobId: queued.jobId,
          error: "Mapping workspace preparation failed.",
        });
        return;
      }

      await sleep(1500);
    }

    postToUI({
      type: "mapping/prepareError",
      projectId,
      jobId: queued.jobId,
      error: "Mapping preparation timed out. Check backend worker logs.",
    });
  } catch (error) {
    postToUI({
      type: "mapping/prepareError",
      projectId,
      error: error instanceof Error ? error.message : "Failed to prepare mapping workspace.",
    });
  }
}

export async function handleRenderMappingRequest(msg: { projectId?: string | null }): Promise<void> {
  const projectId = typeof msg.projectId === "string" ? msg.projectId.trim() : "";
  if (!projectId) {
    postToUI({ type: "mapping/renderError", projectId: null, error: "Select a project before rendering mapping." });
    figma.notify("Select a project before rendering mapping.", { error: true });
    return;
  }

  try {
    postToUI({ type: "mapping/renderStarted", projectId });

    const renderData = await fetchMappingRenderData(projectId);
    if (!renderData.hasMappingWorkspace) {
      throw new Error("Mapping workspace is not prepared yet. Run Prepare Mapping first.");
    }
    if (!renderData.hasDecisions) {
      throw new Error("No mapping decisions found. Run /ds-mapping <projectId> in Claude Code first.");
    }

    const result = await renderMapping(renderData, ({ stage, current, total }) => {
      postToUI({ type: "mapping/renderProgress", projectId, stage, current, total });
    });

    postToUI({
      type: "mapping/renderCompleted",
      projectId,
      componentTypes: result.componentTypes,
      totalInstances: result.totalInstances,
      errors: result.errors,
    });

    const label = result.errors.length > 0
      ? `Mapping rendered with ${result.errors.length} error(s).`
      : `Mapping rendered: ${result.componentTypes} types, ${result.totalInstances} instances.`;
    figma.notify(label, { error: result.errors.length > 0 });
  } catch (error) {
    postToUI({
      type: "mapping/renderError",
      projectId,
      error: error instanceof Error ? error.message : "Failed to render mapping.",
    });
    figma.notify("Failed to render mapping.", { error: true });
  }
}
