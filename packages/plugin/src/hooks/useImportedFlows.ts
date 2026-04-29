import { useCallback } from "react";
import { useAtom, useAtomValue } from "jotai";
import { importedFlowsAtom, activeProjectIdAtom, savedFlowsAtom } from "../store/atoms";
import {
  recrawlPage,
  getJobStatus,
  getPage,
  fetchFlows,
  createFlow,
  addFlowStep,
} from "../plugin/services/apiClient";
import type {
  RecordedFlowTrace,
  RecordedFlowStep,
  ImportedFlowEntry,
  FlowDraftStep,
} from "../types";

const TAG = "[ImportedFlows]";

function traceStepToDraftStep(step: RecordedFlowStep): FlowDraftStep {
  const { action } = step;
  // Convert viewport-relative bbox to document coordinates
  const docX = action.bbox.x + action.viewport.scrollX;
  const docY = action.bbox.y + action.viewport.scrollY;

  return {
    sourcePageId: "",       // filled in after page capture
    sourceUrl: step.sourceUrl,
    sourceTitle: step.sourceTitle ?? step.sourceUrl,
    elementId: null,
    elementSelector: action.selector ?? action.cssPath ?? null,
    elementText: action.text ?? action.ariaLabel ?? null,
    elementBbox: {
      x: docX,
      y: docY,
      width: action.bbox.width,
      height: action.bbox.height,
    },
    actionLabel: action.text ?? action.ariaLabel ?? action.selector?.split(" > ").at(-1) ?? "(click)",
    actionKind: action.tagName === "a" || action.role === "link" ? "link"
      : action.tagName === "button" ? "button"
      : action.tagName === "input" ? "input"
      : "other",
    targetUrl: step.targetUrl ?? null,
    targetPageId: null,
    targetStatus: step.targetUrl ? "needs-capture" : "no-target",
  };
}

async function pollUntilDone(jobId: string): Promise<string[]> {
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise((r) => setTimeout(r, 3000));
    const result = await getJobStatus(jobId);
    if (result.status === "completed") {
      return Array.isArray(result.result?.visitedPageIds)
        ? result.result.visitedPageIds.map(String)
        : [];
    }
    if (result.status === "failed") throw new Error("Capture job failed");
  }
  throw new Error("Capture timed out");
}

