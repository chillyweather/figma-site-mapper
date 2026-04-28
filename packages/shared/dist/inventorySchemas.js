import { z } from "zod";
// ── Primitives ──────────────────────────────────────────────────────────────
export const InventoryCategorySchema = z.enum([
    "button",
    "link",
    "input",
    "select",
    "textarea",
    "heading",
    "image",
    "text-block",
    "other",
]);
export const InventoryTokenGroupSchema = z.enum([
    "color",
    "typography",
    "spacing",
    "radius",
    "shadow",
]);
// ── Token decisions ─────────────────────────────────────────────────────────
export const InventoryTokenDecisionSchema = z.object({
    name: z.string(),
    value: z.string(),
    sourceValues: z.array(z.unknown()),
    usage: z.string(),
});
export const InventoryTokenDecisionFileSchema = z.object({
    colors: z.array(InventoryTokenDecisionSchema).default([]),
    typography: z.array(InventoryTokenDecisionSchema).default([]),
    spacing: z.array(InventoryTokenDecisionSchema).default([]),
    radii: z.array(InventoryTokenDecisionSchema).default([]),
    shadows: z.array(InventoryTokenDecisionSchema).default([]),
});
// ── Cluster decisions ───────────────────────────────────────────────────────
export const InventoryClusterDecisionSchema = z.object({
    id: z.string(),
    name: z.string().optional(),
    category: z.string(),
    memberFingerprints: z.array(z.string()).default([]),
    representativeElementIds: z.array(z.string()).default([]),
    confidence: z.string().optional(),
    notes: z.string().optional(),
});
export const InventoryClusterDecisionFileSchema = z.object({
    clusters: z.array(InventoryClusterDecisionSchema).default([]),
});
// ── Inconsistency decisions ─────────────────────────────────────────────────
export const InventoryInconsistencyDecisionSchema = z.object({
    id: z.string(),
    severity: z.string().optional(),
    description: z.string().optional(),
    summary: z.string().optional(),
    evidence: z.array(z.string()).default([]),
    recommendation: z.string().optional(),
});
export const InventoryInconsistencyDecisionFileSchema = z.object({
    issues: z.array(InventoryInconsistencyDecisionSchema).default([]),
});
// ── Template decisions ──────────────────────────────────────────────────────
export const InventoryTemplateDecisionSchema = z.object({
    id: z.string(),
    name: z.string().optional(),
    pageIds: z.array(z.string()).default([]),
    regions: z.array(z.string()).default([]),
    notes: z.string().optional(),
});
export const InventoryTemplateDecisionFileSchema = z.object({
    templates: z.array(InventoryTemplateDecisionSchema).default([]),
});
// ── Cluster example (enriched by backend render-data) ───────────────────────
export const ClusterExampleSchema = z.object({
    fingerprint: z.string(),
    shortFingerprint: z.string(),
    instanceCount: z.number(),
    pageCount: z.number(),
    textSamples: z.array(z.string()).default([]),
    elementId: z.string().nullable(),
    pageId: z.string().nullable(),
    bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(),
    cropUrl: z.string().nullable(),
    cropContextUrl: z.string().nullable(),
});
// ── Decision summary ────────────────────────────────────────────────────────
export const InventoryDecisionSummarySchema = z.object({
    hasDecisions: z.boolean(),
    clusterCount: z.number(),
    tokenCount: z.number(),
    inconsistencyCount: z.number(),
    templateCount: z.number(),
});
// ── Overview ────────────────────────────────────────────────────────────────
export const InventoryOverviewSchema = z.object({
    projectId: z.string(),
    workspaceRoot: z.string(),
    hasWorkspace: z.boolean(),
    lastBuiltAt: z.string().nullable(),
    pageCount: z.number(),
    elementCount: z.number(),
    decisionSummary: InventoryDecisionSummarySchema,
    crawlRunId: z.string().nullable().optional(),
    inventoryBuildId: z.string().nullable().optional(),
    latestCrawlRunId: z.string().nullable().optional(),
    isWorkspaceStale: z.boolean().optional(),
});
export const MappingContextRepoSummarySchema = z.object({
    enabled: z.boolean(),
    path: z.string().nullable(),
    requestedBranch: z.string().nullable(),
    requestedBranchRef: z.string().nullable().optional(),
    resolvedBranch: z.string().nullable(),
    resolvedHeadRef: z.string().nullable().optional(),
    commitSha: z.string().nullable(),
    status: z.string(),
});
export const MappingContextStorybookSummarySchema = z.object({
    enabled: z.boolean(),
    url: z.string().nullable(),
    path: z.string().nullable(),
    status: z.string(),
    detectedRoots: z.array(z.string()).optional(),
    storyCount: z.number().optional(),
    componentCount: z.number().optional(),
});
export const MappingContextUiLibrarySummarySchema = z.object({
    enabled: z.boolean(),
    configuredName: z.string().nullable(),
    hints: z.array(z.string()),
    status: z.string(),
});
export const MappingContextSummarySchema = z.object({
    projectId: z.string(),
    workspaceRoot: z.string(),
    hasMappingContext: z.boolean(),
    generatedAt: z.string().nullable(),
    mode: z.string().nullable(),
    repo: MappingContextRepoSummarySchema,
    storybook: MappingContextStorybookSummarySchema,
    uiLibrary: MappingContextUiLibrarySummarySchema,
    tokenSources: z.array(z.string()),
    warnings: z.array(z.string()),
    agentHandoffText: z.string(),
});
// ── Mapping suggestions (read-only guidance for the agent) ───────────────────
export const MappingSuggestionCandidateSchema = z.object({
    name: z.string(),
    source: z.enum(["storybook", "repo", "ui-library"]),
    confidence: z.enum(["high", "medium", "low"]),
});
export const MappingSuggestionsSchema = z.object({
    generatedAt: z.string(),
    projectId: z.string(),
    repoStatus: z.string(),
    storybookStatus: z.string(),
    uiLibraryHints: z.array(z.string()),
    topComponentCandidates: z.array(MappingSuggestionCandidateSchema),
    topTokenCandidates: z.array(MappingSuggestionCandidateSchema),
    topTemplateCandidates: z.array(MappingSuggestionCandidateSchema),
    warnings: z.array(z.string()),
});
// ── Decisions payload (what /inventory/decisions returns) ───────────────────
export const InventoryDecisionsSchema = z.object({
    projectId: z.string(),
    workspaceRoot: z.string(),
    hasWorkspace: z.boolean(),
    lastBuiltAt: z.string().nullable(),
    clusters: z.unknown(),
    tokens: z.unknown(),
    inconsistencies: z.unknown(),
    templates: z.unknown(),
    notes: z.string(),
    clusterExamples: z.record(z.string(), z.array(ClusterExampleSchema)).optional(),
});
// ── Render model (Stage 4 target) ───────────────────────────────────────────
export const RenderAssetSchema = z.object({
    kind: z.enum(["image", "color"]),
    url: z.string().optional(),
    color: z.string().optional(),
    label: z.string().optional(),
});
export const RenderLinkTargetSchema = z.discriminatedUnion("kind", [
    z.object({
        kind: z.literal("sample"),
        pageId: z.string(),
        elementId: z.string(),
        bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    }),
    z.object({
        kind: z.literal("page"),
        pageId: z.string(),
    }),
]);
export const RenderLinkSchema = z.object({
    label: z.string(),
    target: RenderLinkTargetSchema,
});
export const RenderCardSchema = z.object({
    id: z.string(),
    title: z.string(),
    subtitle: z.string().optional(),
    badges: z.array(z.string()).default([]),
    body: z.array(z.string()).default([]),
    assets: z.array(RenderAssetSchema).default([]),
    links: z.array(RenderLinkSchema).default([]),
});
export const RenderSectionSchema = z.object({
    id: z.string(),
    title: z.string(),
    kind: z.enum(["components", "tokens", "issues", "templates", "notes"]),
    cards: z.array(RenderCardSchema).default([]),
});
export const RenderBoardSchema = z.object({
    id: z.string(),
    title: z.string(),
    sections: z.array(RenderSectionSchema).default([]),
});
export const InventoryRenderDataSchema = z.object({
    projectId: z.string(),
    hasWorkspace: z.boolean().default(false),
    build: z.object({
        inventoryBuildId: z.string().nullable(),
        crawlRunId: z.string().nullable(),
        isWorkspaceStale: z.boolean(),
    }),
    boards: z.array(RenderBoardSchema).default([]),
});
// ── Workspace meta ──────────────────────────────────────────────────────────
export const WorkspaceMetaSchema = z.object({
    schemaVersion: z.number(),
    lastBuiltAt: z.string().optional(),
    projectId: z.string().optional(),
    sourceDbRowVersions: z
        .object({
        pageIds: z.array(z.string()),
        elementCount: z.number(),
        latestPageUpdatedAt: z.string().nullable(),
    })
        .optional(),
    // Stage 3 additions
    inventoryBuildId: z.string().optional(),
    crawlRunId: z.string().optional(),
});
// ── Crawl run (Stage 2) ─────────────────────────────────────────────────────
export const CrawlRunSchema = z.object({
    id: z.number(),
    projectId: z.number(),
    jobId: z.string().nullable(),
    startUrl: z.string(),
    settingsJson: z.string(),
    pageIdsJson: z.string(),
    pageCount: z.number(),
    elementCount: z.number(),
    status: z.enum(["running", "completed", "failed"]),
    startedAt: z.number(),
    completedAt: z.number().nullable(),
});
// ── Inventory build (Stage 3) ───────────────────────────────────────────────
export const InventoryBuildSchema = z.object({
    id: z.number(),
    projectId: z.number(),
    crawlRunId: z.number().nullable(),
    workspacePath: z.string(),
    schemaVersion: z.number(),
    pageCount: z.number(),
    elementCount: z.number(),
    status: z.enum(["running", "completed", "failed"]),
    startedAt: z.number(),
    completedAt: z.number().nullable(),
});
