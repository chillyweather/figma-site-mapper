import type { InventoryOverview, InventoryDecisions, InventoryRenderData } from "@sitemapper/shared";

// ── UI -> Plugin ────────────────────────────────────────────────────────────

export type InventoryUiToPluginMessage =
  | { type: "inventory/load"; projectId: string }
  | { type: "inventory/prepare"; projectId: string }
  | { type: "inventory/renderBoards"; projectId: string };

// ── Plugin -> UI ────────────────────────────────────────────────────────────

export type InventoryPluginToUiMessage =
  | {
      type: "inventory/loaded";
      projectId: string;
      overview: InventoryOverview;
      decisions: InventoryDecisions;
    }
  | {
      type: "inventory/error";
      projectId: string | null;
      error: string;
    }
  | {
      type: "inventory/prepareStarted";
      projectId: string;
      jobId: string;
    }
  | {
      type: "inventory/prepareStatus";
      projectId: string;
      jobId: string;
      status: string;
      progress: number;
      stage: string;
    }
  | {
      type: "inventory/prepareCompleted";
      projectId: string;
      jobId: string;
    }
  | {
      type: "inventory/prepareError";
      projectId: string;
      jobId?: string;
      error: string;
    }
  | {
      type: "inventory/renderStarted";
      projectId: string;
    }
  | {
      type: "inventory/renderProgress";
      projectId: string;
      stage: string;
      current: number;
      total: number;
    }
  | {
      type: "inventory/renderCompleted";
      projectId: string;
    }
  | {
      type: "inventory/renderError";
      projectId: string | null;
      error: string;
    };

// ── Helpers ─────────────────────────────────────────────────────────────────

export function isInventoryUiMessage(msg: unknown): msg is InventoryUiToPluginMessage {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as Record<string, unknown>;
  if (typeof m.type !== "string") return false;
  return m.type.startsWith("inventory/");
}

export function isInventoryPluginMessage(msg: unknown): msg is InventoryPluginToUiMessage {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as Record<string, unknown>;
  if (typeof m.type !== "string") return false;
  return m.type.startsWith("inventory/");
}
