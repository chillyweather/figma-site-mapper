import {
  fetchInventoryDecisions,
  fetchInventoryOverview,
  getJobStatus,
  prepareInventory,
} from "../services/apiClient";

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

async function postInventoryState(projectId: string): Promise<void> {
  const [overview, decisions] = await Promise.all([
    fetchInventoryOverview(projectId),
    fetchInventoryDecisions(projectId),
  ]);

  figma.ui.postMessage({
    type: "inventory-overview-loaded",
    projectId,
    overview,
    decisions,
  });
}

export async function handleLoadInventoryOverviewRequest(msg: {
  projectId?: string | null;
}): Promise<void> {
  const projectId = typeof msg.projectId === "string" ? msg.projectId.trim() : "";

  if (!projectId) {
    figma.ui.postMessage({
      type: "inventory-overview-error",
      projectId: null,
      error: "Select a project before loading inventory.",
    });
    return;
  }

  try {
    await postInventoryState(projectId);
  } catch (error) {
    console.error("Failed to load inventory overview", error);
    figma.ui.postMessage({
      type: "inventory-overview-error",
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
    figma.ui.postMessage({
      type: "inventory-prepare-error",
      projectId: null,
      error: "Select a project before preparing inventory.",
    });
    return;
  }

  try {
    const queued = await prepareInventory(projectId);
    figma.ui.postMessage({
      type: "inventory-prepare-started",
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

      figma.ui.postMessage({
        type: "inventory-prepare-status",
        projectId,
        jobId: queued.jobId,
        status: status.status,
        progress,
        stage,
      });

      if (status.status === "completed") {
        await postInventoryState(projectId);
        figma.ui.postMessage({
          type: "inventory-prepare-completed",
          projectId,
          jobId: queued.jobId,
        });
        return;
      }

      if (status.status === "failed") {
        figma.ui.postMessage({
          type: "inventory-prepare-error",
          projectId,
          jobId: queued.jobId,
          error: "Inventory workspace preparation failed.",
        });
        return;
      }

      await sleep(1500);
    }

    figma.ui.postMessage({
      type: "inventory-prepare-error",
      projectId,
      jobId: queued.jobId,
      error: "Inventory preparation timed out. Check backend worker logs.",
    });
  } catch (error) {
    console.error("Failed to prepare inventory workspace", error);
    figma.ui.postMessage({
      type: "inventory-prepare-error",
      projectId,
      error: error instanceof Error ? error.message : "Failed to prepare inventory workspace.",
    });
  }
}
