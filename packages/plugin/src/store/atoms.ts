import { atom } from "jotai";
import {
  PluginSettings,
  BadgeLink,
  FlowProgress,
  CrawlProgress,
  ElementMode,
  ElementFilters,
  CategorizedElements,
} from "../types";
import { DEFAULT_SETTINGS } from "../constants";

// Settings atoms
export const settingsAtom = atom<PluginSettings>(DEFAULT_SETTINGS);
export const currentViewAtom = atom<"main" | "settings" | "styling">("main");

// Crawl state atoms
export const isLoadingAtom = atom(false);
export const statusAtom = atom("");
export const jobIdAtom = atom<string | null>(null);
export const authStatusAtom = atom<
  "idle" | "authenticating" | "success" | "failed"
>("idle");
export const crawlProgressAtom = atom<CrawlProgress>({
  status: "idle",
  message: "",
  progress: 0,
});

// Flow mapping atoms
export const badgeLinksAtom = atom<BadgeLink[]>([]);
export const checkedLinksAtom = atom<Set<string>>(new Set());
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
export const manifestDataAtom = atom<any>(null);

// Element mode and filters atoms
export const elementModeAtom = atom<ElementMode>("flow");

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
