import type { MappingOverview, MappingRenderData } from "../plugin/types";

// ── UI -> Plugin ─────────────────────────────────────────────────────────────

export type MappingUiToPluginMessage =
  | { type: "mapping/load"; projectId: string }
  | { type: "mapping/prepare"; projectId: string }
  | { type: "mapping/render"; projectId: string };

// ── Plugin -> UI ─────────────────────────────────────────────────────────────

export type MappingPluginToUiMessage =
  | {
      type: "mapping/loaded";
      projectId: string;
      overview: MappingOverview;
    }
  | {
      type: "mapping/error";
      projectId: string | null;
      error: string;
    }
  | {
      type: "mapping/prepareStarted";
      projectId: string;
      jobId: string;
    }
  | {
      type: "mapping/prepareStatus";
      projectId: string;
      jobId: string;
      status: string;
      progress: number;
      stage: string;
    }
  | {
      type: "mapping/prepareCompleted";
      projectId: string;
      jobId: string;
      overview: MappingOverview;
    }
  | {
      type: "mapping/prepareError";
      projectId: string;
      jobId?: string;
      error: string;
    }
  | {
      type: "mapping/renderStarted";
      projectId: string;
    }
  | {
      type: "mapping/renderProgress";
      projectId: string;
      stage: string;
      current: number;
      total: number;
    }
  | {
      type: "mapping/renderCompleted";
      projectId: string;
      componentTypes: number;
      totalInstances: number;
      errors: string[];
    }
  | {
      type: "mapping/renderError";
      projectId: string | null;
      error: string;
    };

export function isMappingUiMessage(msg: unknown): msg is MappingUiToPluginMessage {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as Record<string, unknown>;
  return typeof m.type === "string" && m.type.startsWith("mapping/");
}

export function isMappingPluginMessage(msg: unknown): msg is MappingPluginToUiMessage {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as Record<string, unknown>;
  return typeof m.type === "string" && m.type.startsWith("mapping/");
}
