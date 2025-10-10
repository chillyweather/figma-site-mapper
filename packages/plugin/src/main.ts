/**
 * FIGMA PLUGIN MAIN ENTRY POINT
 *
 * This file initializes the plugin and coordinates between:
 * - UI (React app in iframe)
 * - Figma API (backend operations)
 * - Backend server (crawling service)
 */

import { UI_CONFIG } from "./plugin/constants";
import { handleUIMessage } from "./plugin/handlers/uiMessageHandlers";
import { initializePageEventListeners } from "./plugin/events/pageEventHandlers";

// ============================================
// INITIALIZE PLUGIN UI
// ============================================

figma.showUI(__html__, UI_CONFIG);

// ============================================
// SET UP EVENT LISTENERS
// ============================================

// Figma page events (page changes, selection changes)
initializePageEventListeners();

// UI message handling (messages from React app)
figma.ui.onmessage = handleUIMessage;
