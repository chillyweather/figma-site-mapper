export type MappingContextSourcePriority =
  | "repo"
  | "storybook"
  | "ui-library"
  | "tokens"
  | "crawl";

export type RepoContextStatus =
  | "not-configured"
  | "verified"
  | "branch-mismatch"
  | "missing-path"
  | "not-git"
  | "missing-branch"
  | "error";

export interface MappingContextProfile {
  projectId: string;
  mode: "crawl-only" | "crawl-plus-evidence";
  sourcePriority: MappingContextSourcePriority[];
  repo: {
    enabled: boolean;
    path: string | null;
    requestedBranch: string | null;
    resolvedBranch: string | null;
    commitSha: string | null;
    status: RepoContextStatus;
  };
  storybook: {
    enabled: boolean;
    url: string | null;
    path: string | null;
    status: "not-configured" | "pending";
  };
  uiLibrary: {
    enabled: boolean;
    name: string | null;
    status: "not-configured" | "pending";
  };
  tokenSources: string[];
  notes: string;
}

export interface RepoIndex {
  generatedAt: string;
  status: RepoContextStatus;
  repoPath: string | null;
  requestedBranch: string | null;
  requestedBranchRef: string | null;
  resolvedBranch: string | null;
  resolvedHeadRef: string | null;
  commitSha: string | null;
  packageManager: string | null;
  workspaceFiles: string[];
  packageRoots: string[];
  appRoots: string[];
  componentRoots: string[];
  routeRoots: string[];
  tokenSources: string[];
  storybookDetected: boolean;
  storybookRoots: string[];
  uiLibraryCandidates: string[];
  componentFileSamples: string[];
  notes: string[];
}

export interface StorybookIndexStory {
  title: string;
  componentName: string | null;
  variantNames: string[];
  argNames: string[];
  storyFilePath: string | null;
  sourceFilePath: string | null;
  sourceType: "csf" | "mdx" | "index-json";
}

export interface StorybookIndex {
  generatedAt: string;
  status: string;
  url: string | null;
  path: string | null;
  detectedRoots: string[];
  sourceMode: "none" | "configured-path" | "configured-url" | "repo-detected";
  storyCount: number;
  componentCount: number;
  stories: StorybookIndexStory[];
  notes: string[];
}

export interface SuggestionCandidate {
  name: string;
  source: "storybook" | "repo" | "ui-library";
  confidence: "high" | "medium" | "low";
}

export interface SuggestionsSummary {
  generatedAt: string;
  projectId: string;
  repoStatus: string;
  storybookStatus: string;
  uiLibraryHints: string[];
  topComponentCandidates: SuggestionCandidate[];
  topTokenCandidates: SuggestionCandidate[];
  topTemplateCandidates: SuggestionCandidate[];
  warnings: string[];
}
