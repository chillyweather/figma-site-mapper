import { useCallback, useEffect } from "react";
import { useAtom, useAtomValue } from "jotai";
import { fetchProjectElements, fetchProjectPages, recrawlPage, getJobStatus } from "../plugin/services/apiClient";
import { fetchFlows, fetchFlow, createFlow, addFlowStep, deleteFlowStep, updateFlow } from "../plugin/services/apiClient";
import {
  activeScreenshotPageAtom,
  flowActionsAtom,
  flowActionsLoadingAtom,
  flowDraftStepsAtom,
  flowDraftNameAtom,
  selectedActionAtom,
  savedFlowsAtom,
  activeFlowIdAtom,
  flowCapturingAtom,
  flowCaptureJobIdAtom,
  activeProjectIdAtom,
} from "../store/atoms";
import type { FlowAction, FlowDraftStep, FlowRecord, TargetStatus } from "../types";

const TAG = "[Flow UI]";

// Minimal element shape needed from the API response
interface ElementItem {
  _id: string;
  type: string;
  selector?: string;
  tagName?: string;
  elementId?: string;
  classes?: string[];
  bbox?: { x: number; y: number; width: number; height: number };
  href?: string;
  text?: string;
  ariaLabel?: string;
  role?: string;
  value?: string;
  placeholder?: string;
  alt?: string;
  regionLabel?: string;
}

// Minimal page shape for URL lookup
interface PageItem {
  _id: string;
  url: string;
}

const ACTIONABLE_TAGS = new Set(["a", "button", "input"]);
const ACTIONABLE_ROLES = new Set(["link", "button", "menuitem"]);

function isActionable(el: ElementItem): boolean {
  if (ACTIONABLE_TAGS.has(el.tagName?.toLowerCase() ?? "")) return true;
  if (el.href) return true;
  if (el.role && ACTIONABLE_ROLES.has(el.role.toLowerCase())) return true;
  return false;
}

function resolveTargetUrl(
  href: string | undefined,
  sourceUrl: string
): string | null {
  if (!href) return null;
  if (/^(javascript|mailto|tel|ftp):/i.test(href)) return null;
  if (href === "#" || href.startsWith("#")) return null;
  try {
    const resolved = new URL(href, sourceUrl);
    return resolved.href;
  } catch {
    return null;
  }
}

function resolveTargetStatus(
  targetUrl: string | null,
  capturedUrls: Map<string, string>
): { status: TargetStatus; pageId: string | null } {
  if (!targetUrl) return { status: "no-target", pageId: null };
  let match = capturedUrls.get(targetUrl);
  if (!match) match = capturedUrls.get(targetUrl.replace(/\/$/, ""));
  if (!match) match = capturedUrls.get(targetUrl + "/");
  if (match) return { status: "captured", pageId: match };

  try {
    const target = new URL(targetUrl);
    const firstSource = capturedUrls.keys().next().value;
    if (firstSource) {
      const source = new URL(firstSource);
      if (target.hostname !== source.hostname) {
        return { status: "external", pageId: null };
      }
    }
  } catch { /* ignore parse errors */ }

  return { status: "needs-capture", pageId: null };
}

function buildActionLabel(el: ElementItem): string {
  if (el.text && el.text.trim().length > 0 && el.text.trim().length < 80) {
    return el.text.trim();
  }
  if (el.ariaLabel && el.ariaLabel.trim()) return el.ariaLabel.trim();
  if (el.value) return el.value;
  if (el.placeholder) return `[${el.placeholder}]`;
  if (el.alt) return el.alt;
  if (el.type) return `[${el.type}: ${el.selector?.split(" > ").at(-1) ?? ""}]`;
  return el.selector?.split(" > ").at(-1) ?? "(unnamed)";
}

