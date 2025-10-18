import { atom } from "jotai";
import {
  PluginSettings,
  BadgeLink,
  FlowProgress,
  CrawlProgress,
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
