import { fetchInventoryOverview } from "../services/apiClient";

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
    const overview = await fetchInventoryOverview(projectId);
    figma.ui.postMessage({
      type: "inventory-overview-loaded",
      projectId,
      overview,
    });
  } catch (error) {
    console.error("Failed to load inventory overview", error);
    figma.ui.postMessage({
      type: "inventory-overview-error",
      projectId,
      error: error instanceof Error ? error.message : "Failed to load inventory overview.",
    });
  }
}
