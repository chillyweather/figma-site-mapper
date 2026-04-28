import {
  fetchInventoryDecisions,
  fetchMappingContextSummary,
  fetchSuggestions,
  fetchMappingInputs,
  fetchInventoryOverview,
  fetchInventoryRenderData,
  getJobStatus,
  prepareInventory,
  saveProjectMappingInputs,
} from "../services/apiClient";
import { renderInventoryBoards } from "../../figmaRendering/renderInventoryBoards";
import type { InventoryPluginToUiMessage } from "../../messages/inventoryMessages";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeProgress(progress: unknown): number {
  if (typeof progress === "number") {
    return Math.max(0, Math.min(100, Math.round(progress)));
  }
  if (progress && typeof progress === "object") {
    const value = (progress as { progress?: unknown }).progress;
    if (typeof value === "number") {
      return Math.max(0, Math.min(100, Math.round(value)));
    }
  }
  return 0;
}

function postToUI(msg: InventoryPluginToUiMessage): void {
  figma.ui.postMessage(msg);
}

async function postInventoryState(projectId: string): Promise<void> {
  const [overview, decisions, mappingInputs, mappingContextSummary, mappingSuggestions] = await Promise.all([
    fetchInventoryOverview(projectId),
    fetchInventoryDecisions(projectId),
    fetchMappingInputs(projectId),
    fetchMappingContextSummary(projectId),
    fetchSuggestions(projectId),
  ]);

  postToUI({
    type: "inventory/loaded",
    projectId,
    overview,
    decisions,
    mappingInputs,
    mappingContextSummary,
    mappingSuggestions,
  });
}

export async function handleLoadInventoryOverviewRequest(msg: {
  projectId?: string | null;
}): Promise<void> {
  const projectId = typeof msg.projectId === "string" ? msg.projectId.trim() : "";

  if (!projectId) {
    postToUI({
      type: "inventory/error",
      projectId: null,
      error: "Select a project before loading inventory.",
    });
    return;
  }

  try {
    await postInventoryState(projectId);
  } catch (error) {
    console.error("Failed to load inventory overview", error);
    postToUI({
      type: "inventory/error",
      projectId,
      error: error instanceof Error ? error.message : "Failed to load inventory overview.",
    });
  }
}

export async function handlePrepareInventoryRequest(msg: {
  projectId?: string | null;
}): Promise<void> {
  const projectId = typeof msg.projectId === "string" ? msg.projectId.trim() : "";

  if (!projectId) {
    postToUI({
      type: "inventory/error",
      projectId: null,
      error: "Select a project before preparing inventory.",
    });
    return;
  }

  try {
    const queued = await prepareInventory(projectId);
    postToUI({
      type: "inventory/prepareStarted",
      projectId,
      jobId: queued.jobId,
    });

    for (let attempt = 0; attempt < 400; attempt += 1) {
      const status = await getJobStatus(queued.jobId);
      const progress = normalizeProgress(status.progress);
      const stage =
        status.detailedProgress?.stage ||
        status.result?.generatedAt ||
        status.status ||
        "Preparing inventory workspace";

      postToUI({
        type: "inventory/prepareStatus",
        projectId,
        jobId: queued.jobId,
        status: status.status,
        progress,
        stage,
      });

      if (status.status === "completed") {
        await postInventoryState(projectId);
        postToUI({
          type: "inventory/prepareCompleted",
          projectId,
          jobId: queued.jobId,
        });
        return;
      }

      if (status.status === "failed") {
        postToUI({
          type: "inventory/prepareError",
          projectId,
          jobId: queued.jobId,
          error: "Inventory workspace preparation failed.",
        });
        return;
      }

      await sleep(1500);
    }

    postToUI({
      type: "inventory/prepareError",
      projectId,
      jobId: queued.jobId,
      error: "Inventory preparation timed out. Check backend worker logs.",
    });
  } catch (error) {
    console.error("Failed to prepare inventory workspace", error);
    postToUI({
      type: "inventory/prepareError",
      projectId,
      error: error instanceof Error ? error.message : "Failed to prepare inventory workspace.",
    });
  }
}

export async function handleRenderInventoryBoardsRequest(msg: {
  projectId?: string | null;
}): Promise<void> {
  const projectId = typeof msg.projectId === "string" ? msg.projectId.trim() : "";

  if (!projectId) {
    postToUI({
      type: "inventory/renderError",
      projectId: null,
      error: "Select a project before rendering inventory boards.",
    });
    figma.notify("Select a project before rendering inventory boards.", { error: true });
    return;
  }

  try {
    postToUI({
      type: "inventory/renderStarted",
      projectId,
    });

    const renderData = await fetchInventoryRenderData(projectId);
    if (!renderData.hasWorkspace) {
      throw new Error("Inventory workspace is not prepared yet.");
    }

    await renderInventoryBoards(renderData, ({ stage, current, total }) => {
      postToUI({
        type: "inventory/renderProgress",
        projectId,
        stage,
        current,
        total,
      });
    });

    postToUI({
      type: "inventory/renderCompleted",
      projectId,
    });
    figma.notify("Inventory boards rendered.");
  } catch (error) {
    console.error("Failed to render inventory boards", error);
    postToUI({
      type: "inventory/renderError",
      projectId,
      error: error instanceof Error ? error.message : "Failed to render inventory boards.",
    });
    figma.notify("Failed to render inventory boards.", { error: true });
  }
}

export async function handleSaveMappingInputsRequest(msg: {
  projectId?: string | null;
  mappingInputs?: Record<string, unknown>;
}): Promise<void> {
  const projectId = typeof msg.projectId === "string" ? msg.projectId.trim() : "";

  if (!projectId) {
    postToUI({
      type: "inventory/error",
      projectId: null,
      error: "Select a project before saving mapping inputs.",
    });
    return;
  }

  try {
    const saved = await saveProjectMappingInputs(projectId, (msg.mappingInputs ?? {}) as any);
    postToUI({
      type: "inventory/mappingInputsSaved",
      projectId,
      mappingInputs: saved,
    });
  } catch (error) {
    console.error("Failed to save mapping inputs", error);
    postToUI({
      type: "inventory/error",
      projectId,
      error: error instanceof Error ? error.message : "Failed to save mapping inputs.",
    });
  }
}
