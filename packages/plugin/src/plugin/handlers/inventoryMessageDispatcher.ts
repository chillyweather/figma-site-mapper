import type { InventoryUiToPluginMessage } from "../../messages/inventoryMessages";
import {
  handleLoadInventoryOverviewRequest,
  handlePrepareInventoryRequest,
  handleRenderInventoryBoardsRequest,
} from "./inventoryHandlers";

/**
 * Dispatch inventory messages from UI to plugin sandbox.
 * This is the single entry point for all inventory/* message types.
 */
export async function dispatchInventoryMessage(msg: InventoryUiToPluginMessage): Promise<void> {
  switch (msg.type) {
    case "inventory/load": {
      await handleLoadInventoryOverviewRequest({ projectId: msg.projectId });
      break;
    }
    case "inventory/prepare": {
      await handlePrepareInventoryRequest({ projectId: msg.projectId });
      break;
    }
    case "inventory/renderBoards": {
      await handleRenderInventoryBoardsRequest({ projectId: msg.projectId });
      break;
    }
    default: {
      // Exhaustiveness check
      const _exhaustive: never = msg;
      console.warn("Unknown inventory message type:", (msg as any).type);
    }
  }
}
