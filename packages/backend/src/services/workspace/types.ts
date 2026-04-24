import type {
  InventoryCategory,
  InventoryTokenFrequencyTable,
  ParsedInventoryElement,
  ParsedInventoryPage,
} from "../inventory/types.js";

export const WORKSPACE_SCHEMA_VERSION = 1;

export type WorkspaceCategoryFolder =
  | "buttons"
  | "links"
  | "inputs"
  | "headings"
  | "images"
  | "text-blocks"
  | "other";

export interface WorkspaceProject {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspacePage extends ParsedInventoryPage {
  screenshotPaths: string[];
  annotatedScreenshotPath?: string;
  lastCrawledAt?: Date | null;
}

export interface WorkspaceElement extends ParsedInventoryElement {
  category: InventoryCategory;
  categoryFolder: WorkspaceCategoryFolder;
}

export interface WorkspaceData {
  project: WorkspaceProject;
  pages: WorkspacePage[];
  elements: WorkspaceElement[];
  tokenTable: InventoryTokenFrequencyTable;
}

export interface CatalogGroup {
  fingerprint: string;
  category: InventoryCategory;
  categoryFolder: WorkspaceCategoryFolder;
  instanceCount: number;
  pageCount: number;
  pageIds: string[];
  exemplarElementId: string;
  cropPath?: string;
  cropContextPath?: string;
  styles: Record<string, unknown>;
  regions: Record<string, number>;
  isGlobalChrome: boolean;
  textSamples: string[];
  elementIds: string[];
}

export interface WorkspaceBuildResult {
  projectId: string;
  workspaceRoot: string;
  pageCount: number;
  elementCount: number;
  categoryCounts: Record<string, number>;
  generatedAt: string;
}

