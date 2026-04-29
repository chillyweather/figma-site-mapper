import { atom } from "jotai";
import {
  PluginSettings,
  FlowLink,
  FlowProgress,
  CrawlProgress,
  ElementFilters,
  CategorizedElements,
  Project,
  FlowAction,
  FlowDraftStep,
  FlowRecord,
  ActiveScreenshotPage,
  ImportedFlowEntry,
} from "../types";
import { DEFAULT_SETTINGS } from "../constants";
import type { ManifestData } from "../plugin/types";

// Settings atoms
export const settingsAtom = atom<PluginSettings>(DEFAULT_SETTINGS);
export const currentViewAtom = atom<"main" | "settings">("main");

// Crawl state atoms
export const isLoadingAtom = atom(false);
export const isRenderingSnapshotAtom = atom(false);
export const statusAtom = atom("");
export const jobIdAtom = atom<string | null>(null);
export const authStatusAtom = atom<
  | "idle"
  | "authenticating"
  | "success"
  | "failed"
  | null
>("idle");
export const crawlProgressAtom = atom<CrawlProgress>({
  status: "idle",
  message: "",
  progress: 0,
});

// Flow mapping atoms
export const badgeLinksAtom = atom<FlowLink[]>([]);
export const checkedLinksAtom = atom<Set<string>>(new Set<string>());
export const flowProgressAtom = atom<FlowProgress>({
  status: "idle",
  message: "",
  progress: 0,
  currentStep: 0,
  totalSteps: 5,
  steps: [
    { name: "Create flow page", status: "pending" },
    { name: "Clone source elements", status: "pending" },
    { name: "Crawl target page", status: "pending" },
    { name: "Render target page", status: "pending" },
    { name: "Create arrows", status: "pending" },
  ],
});

// Manifest data atom
export const manifestDataAtom = atom<ManifestData | null>(null);

// Element filters atoms
export const elementFiltersAtom = atom<ElementFilters>({
  headings: true,
  buttons: true,
  inputs: true,
  textareas: true,
  selects: true,
  images: true,
  links: true,
  paragraphs: false, // Start with paragraphs off to avoid clutter
  divs: false, // Start with divs off to avoid clutter
  other: false,
});

export const categorizedElementsAtom = atom<CategorizedElements | null>(null);

// Selected page URL for element data
export const selectedPageUrlAtom = atom<string>("");

// Project selection state
export const projectsAtom = atom<Project[]>([]);
export const activeProjectIdAtom = atom<string | null>(null);

// Markup tab state
export const markupFiltersAtom = atom<ElementFilters>({
  headings: false,
  buttons: true,
  inputs: true,
  textareas: false,
  selects: false,
  images: false,
  links: true,
  paragraphs: false,
  divs: false,
  other: false,
});

export const activeMarkupPageAtom = atom<{
  pageId: string | null;
  pageUrl: string | null;
  pageName?: string;
} | null>(null);

export const isMarkupRenderingAtom = atom(false);
export const markupStatusAtom = atom<string>("");

// Flow builder atoms
export const activeScreenshotPageAtom = atom<ActiveScreenshotPage | null>(null);
export const importedFlowsAtom = atom<ImportedFlowEntry[]>([]);
export const flowActionsAtom = atom<FlowAction[]>([]);
export const flowActionsLoadingAtom = atom(false);
export const flowDraftStepsAtom = atom<FlowDraftStep[]>([]);
export const flowDraftNameAtom = atom("");
export const selectedActionAtom = atom<FlowAction | null>(null);
export const savedFlowsAtom = atom<FlowRecord[]>([]);
export const activeFlowIdAtom = atom<string | null>(null);
export const flowCapturingAtom = atom(false);
export const flowCaptureJobIdAtom = atom<string | null>(null);