export function useImportedFlows() {
  const activeProjectId = useAtomValue(activeProjectIdAtom);
  const [importedFlows, setImportedFlows] = useAtom(importedFlowsAtom);
  const [, setSavedFlows] = useAtom(savedFlowsAtom);

  const updateEntry = useCallback((id: string, patch: Partial<ImportedFlowEntry>) => {
    setImportedFlows((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
    );
  }, [setImportedFlows]);

  const importTrace = useCallback((trace: RecordedFlowTrace) => {
    const id = `imported-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const entry: ImportedFlowEntry = {
      id,
      name: trace.name || "Recorded Flow",
      trace,
      captureStatus: "idle",
      captureProgress: 0,
    };
    console.log(`${TAG} importTrace — "${entry.name}", ${trace.steps.length} steps`);
    setImportedFlows((prev) => [entry, ...prev]);
    return id;
  }, [setImportedFlows]);

  const removeFlow = useCallback((id: string) => {
    setImportedFlows((prev) => prev.filter((e) => e.id !== id));
  }, [setImportedFlows]);

  const captureAndRender = useCallback(async (id: string) => {
    if (!activeProjectId) {
      console.warn(`${TAG} captureAndRender — no active project`);
      return;
    }

    const entry = importedFlows.find((e) => e.id === id);
    if (!entry) {
      console.warn(`${TAG} captureAndRender — entry not found: ${id}`);
      return;
    }

    const { trace } = entry;
    // Collect unique URLs (source + target)
    const urlSet = new Set<string>();
    for (const step of trace.steps) {
      urlSet.add(step.sourceUrl);
      if (step.targetUrl) urlSet.add(step.targetUrl);
    }
    const urls = Array.from(urlSet);
    console.log(`${TAG} captureAndRender — ${urls.length} unique URL(s) to capture`);

    updateEntry(id, { captureStatus: "capturing", captureProgress: 0, captureMessage: "Checking captured pages..." });

    // Check which URLs are already captured
    const urlToPageId = new Map<string, string>();
    for (const url of urls) {
      try {
        const page = await getPage(activeProjectId, { url });
        if (page) {
          console.log(`${TAG} already captured: ${url} → pageId=${page._id}`);
          urlToPageId.set(url, page._id);
        }
      } catch { /* not captured yet */ }
    }

    const missing = urls.filter((u) => !urlToPageId.has(u));
    console.log(`${TAG} ${missing.length}/${urls.length} URL(s) need capture`);

    for (let i = 0; i < missing.length; i++) {
      const url = missing[i];
      const progress = Math.round(((i) / missing.length) * 80);
      updateEntry(id, {
        captureProgress: progress,
        captureMessage: `Capturing ${i + 1}/${missing.length}: ${url}`,
      });
      try {
        console.log(`${TAG} capturing ${url}`);
        const { jobId } = await recrawlPage({ url, projectId: activeProjectId });
        const pageIds = await pollUntilDone(jobId);
        const pageId = pageIds[0];
        if (pageId) {
          urlToPageId.set(url, pageId);
          console.log(`${TAG} captured ${url} → pageId=${pageId}`);
        } else {
          console.warn(`${TAG} capture returned no page id for ${url}`);
        }
      } catch (err) {
        console.error(`${TAG} capture failed for ${url}:`, err);
      }
    }

    updateEntry(id, { captureProgress: 85, captureMessage: "Saving flow to backend..." });

    // Build draft steps with resolved pageIds
    const draftSteps: FlowDraftStep[] = trace.steps.map((step) => {
      const draft = traceStepToDraftStep(step);
      const sourceId = urlToPageId.get(step.sourceUrl);
      const targetId = step.targetUrl ? urlToPageId.get(step.targetUrl) : undefined;
      return {
        ...draft,
        sourcePageId: sourceId ?? "",
        targetPageId: targetId ?? null,
        targetStatus: targetId ? "captured" : step.targetUrl ? "needs-capture" : "no-target",
      };
    });

    // Save to backend
    let savedFlowId: string | undefined;
    try {
      const flow = await createFlow({ projectId: activeProjectId, name: entry.name });
      for (const step of draftSteps) {
        await addFlowStep(flow._id, {
          sourcePageId: step.sourcePageId,
          sourceUrl: step.sourceUrl,
          elementSelector: step.elementSelector ?? undefined,
          elementText: step.elementText ?? undefined,
          elementBbox: step.elementBbox ?? undefined,
          targetUrl: step.targetUrl ?? undefined,
          targetPageId: step.targetPageId ?? undefined,
          actionKind: step.actionKind,
        });
      }
      savedFlowId = flow._id;
      console.log(`${TAG} saved flow ${flow._id} with ${draftSteps.length} steps`);

      // Refresh saved flows list
      const flows = await fetchFlows(activeProjectId);
      setSavedFlows(flows);
    } catch (err) {
      console.error(`${TAG} failed to save flow:`, err);
    }

    updateEntry(id, {
      captureStatus: "complete",
      captureProgress: 100,
      captureMessage: "Captured. Rendering board...",
      savedFlowId,
    });

    // Trigger board render
    console.log(`${TAG} posting render-flow-board with ${draftSteps.length} steps`);
    parent.postMessage({
      pluginMessage: {
        type: "render-flow-board",
        flowName: entry.name,
        flowId: savedFlowId ?? id,
        projectId: activeProjectId,
        steps: draftSteps,
      },
    }, "*");
  }, [activeProjectId, importedFlows, updateEntry, setSavedFlows]);

  const renderFlow = useCallback((id: string) => {
    if (!activeProjectId) return;

    const entry = importedFlows.find((e) => e.id === id);
    if (!entry || entry.captureStatus !== "complete") return;

    const draftSteps: FlowDraftStep[] = entry.trace.steps.map(traceStepToDraftStep);

    parent.postMessage({
      pluginMessage: {
        type: "render-flow-board",
        flowName: entry.name,
        flowId: entry.savedFlowId ?? id,
        projectId: activeProjectId,
        steps: draftSteps,
      },
    }, "*");
  }, [activeProjectId, importedFlows]);

  return {
    importedFlows,
    importTrace,
    removeFlow,
    captureAndRender,
    renderFlow,
  };
}
