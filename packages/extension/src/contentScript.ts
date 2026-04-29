import type { ContentMessage, RecordedFlowAction } from "./shared/types";

let isRecording = false;

// Check recording state once on load
chrome.runtime.sendMessage({ type: "GET_RECORDING_STATE" }, (response) => {
  if (chrome.runtime.lastError) return;
  isRecording = response?.isRecording ?? false;
});

// Keep state in sync when popup toggles recording
chrome.runtime.onMessage.addListener((message: { type: string }) => {
  if (message.type === "RECORDING_STARTED") isRecording = true;
  if (message.type === "RECORDING_STOPPED") isRecording = false;
});

// ── Selector helpers ──────────────────────────────────────────────────────────

function getCssPath(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;
  while (current && current !== document.documentElement) {
    let part = current.tagName.toLowerCase();
    if (current.id) {
      part += `#${current.id}`;
      parts.unshift(part);
      break;
    }
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        part += `:nth-of-type(${index})`;
      }
    }
    parts.unshift(part);
    current = current.parentElement;
  }
  return parts.join(" > ");
}

function getSelector(el: Element): string {
  if (el.id) return `#${el.id}`;
  const role = el.getAttribute("role");
  const label = el.getAttribute("aria-label");
  if (role && label) return `[role="${role}"][aria-label="${label}"]`;
  return getCssPath(el);
}

function getClasses(el: Element): string[] {
  return Array.from(el.classList).slice(0, 10);
}

function getText(el: Element): string | undefined {
  const text = (el.textContent ?? "").trim().slice(0, 120);
  return text || undefined;
}

function buildAction(el: Element, event: MouseEvent): RecordedFlowAction {
  const rect = el.getBoundingClientRect();
  return {
    type: "click",
    tagName: el.tagName.toLowerCase(),
    text: getText(el),
    ariaLabel: el.getAttribute("aria-label") ?? undefined,
    role: el.getAttribute("role") ?? undefined,
    href: (el as HTMLAnchorElement).href || undefined,
    selector: getSelector(el),
    cssPath: getCssPath(el),
    elementId: el.id || undefined,
    classes: getClasses(el),
    bbox: {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: Math.round(window.scrollX),
      scrollY: Math.round(window.scrollY),
    },
  };
}

// ── Click capture ─────────────────────────────────────────────────────────────

document.addEventListener(
  "click",
  (event: MouseEvent) => {
    if (!isRecording) return;
    const target = event.target as Element | null;
    if (!target) return;

    // Walk up to find the most relevant interactive ancestor
    let el: Element | null = target;
    for (let i = 0; i < 5 && el; i++) {
      const tag = el.tagName?.toLowerCase();
      const role = el.getAttribute("role")?.toLowerCase();
      if (tag === "a" || tag === "button" || role === "button" || role === "link" || role === "menuitem") {
        break;
      }
      el = el.parentElement;
    }
    if (!el) el = target;

    const action = buildAction(el, event);
    const msg: ContentMessage = {
      type: "CLICK_EVENT",
      payload: {
        url: location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
        action,
      },
    };
    chrome.runtime.sendMessage(msg).catch(() => {});
  },
  true // capture phase to fire before SPAs can call preventDefault
);

// ── SPA navigation tracking ───────────────────────────────────────────────────

function notifySpaNav(url: string): void {
  if (!isRecording) return;
  const msg: ContentMessage = {
    type: "SPA_NAVIGATION",
    payload: { url, timestamp: new Date().toISOString() },
  };
  chrome.runtime.sendMessage(msg).catch(() => {});
}

const origPushState = history.pushState.bind(history);
const origReplaceState = history.replaceState.bind(history);

history.pushState = function (...args) {
  origPushState(...args);
  notifySpaNav(location.href);
};

history.replaceState = function (...args) {
  origReplaceState(...args);
  notifySpaNav(location.href);
};

window.addEventListener("popstate", () => notifySpaNav(location.href));

export {};