export function useFlowBuilder() {
  const activeProjectId = useAtomValue(activeProjectIdAtom);
  const [activePage, setActivePage] = useAtom(activeScreenshotPageAtom);
  const [actions, setActions] = useAtom(flowActionsAtom);
  const [actionsLoading, setActionsLoading] = useAtom(flowActionsLoadingAtom);
  const [draftSteps, setDraftSteps] = useAtom(flowDraftStepsAtom);
  const [draftName, setDraftName] = useAtom(flowDraftNameAtom);
  const [selectedAction, setSelectedAction] = useAtom(selectedActionAtom);
  const [savedFlows, setSavedFlows] = useAtom(savedFlowsAtom);
  const [activeFlowId, setActiveFlowId] = useAtom(activeFlowIdAtom);
  const [capturing, setCapturing] = useAtom(flowCapturingAtom);
  const [captureJobId, setCaptureJobId] = useAtom(flowCaptureJobIdAtom);

  // Poll for capture job completion
  useEffect(() => {
    if (!captureJobId || !capturing) return;
    console.log(`${TAG} capture poll — watching jobId=${captureJobId}`);
    const poll = async () => {
      try {
        const result = await getJobStatus(captureJobId);
        console.log(`${TAG} capture poll — jobId=${captureJobId} status=${result.status}`);
        if (result.status === "completed") {
          console.log(`${TAG} capture poll — job completed; refreshing actions`);
          setCapturing(false);
          setCaptureJobId(null);
          if (activePage) loadActions(activePage);
        } else if (result.status === "failed") {
          console.error(`${TAG} capture poll — job FAILED for jobId=${captureJobId}`);
          setCapturing(false);
          setCaptureJobId(null);
        }
      } catch (err) {
        console.warn(`${TAG} capture poll — poll error (will retry):`, err);
      }
    };
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [captureJobId, capturing]);

  // Listen for active screenshot page messages from the sandbox
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage;
      if (!msg) return;
      if (msg.type === "active-screenshot-page") {
        if (msg.payload) {
          console.log(`${TAG} received active-screenshot-page:`, msg.payload);
          setActivePage(msg.payload);
        } else {
          console.log(`${TAG} received active-screenshot-page: null (not on a screenshot page)`);
          setActivePage(null);
        }
      }
    };
    window.addEventListener("message", handler);
    console.log(`${TAG} requesting active screenshot page from sandbox`);
    parent.postMessage({ pluginMessage: { type: "get-active-screenshot-page" } }, "*");
    return () => window.removeEventListener("message", handler);
  }, []);

  const loadActions = useCallback(async (page: { pageId: string; pageUrl: string; projectId: string }) => {
    if (!activeProjectId) {
      console.warn(`${TAG} loadActions — skipped: no activeProjectId`);
      return;
    }
    console.log(`${TAG} loadActions — loading for page ${page.pageId} (${page.pageUrl}), project ${activeProjectId}`);
    setActionsLoading(true);
    try {
      const [elements, pages] = await Promise.all([
        fetchProjectElements(activeProjectId, { pageId: page.pageId }),
        fetchProjectPages(activeProjectId),
      ]);

      console.log(`${TAG} loadActions — fetched ${(elements as ElementItem[]).length} elements, ${(pages as PageItem[]).length} project pages`);

      const urlToId = new Map<string, string>();
      for (const p of (pages as PageItem[])) {
        urlToId.set(p.url, p._id);
        const noSlash = p.url.replace(/\/$/, "");
        const withSlash = p.url.endsWith("/") ? p.url : p.url + "/";
        urlToId.set(noSlash, p._id);
        urlToId.set(withSlash, p._id);
      }

      const allElements = elements as ElementItem[];
      const actionableElements = allElements.filter(isActionable);
      console.log(`${TAG} loadActions — ${actionableElements.length}/${allElements.length} elements are actionable`);

      const deduped = new Map<string, FlowAction>();
      for (const el of actionableElements) {
        const targetUrl = resolveTargetUrl(el.href, page.pageUrl);
        const key = `${el.selector ?? ""}|${targetUrl ?? ""}|${el.text ?? ""}`;
        if (deduped.has(key)) continue;

        const { status, pageId } = resolveTargetStatus(targetUrl, urlToId);
        deduped.set(key, {
          elementId: el._id,
          label: buildActionLabel(el),
          elementType: el.type || el.tagName || "unknown",
          tagName: el.tagName || "unknown",
          targetUrl,
          targetStatus: status,
          targetPageId: pageId,
          selector: el.selector ?? null,
          regionLabel: el.regionLabel ?? null,
          role: el.role ?? null,
          bbox: el.bbox ?? null,
        });
      }

      const finalActions = Array.from(deduped.values());

      // Status breakdown for diagnostics
      const statusCounts = finalActions.reduce<Record<string, number>>((acc, a) => {
        acc[a.targetStatus] = (acc[a.targetStatus] ?? 0) + 1;
        return acc;
      }, {});

      // Region breakdown
      const regionCounts = finalActions.reduce<Record<string, number>>((acc, a) => {
        const r = a.regionLabel ?? "(none)";
        acc[r] = (acc[r] ?? 0) + 1;
        return acc;
      }, {});

      console.log(`${TAG} loadActions — ${finalActions.length} deduplicated actions. Status breakdown:`, statusCounts);
      console.log(`${TAG} loadActions — region breakdown:`, regionCounts);
      console.log(`${TAG} loadActions — sample actions (first 5):`,
        finalActions.slice(0, 5).map((a) => ({
          label: a.label,
          targetStatus: a.targetStatus,
          targetUrl: a.targetUrl,
          hasBbox: !!a.bbox,
          region: a.regionLabel,
        }))
      );

      setActions(finalActions);
    } catch (err) {
      console.error(`${TAG} loadActions — FAILED:`, err);
    } finally {
      setActionsLoading(false);
    }
  }, [activeProjectId]);

  // Auto-load actions when active page changes
  useEffect(() => {
    if (activePage) {
      console.log(`${TAG} active page changed to: ${activePage.pageId} (${activePage.pageUrl})`);
      loadActions(activePage);
    } else {
      console.log(`${TAG} active page cleared; resetting actions and draft`);
      setActions([]);
      setDraftSteps([]);
      setSelectedAction(null);
    }
  }, [activePage]);

  const previewAction = useCallback((action: FlowAction) => {
    console.log(`${TAG} previewAction — element: "${action.label}" (${action.elementId})`, {
      targetUrl: action.targetUrl,
      targetStatus: action.targetStatus,
      bbox: action.bbox,
      selector: action.selector,
    });
    setSelectedAction(action);
    parent.postMessage({
      pluginMessage: {
        type: "preview-flow-element",
        elementId: action.elementId,
        pageId: activePage?.pageId,
        bbox: action.bbox,
        selector: action.selector,
        label: action.label,
        targetUrl: action.targetUrl,
      },
    }, "*");
  }, [activePage]);

  const clearPreview = useCallback(() => {
    console.log(`${TAG} clearPreview`);
    setSelectedAction(null);
    parent.postMessage({ pluginMessage: { type: "clear-flow-preview" } }, "*");
  }, []);

  const addStep = useCallback((action: FlowAction) => {
    if (!activePage) {
      console.warn(`${TAG} addStep — no active page; skipping`);
      return;
    }
    const step: FlowDraftStep = {
      sourcePageId: activePage.pageId,
      sourceUrl: activePage.pageUrl,
      sourceTitle: activePage.pageName || activePage.pageUrl,
      elementId: action.elementId,
      elementSelector: action.selector,
      elementText: action.label,
      elementBbox: action.bbox,
      actionLabel: action.label,
      actionKind: action.tagName === "a" || action.role === "link" ? "link"
        : action.tagName === "button" ? "button"
        : action.tagName === "input" ? "input"
        : "other",
      targetUrl: action.targetUrl,
      targetPageId: action.targetPageId,
      targetStatus: action.targetStatus,
    };
    console.log(`${TAG} addStep — step ${draftSteps.length + 1}:`, {
      actionLabel: step.actionLabel,
      actionKind: step.actionKind,
      sourcePageId: step.sourcePageId,
      targetUrl: step.targetUrl,
      targetPageId: step.targetPageId,
      targetStatus: step.targetStatus,
      hasBbox: !!step.elementBbox,
    });
    setDraftSteps((prev) => [...prev, step]);
  }, [activePage, draftSteps]);

  const removeStep = useCallback((index: number) => {
    console.log(`${TAG} removeStep — removing step at index ${index}`);
    setDraftSteps((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const moveStepUp = useCallback((index: number) => {
    if (index <= 0) return;
    console.log(`${TAG} moveStepUp — swapping index ${index} ↔ ${index - 1}`);
    setDraftSteps((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const moveStepDown = useCallback((index: number) => {
    console.log(`${TAG} moveStepDown — swapping index ${index} ↔ ${index + 1}`);
    setDraftSteps((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  const clearDraft = useCallback(() => {
    console.log(`${TAG} clearDraft — clearing ${draftSteps.length} steps`);
    setDraftSteps([]);
    setDraftName("");
    setActiveFlowId(null);
  }, [draftSteps]);

  const captureTarget = useCallback(async (step: FlowDraftStep, stepIndex: number) => {
    if (!activeProjectId || !step.targetUrl) {
      console.warn(`${TAG} captureTarget — skipped (projectId=${activeProjectId}, targetUrl=${step.targetUrl})`);
      return;
    }
    console.log(`${TAG} captureTarget — starting capture for step ${stepIndex}: "${step.targetUrl}"`);
    setCapturing(true);
    try {
      const result = await recrawlPage({ url: step.targetUrl, projectId: activeProjectId });
      console.log(`${TAG} captureTarget — recrawl started, jobId=${result.jobId}`);
      setCaptureJobId(result.jobId);
    } catch (err) {
      console.error(`${TAG} captureTarget — FAILED to start recrawl:`, err);
      setCapturing(false);
    }
  }, [activeProjectId]);

  const continueFromTarget = useCallback((step: FlowDraftStep) => {
    if (!step.targetPageId) {
      console.warn(`${TAG} continueFromTarget — step has no targetPageId; cannot continue`);
      return;
    }
    console.log(`${TAG} continueFromTarget — switching to page ${step.targetPageId} (${step.targetUrl ?? "no url"})`);
    parent.postMessage({
      pluginMessage: {
        type: "continue-from-target",
        targetPageId: step.targetPageId,
        targetUrl: step.targetUrl,
      },
    }, "*");
  }, []);

  const loadSavedFlows = useCallback(async () => {
    if (!activeProjectId) {
      console.warn(`${TAG} loadSavedFlows — skipped: no activeProjectId`);
      return;
    }
    console.log(`${TAG} loadSavedFlows — fetching for project ${activeProjectId}`);
    try {
      const flows = await fetchFlows(activeProjectId);
      console.log(`${TAG} loadSavedFlows — loaded ${flows.length} flow(s):`,
        flows.map((f) => ({ id: f._id, name: f.name, steps: f.stepCount ?? f.steps?.length ?? 0 }))
      );
      setSavedFlows(flows);
    } catch (err) {
      console.error(`${TAG} loadSavedFlows — FAILED:`, err);
    }
  }, [activeProjectId]);

  const saveFlow = useCallback(async () => {
    if (!activeProjectId || draftSteps.length === 0) {
      console.warn(`${TAG} saveFlow — skipped (projectId=${activeProjectId}, steps=${draftSteps.length})`);
      return;
    }
    const name = draftName.trim() || `Flow ${new Date().toLocaleDateString()}`;
    console.log(`${TAG} saveFlow — saving "${name}" with ${draftSteps.length} step(s)`);
    try {
      const flow = await createFlow({ projectId: activeProjectId, name });
      console.log(`${TAG} saveFlow — created flow ${flow._id} "${flow.name}"`);
      for (let i = 0; i < draftSteps.length; i++) {
        const step = draftSteps[i];
        console.log(`${TAG} saveFlow — saving step ${i + 1}/${draftSteps.length}: "${step.actionLabel}"`);
        await addFlowStep(flow._id, {
          sourcePageId: step.sourcePageId,
          sourceUrl: step.sourceUrl,
          elementId: step.elementId ?? undefined,
          elementSelector: step.elementSelector ?? undefined,
          elementText: step.elementText ?? undefined,
          elementBbox: step.elementBbox ?? undefined,
          targetUrl: step.targetUrl ?? undefined,
          targetPageId: step.targetPageId ?? undefined,
          actionKind: step.actionKind,
        });
      }
      console.log(`${TAG} saveFlow — all steps saved; activeFlowId=${flow._id}`);
      setActiveFlowId(flow._id);
      await loadSavedFlows();
      return flow;
    } catch (err) {
      console.error(`${TAG} saveFlow — FAILED:`, err);
    }
  }, [activeProjectId, draftSteps, draftName]);

  const loadFlowIntoDraft = useCallback(async (flow: FlowRecord) => {
    console.log(`${TAG} loadFlowIntoDraft — loading "${flow.name}" (${flow._id}), steps=${flow.steps?.length ?? flow.stepCount ?? 0}`);
    setActiveFlowId(flow._id);
    setDraftName(flow.name);
    if (flow.steps && flow.steps.length > 0) {
      const mapped = flow.steps.map((s) => ({
        sourcePageId: s.sourcePageId,
        sourceUrl: s.sourceUrl,
        sourceTitle: s.sourceUrl,
        elementId: s.elementId ?? null,
        elementSelector: s.elementSelector ?? null,
        elementText: s.elementText ?? null,
        elementBbox: s.elementBbox ?? null,
        actionLabel: s.elementText || s.elementSelector?.split(" > ").at(-1) || "(step)",
        actionKind: s.actionKind as FlowDraftStep["actionKind"],
        targetUrl: s.targetUrl ?? null,
        targetPageId: s.targetPageId ?? null,
        targetStatus: (s.targetPageId ? "captured" : s.targetUrl ? "needs-capture" : "no-target") as FlowDraftStep["targetStatus"],
      }));
      console.log(`${TAG} loadFlowIntoDraft — mapped ${mapped.length} steps into draft`);
      setDraftSteps(mapped);
    } else {
      console.warn(`${TAG} loadFlowIntoDraft — flow has no steps; draft will be empty`);
    }
  }, []);

  const deleteSavedFlow = useCallback(async (flowId: string) => {
    console.log(`${TAG} deleteSavedFlow — deleting flow ${flowId}`);
    try {
      const { deleteFlow: delFlow } = await import("../plugin/services/apiClient");
      await delFlow(flowId);
      console.log(`${TAG} deleteSavedFlow — deleted ${flowId}`);
      if (activeFlowId === flowId) {
        console.log(`${TAG} deleteSavedFlow — was active flow; clearing draft`);
        clearDraft();
      }
      await loadSavedFlows();
    } catch (err) {
      console.error(`${TAG} deleteSavedFlow — FAILED:`, err);
    }
  }, [activeFlowId]);

  const duplicateFlow = useCallback(async (flow: FlowRecord) => {
    if (!activeProjectId) return;
    console.log(`${TAG} duplicateFlow — duplicating "${flow.name}" (${flow._id})`);
    try {
      let steps = flow.steps;
      if (!steps || steps.length === 0) {
        console.log(`${TAG} duplicateFlow — steps not loaded; fetching full flow`);
        const full = await fetchFlow(flow._id);
        steps = full.steps ?? [];
        console.log(`${TAG} duplicateFlow — fetched ${steps.length} step(s)`);
      }
      const newFlow = await createFlow({
        projectId: activeProjectId,
        name: `${flow.name} (copy)`,
      });
      console.log(`${TAG} duplicateFlow — created copy ${newFlow._id} "${newFlow.name}"; copying ${steps.length} steps`);
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        await addFlowStep(newFlow._id, {
          sourcePageId: step.sourcePageId,
          sourceUrl: step.sourceUrl,
          elementId: step.elementId,
          elementSelector: step.elementSelector,
          elementText: step.elementText,
          elementBbox: step.elementBbox,
          targetUrl: step.targetUrl,
          targetPageId: step.targetPageId,
          actionKind: step.actionKind,
        });
      }
      console.log(`${TAG} duplicateFlow — done`);
      await loadSavedFlows();
    } catch (err) {
      console.error(`${TAG} duplicateFlow — FAILED:`, err);
    }
  }, [activeProjectId]);

  const renameFlow = useCallback(async (flowId: string, name: string) => {
    if (!name.trim()) {
      console.warn(`${TAG} renameFlow — empty name; skipping`);
      return;
    }
    console.log(`${TAG} renameFlow — renaming flow ${flowId} to "${name.trim()}"`);
    try {
      await updateFlow(flowId, { name: name.trim() });
      console.log(`${TAG} renameFlow — done`);
      if (activeFlowId === flowId) {
        console.log(`${TAG} renameFlow — also updating draft name`);
        setDraftName(name.trim());
      }
      await loadSavedFlows();
    } catch (err) {
      console.error(`${TAG} renameFlow — FAILED:`, err);
    }
  }, [activeFlowId]);

  const rerenderSavedFlow = useCallback(async (flow: FlowRecord) => {
    if (!activeProjectId) {
      console.warn(`${TAG} rerenderSavedFlow — no activeProjectId`);
      return;
    }
    console.log(`${TAG} rerenderSavedFlow — "${flow.name}" (${flow._id})`);
    let steps = flow.steps;
    if (!steps || steps.length === 0) {
      console.log(`${TAG} rerenderSavedFlow — steps not loaded; fetching full flow`);
      try {
        const full = await fetchFlow(flow._id);
        steps = full.steps ?? [];
        console.log(`${TAG} rerenderSavedFlow — fetched ${steps.length} step(s)`);
      } catch (err) {
        console.error(`${TAG} rerenderSavedFlow — could not fetch steps:`, err);
        return;
      }
    }

    const draftStepsForRender = steps.map((s) => ({
      sourcePageId: s.sourcePageId,
      sourceUrl: s.sourceUrl,
      sourceTitle: s.sourceUrl,
      elementId: s.elementId ?? null,
      elementSelector: s.elementSelector ?? null,
      elementText: s.elementText ?? null,
      elementBbox: s.elementBbox ?? null,
      actionLabel: s.elementText || s.elementSelector?.split(" > ").at(-1) || "(step)",
      actionKind: s.actionKind as FlowDraftStep["actionKind"],
      targetUrl: s.targetUrl ?? null,
      targetPageId: s.targetPageId ?? null,
      targetStatus: (s.targetPageId ? "captured" : s.targetUrl ? "needs-capture" : "no-target") as FlowDraftStep["targetStatus"],
    }));

    console.log(`${TAG} rerenderSavedFlow — sending render-flow-board with ${draftStepsForRender.length} step(s)`);
    parent.postMessage({
      pluginMessage: {
        type: "render-flow-board",
        flowName: flow.name,
        flowId: flow._id,
        projectId: activeProjectId,
        steps: draftStepsForRender,
      },
    }, "*");
  }, [activeProjectId]);

  const renderBoard = useCallback(() => {
    if (!activeProjectId || draftSteps.length === 0) {
      console.warn(`${TAG} renderBoard — skipped (projectId=${activeProjectId}, steps=${draftSteps.length})`);
      return;
    }
    const name = draftName.trim() || `Flow ${new Date().toLocaleDateString()}`;
    const flowId = activeFlowId ?? `draft-${Date.now()}`;
    console.log(`${TAG} renderBoard — sending render-flow-board:`, {
      flowName: name,
      flowId,
      projectId: activeProjectId,
      stepCount: draftSteps.length,
      steps: draftSteps.map((s, i) => ({
        i,
        actionLabel: s.actionLabel,
        sourcePageId: s.sourcePageId,
        targetPageId: s.targetPageId ?? "null",
        targetStatus: s.targetStatus,
        hasBbox: !!s.elementBbox,
      })),
    });
    parent.postMessage({
      pluginMessage: {
        type: "render-flow-board",
        flowName: name,
        flowId,
        projectId: activeProjectId,
        steps: draftSteps,
      },
    }, "*");
  }, [activeProjectId, draftSteps, draftName, activeFlowId]);

  return {
    activePage,
    actions,
    actionsLoading,
    draftSteps,
    draftName,
    selectedAction,
    savedFlows,
    activeFlowId,
    capturing,
    captureJobId,
    previewAction,
    clearPreview,
    addStep,
    removeStep,
    moveStepUp,
    moveStepDown,
    clearDraft,
    setDraftName,
    captureTarget,
    continueFromTarget,
    loadSavedFlows,
    saveFlow,
    loadFlowIntoDraft,
    deleteSavedFlow,
    renameFlow,
    duplicateFlow,
    rerenderSavedFlow,
    renderBoard,
  };
}
