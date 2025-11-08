import { atom } from "jotai";
import {
  PluginSettings,
  FlowLink,
  FlowProgress,
  CrawlProgress,
  ElementFilters,
  CategorizedElements,
  Project,
} from "../types";
import { DEFAULT_SETTINGS } from "../constants";
import type { ManifestData } from "../plugin/types";

// Settings atoms
export const settingsAtom = atom<PluginSettings>(DEFAULT_SETTINGS);
export const currentViewAtom = atom<"main" | "settings" | "styling">("main");

// Crawl state atoms
export const isLoadingAtom = atom(false);
export const isRenderingSnapshotAtom = atom(false);
export const statusAtom = atom("");
export const jobIdAtom = atom<string | null>(null);
export const authStatusAtom = atom<
  "idle" | "authenticating" | "success" | "failed" | null
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
