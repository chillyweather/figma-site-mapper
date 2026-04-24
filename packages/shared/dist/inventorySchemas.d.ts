import { z } from "zod";
export declare const InventoryCategorySchema: z.ZodEnum<["button", "link", "input", "select", "textarea", "heading", "image", "text-block", "other"]>;
export declare const InventoryTokenGroupSchema: z.ZodEnum<["color", "typography", "spacing", "radius", "shadow"]>;
export declare const InventoryTokenDecisionSchema: z.ZodObject<{
    name: z.ZodString;
    value: z.ZodString;
    sourceValues: z.ZodArray<z.ZodUnknown, "many">;
    usage: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    value: string;
    sourceValues: unknown[];
    usage: string;
}, {
    name: string;
    value: string;
    sourceValues: unknown[];
    usage: string;
}>;
export declare const InventoryTokenDecisionFileSchema: z.ZodObject<{
    colors: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        value: z.ZodString;
        sourceValues: z.ZodArray<z.ZodUnknown, "many">;
        usage: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        value: string;
        sourceValues: unknown[];
        usage: string;
    }, {
        name: string;
        value: string;
        sourceValues: unknown[];
        usage: string;
    }>, "many">>;
    typography: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        value: z.ZodString;
        sourceValues: z.ZodArray<z.ZodUnknown, "many">;
        usage: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        value: string;
        sourceValues: unknown[];
        usage: string;
    }, {
        name: string;
        value: string;
        sourceValues: unknown[];
        usage: string;
    }>, "many">>;
    spacing: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        value: z.ZodString;
        sourceValues: z.ZodArray<z.ZodUnknown, "many">;
        usage: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        value: string;
        sourceValues: unknown[];
        usage: string;
    }, {
        name: string;
        value: string;
        sourceValues: unknown[];
        usage: string;
    }>, "many">>;
    radii: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        value: z.ZodString;
        sourceValues: z.ZodArray<z.ZodUnknown, "many">;
        usage: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        value: string;
        sourceValues: unknown[];
        usage: string;
    }, {
        name: string;
        value: string;
        sourceValues: unknown[];
        usage: string;
    }>, "many">>;
    shadows: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        value: z.ZodString;
        sourceValues: z.ZodArray<z.ZodUnknown, "many">;
        usage: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        value: string;
        sourceValues: unknown[];
        usage: string;
    }, {
        name: string;
        value: string;
        sourceValues: unknown[];
        usage: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    typography: {
        name: string;
        value: string;
        sourceValues: unknown[];
        usage: string;
    }[];
    spacing: {
        name: string;
        value: string;
        sourceValues: unknown[];
        usage: string;
    }[];
    colors: {
        name: string;
        value: string;
        sourceValues: unknown[];
        usage: string;
    }[];
    radii: {
        name: string;
        value: string;
        sourceValues: unknown[];
        usage: string;
    }[];
    shadows: {
        name: string;
        value: string;
        sourceValues: unknown[];
        usage: string;
    }[];
}, {
    typography?: {
        name: string;
        value: string;
        sourceValues: unknown[];
        usage: string;
    }[] | undefined;
    spacing?: {
        name: string;
        value: string;
        sourceValues: unknown[];
        usage: string;
    }[] | undefined;
    colors?: {
        name: string;
        value: string;
        sourceValues: unknown[];
        usage: string;
    }[] | undefined;
    radii?: {
        name: string;
        value: string;
        sourceValues: unknown[];
        usage: string;
    }[] | undefined;
    shadows?: {
        name: string;
        value: string;
        sourceValues: unknown[];
        usage: string;
    }[] | undefined;
}>;
export declare const InventoryClusterDecisionSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    category: z.ZodString;
    memberFingerprints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    representativeElementIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    confidence: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    category: string;
    memberFingerprints: string[];
    representativeElementIds: string[];
    name?: string | undefined;
    confidence?: string | undefined;
    notes?: string | undefined;
}, {
    id: string;
    category: string;
    name?: string | undefined;
    memberFingerprints?: string[] | undefined;
    representativeElementIds?: string[] | undefined;
    confidence?: string | undefined;
    notes?: string | undefined;
}>;
export declare const InventoryClusterDecisionFileSchema: z.ZodObject<{
    clusters: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        category: z.ZodString;
        memberFingerprints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        representativeElementIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        confidence: z.ZodOptional<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        category: string;
        memberFingerprints: string[];
        representativeElementIds: string[];
        name?: string | undefined;
        confidence?: string | undefined;
        notes?: string | undefined;
    }, {
        id: string;
        category: string;
        name?: string | undefined;
        memberFingerprints?: string[] | undefined;
        representativeElementIds?: string[] | undefined;
        confidence?: string | undefined;
        notes?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    clusters: {
        id: string;
        category: string;
        memberFingerprints: string[];
        representativeElementIds: string[];
        name?: string | undefined;
        confidence?: string | undefined;
        notes?: string | undefined;
    }[];
}, {
    clusters?: {
        id: string;
        category: string;
        name?: string | undefined;
        memberFingerprints?: string[] | undefined;
        representativeElementIds?: string[] | undefined;
        confidence?: string | undefined;
        notes?: string | undefined;
    }[] | undefined;
}>;
export declare const InventoryInconsistencyDecisionSchema: z.ZodObject<{
    id: z.ZodString;
    severity: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    summary: z.ZodOptional<z.ZodString>;
    evidence: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    recommendation: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    evidence: string[];
    severity?: string | undefined;
    description?: string | undefined;
    summary?: string | undefined;
    recommendation?: string | undefined;
}, {
    id: string;
    severity?: string | undefined;
    description?: string | undefined;
    summary?: string | undefined;
    evidence?: string[] | undefined;
    recommendation?: string | undefined;
}>;
export declare const InventoryInconsistencyDecisionFileSchema: z.ZodObject<{
    issues: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        severity: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        summary: z.ZodOptional<z.ZodString>;
        evidence: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        recommendation: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        evidence: string[];
        severity?: string | undefined;
        description?: string | undefined;
        summary?: string | undefined;
        recommendation?: string | undefined;
    }, {
        id: string;
        severity?: string | undefined;
        description?: string | undefined;
        summary?: string | undefined;
        evidence?: string[] | undefined;
        recommendation?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    issues: {
        id: string;
        evidence: string[];
        severity?: string | undefined;
        description?: string | undefined;
        summary?: string | undefined;
        recommendation?: string | undefined;
    }[];
}, {
    issues?: {
        id: string;
        severity?: string | undefined;
        description?: string | undefined;
        summary?: string | undefined;
        evidence?: string[] | undefined;
        recommendation?: string | undefined;
    }[] | undefined;
}>;
export declare const InventoryTemplateDecisionSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    pageIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    regions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    pageIds: string[];
    regions: string[];
    name?: string | undefined;
    notes?: string | undefined;
}, {
    id: string;
    name?: string | undefined;
    notes?: string | undefined;
    pageIds?: string[] | undefined;
    regions?: string[] | undefined;
}>;
export declare const InventoryTemplateDecisionFileSchema: z.ZodObject<{
    templates: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        pageIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        regions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        pageIds: string[];
        regions: string[];
        name?: string | undefined;
        notes?: string | undefined;
    }, {
        id: string;
        name?: string | undefined;
        notes?: string | undefined;
        pageIds?: string[] | undefined;
        regions?: string[] | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    templates: {
        id: string;
        pageIds: string[];
        regions: string[];
        name?: string | undefined;
        notes?: string | undefined;
    }[];
}, {
    templates?: {
        id: string;
        name?: string | undefined;
        notes?: string | undefined;
        pageIds?: string[] | undefined;
        regions?: string[] | undefined;
    }[] | undefined;
}>;
export declare const ClusterExampleSchema: z.ZodObject<{
    fingerprint: z.ZodString;
    shortFingerprint: z.ZodString;
    instanceCount: z.ZodNumber;
    pageCount: z.ZodNumber;
    textSamples: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    elementId: z.ZodNullable<z.ZodString>;
    pageId: z.ZodNullable<z.ZodString>;
    bbox: z.ZodNullable<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    cropUrl: z.ZodNullable<z.ZodString>;
    cropContextUrl: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    fingerprint: string;
    shortFingerprint: string;
    instanceCount: number;
    pageCount: number;
    textSamples: string[];
    elementId: string | null;
    pageId: string | null;
    bbox: [number, number, number, number] | null;
    cropUrl: string | null;
    cropContextUrl: string | null;
}, {
    fingerprint: string;
    shortFingerprint: string;
    instanceCount: number;
    pageCount: number;
    elementId: string | null;
    pageId: string | null;
    bbox: [number, number, number, number] | null;
    cropUrl: string | null;
    cropContextUrl: string | null;
    textSamples?: string[] | undefined;
}>;
export declare const InventoryDecisionSummarySchema: z.ZodObject<{
    hasDecisions: z.ZodBoolean;
    clusterCount: z.ZodNumber;
    tokenCount: z.ZodNumber;
    inconsistencyCount: z.ZodNumber;
    templateCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    hasDecisions: boolean;
    clusterCount: number;
    tokenCount: number;
    inconsistencyCount: number;
    templateCount: number;
}, {
    hasDecisions: boolean;
    clusterCount: number;
    tokenCount: number;
    inconsistencyCount: number;
    templateCount: number;
}>;
export declare const InventoryOverviewSchema: z.ZodObject<{
    projectId: z.ZodString;
    workspaceRoot: z.ZodString;
    hasWorkspace: z.ZodBoolean;
    lastBuiltAt: z.ZodNullable<z.ZodString>;
    pageCount: z.ZodNumber;
    elementCount: z.ZodNumber;
    decisionSummary: z.ZodObject<{
        hasDecisions: z.ZodBoolean;
        clusterCount: z.ZodNumber;
        tokenCount: z.ZodNumber;
        inconsistencyCount: z.ZodNumber;
        templateCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        hasDecisions: boolean;
        clusterCount: number;
        tokenCount: number;
        inconsistencyCount: number;
        templateCount: number;
    }, {
        hasDecisions: boolean;
        clusterCount: number;
        tokenCount: number;
        inconsistencyCount: number;
        templateCount: number;
    }>;
    crawlRunId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    inventoryBuildId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    latestCrawlRunId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    isWorkspaceStale: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    pageCount: number;
    projectId: string;
    workspaceRoot: string;
    hasWorkspace: boolean;
    lastBuiltAt: string | null;
    elementCount: number;
    decisionSummary: {
        hasDecisions: boolean;
        clusterCount: number;
        tokenCount: number;
        inconsistencyCount: number;
        templateCount: number;
    };
    crawlRunId?: string | null | undefined;
    inventoryBuildId?: string | null | undefined;
    latestCrawlRunId?: string | null | undefined;
    isWorkspaceStale?: boolean | undefined;
}, {
    pageCount: number;
    projectId: string;
    workspaceRoot: string;
    hasWorkspace: boolean;
    lastBuiltAt: string | null;
    elementCount: number;
    decisionSummary: {
        hasDecisions: boolean;
        clusterCount: number;
        tokenCount: number;
        inconsistencyCount: number;
        templateCount: number;
    };
    crawlRunId?: string | null | undefined;
    inventoryBuildId?: string | null | undefined;
    latestCrawlRunId?: string | null | undefined;
    isWorkspaceStale?: boolean | undefined;
}>;
export declare const InventoryDecisionsSchema: z.ZodObject<{
    projectId: z.ZodString;
    workspaceRoot: z.ZodString;
    hasWorkspace: z.ZodBoolean;
    lastBuiltAt: z.ZodNullable<z.ZodString>;
    clusters: z.ZodUnknown;
    tokens: z.ZodUnknown;
    inconsistencies: z.ZodUnknown;
    templates: z.ZodUnknown;
    notes: z.ZodString;
    clusterExamples: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodObject<{
        fingerprint: z.ZodString;
        shortFingerprint: z.ZodString;
        instanceCount: z.ZodNumber;
        pageCount: z.ZodNumber;
        textSamples: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        elementId: z.ZodNullable<z.ZodString>;
        pageId: z.ZodNullable<z.ZodString>;
        bbox: z.ZodNullable<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
        cropUrl: z.ZodNullable<z.ZodString>;
        cropContextUrl: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        fingerprint: string;
        shortFingerprint: string;
        instanceCount: number;
        pageCount: number;
        textSamples: string[];
        elementId: string | null;
        pageId: string | null;
        bbox: [number, number, number, number] | null;
        cropUrl: string | null;
        cropContextUrl: string | null;
    }, {
        fingerprint: string;
        shortFingerprint: string;
        instanceCount: number;
        pageCount: number;
        elementId: string | null;
        pageId: string | null;
        bbox: [number, number, number, number] | null;
        cropUrl: string | null;
        cropContextUrl: string | null;
        textSamples?: string[] | undefined;
    }>, "many">>>;
}, "strip", z.ZodTypeAny, {
    notes: string;
    projectId: string;
    workspaceRoot: string;
    hasWorkspace: boolean;
    lastBuiltAt: string | null;
    clusters?: unknown;
    templates?: unknown;
    tokens?: unknown;
    inconsistencies?: unknown;
    clusterExamples?: Record<string, {
        fingerprint: string;
        shortFingerprint: string;
        instanceCount: number;
        pageCount: number;
        textSamples: string[];
        elementId: string | null;
        pageId: string | null;
        bbox: [number, number, number, number] | null;
        cropUrl: string | null;
        cropContextUrl: string | null;
    }[]> | undefined;
}, {
    notes: string;
    projectId: string;
    workspaceRoot: string;
    hasWorkspace: boolean;
    lastBuiltAt: string | null;
    clusters?: unknown;
    templates?: unknown;
    tokens?: unknown;
    inconsistencies?: unknown;
    clusterExamples?: Record<string, {
        fingerprint: string;
        shortFingerprint: string;
        instanceCount: number;
        pageCount: number;
        elementId: string | null;
        pageId: string | null;
        bbox: [number, number, number, number] | null;
        cropUrl: string | null;
        cropContextUrl: string | null;
        textSamples?: string[] | undefined;
    }[]> | undefined;
}>;
export declare const RenderAssetSchema: z.ZodObject<{
    kind: z.ZodEnum<["image", "color"]>;
    url: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "image" | "color";
    color?: string | undefined;
    url?: string | undefined;
    label?: string | undefined;
}, {
    kind: "image" | "color";
    color?: string | undefined;
    url?: string | undefined;
    label?: string | undefined;
}>;
export declare const RenderLinkTargetSchema: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
    kind: z.ZodLiteral<"sample">;
    pageId: z.ZodString;
    elementId: z.ZodString;
    bbox: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
}, "strip", z.ZodTypeAny, {
    elementId: string;
    pageId: string;
    bbox: [number, number, number, number];
    kind: "sample";
}, {
    elementId: string;
    pageId: string;
    bbox: [number, number, number, number];
    kind: "sample";
}>, z.ZodObject<{
    kind: z.ZodLiteral<"page">;
    pageId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    pageId: string;
    kind: "page";
}, {
    pageId: string;
    kind: "page";
}>]>;
export declare const RenderLinkSchema: z.ZodObject<{
    label: z.ZodString;
    target: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
        kind: z.ZodLiteral<"sample">;
        pageId: z.ZodString;
        elementId: z.ZodString;
        bbox: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
    }, "strip", z.ZodTypeAny, {
        elementId: string;
        pageId: string;
        bbox: [number, number, number, number];
        kind: "sample";
    }, {
        elementId: string;
        pageId: string;
        bbox: [number, number, number, number];
        kind: "sample";
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"page">;
        pageId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        pageId: string;
        kind: "page";
    }, {
        pageId: string;
        kind: "page";
    }>]>;
}, "strip", z.ZodTypeAny, {
    label: string;
    target: {
        elementId: string;
        pageId: string;
        bbox: [number, number, number, number];
        kind: "sample";
    } | {
        pageId: string;
        kind: "page";
    };
}, {
    label: string;
    target: {
        elementId: string;
        pageId: string;
        bbox: [number, number, number, number];
        kind: "sample";
    } | {
        pageId: string;
        kind: "page";
    };
}>;
export declare const RenderCardSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    subtitle: z.ZodOptional<z.ZodString>;
    badges: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    body: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    assets: z.ZodDefault<z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["image", "color"]>;
        url: z.ZodOptional<z.ZodString>;
        color: z.ZodOptional<z.ZodString>;
        label: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "image" | "color";
        color?: string | undefined;
        url?: string | undefined;
        label?: string | undefined;
    }, {
        kind: "image" | "color";
        color?: string | undefined;
        url?: string | undefined;
        label?: string | undefined;
    }>, "many">>;
    links: z.ZodDefault<z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        target: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
            kind: z.ZodLiteral<"sample">;
            pageId: z.ZodString;
            elementId: z.ZodString;
            bbox: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        }, "strip", z.ZodTypeAny, {
            elementId: string;
            pageId: string;
            bbox: [number, number, number, number];
            kind: "sample";
        }, {
            elementId: string;
            pageId: string;
            bbox: [number, number, number, number];
            kind: "sample";
        }>, z.ZodObject<{
            kind: z.ZodLiteral<"page">;
            pageId: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            pageId: string;
            kind: "page";
        }, {
            pageId: string;
            kind: "page";
        }>]>;
    }, "strip", z.ZodTypeAny, {
        label: string;
        target: {
            elementId: string;
            pageId: string;
            bbox: [number, number, number, number];
            kind: "sample";
        } | {
            pageId: string;
            kind: "page";
        };
    }, {
        label: string;
        target: {
            elementId: string;
            pageId: string;
            bbox: [number, number, number, number];
            kind: "sample";
        } | {
            pageId: string;
            kind: "page";
        };
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    badges: string[];
    body: string[];
    assets: {
        kind: "image" | "color";
        color?: string | undefined;
        url?: string | undefined;
        label?: string | undefined;
    }[];
    links: {
        label: string;
        target: {
            elementId: string;
            pageId: string;
            bbox: [number, number, number, number];
            kind: "sample";
        } | {
            pageId: string;
            kind: "page";
        };
    }[];
    subtitle?: string | undefined;
}, {
    id: string;
    title: string;
    subtitle?: string | undefined;
    badges?: string[] | undefined;
    body?: string[] | undefined;
    assets?: {
        kind: "image" | "color";
        color?: string | undefined;
        url?: string | undefined;
        label?: string | undefined;
    }[] | undefined;
    links?: {
        label: string;
        target: {
            elementId: string;
            pageId: string;
            bbox: [number, number, number, number];
            kind: "sample";
        } | {
            pageId: string;
            kind: "page";
        };
    }[] | undefined;
}>;
export declare const RenderSectionSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    kind: z.ZodEnum<["components", "tokens", "issues", "templates", "notes"]>;
    cards: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        subtitle: z.ZodOptional<z.ZodString>;
        badges: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        body: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        assets: z.ZodDefault<z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<["image", "color"]>;
            url: z.ZodOptional<z.ZodString>;
            color: z.ZodOptional<z.ZodString>;
            label: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            kind: "image" | "color";
            color?: string | undefined;
            url?: string | undefined;
            label?: string | undefined;
        }, {
            kind: "image" | "color";
            color?: string | undefined;
            url?: string | undefined;
            label?: string | undefined;
        }>, "many">>;
        links: z.ZodDefault<z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            target: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
                kind: z.ZodLiteral<"sample">;
                pageId: z.ZodString;
                elementId: z.ZodString;
                bbox: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
            }, "strip", z.ZodTypeAny, {
                elementId: string;
                pageId: string;
                bbox: [number, number, number, number];
                kind: "sample";
            }, {
                elementId: string;
                pageId: string;
                bbox: [number, number, number, number];
                kind: "sample";
            }>, z.ZodObject<{
                kind: z.ZodLiteral<"page">;
                pageId: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                pageId: string;
                kind: "page";
            }, {
                pageId: string;
                kind: "page";
            }>]>;
        }, "strip", z.ZodTypeAny, {
            label: string;
            target: {
                elementId: string;
                pageId: string;
                bbox: [number, number, number, number];
                kind: "sample";
            } | {
                pageId: string;
                kind: "page";
            };
        }, {
            label: string;
            target: {
                elementId: string;
                pageId: string;
                bbox: [number, number, number, number];
                kind: "sample";
            } | {
                pageId: string;
                kind: "page";
            };
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
        badges: string[];
        body: string[];
        assets: {
            kind: "image" | "color";
            color?: string | undefined;
            url?: string | undefined;
            label?: string | undefined;
        }[];
        links: {
            label: string;
            target: {
                elementId: string;
                pageId: string;
                bbox: [number, number, number, number];
                kind: "sample";
            } | {
                pageId: string;
                kind: "page";
            };
        }[];
        subtitle?: string | undefined;
    }, {
        id: string;
        title: string;
        subtitle?: string | undefined;
        badges?: string[] | undefined;
        body?: string[] | undefined;
        assets?: {
            kind: "image" | "color";
            color?: string | undefined;
            url?: string | undefined;
            label?: string | undefined;
        }[] | undefined;
        links?: {
            label: string;
            target: {
                elementId: string;
                pageId: string;
                bbox: [number, number, number, number];
                kind: "sample";
            } | {
                pageId: string;
                kind: "page";
            };
        }[] | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    id: string;
    kind: "issues" | "notes" | "templates" | "tokens" | "components";
    title: string;
    cards: {
        id: string;
        title: string;
        badges: string[];
        body: string[];
        assets: {
            kind: "image" | "color";
            color?: string | undefined;
            url?: string | undefined;
            label?: string | undefined;
        }[];
        links: {
            label: string;
            target: {
                elementId: string;
                pageId: string;
                bbox: [number, number, number, number];
                kind: "sample";
            } | {
                pageId: string;
                kind: "page";
            };
        }[];
        subtitle?: string | undefined;
    }[];
}, {
    id: string;
    kind: "issues" | "notes" | "templates" | "tokens" | "components";
    title: string;
    cards?: {
        id: string;
        title: string;
        subtitle?: string | undefined;
        badges?: string[] | undefined;
        body?: string[] | undefined;
        assets?: {
            kind: "image" | "color";
            color?: string | undefined;
            url?: string | undefined;
            label?: string | undefined;
        }[] | undefined;
        links?: {
            label: string;
            target: {
                elementId: string;
                pageId: string;
                bbox: [number, number, number, number];
                kind: "sample";
            } | {
                pageId: string;
                kind: "page";
            };
        }[] | undefined;
    }[] | undefined;
}>;
export declare const RenderBoardSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    sections: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        kind: z.ZodEnum<["components", "tokens", "issues", "templates", "notes"]>;
        cards: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
            subtitle: z.ZodOptional<z.ZodString>;
            badges: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            body: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            assets: z.ZodDefault<z.ZodArray<z.ZodObject<{
                kind: z.ZodEnum<["image", "color"]>;
                url: z.ZodOptional<z.ZodString>;
                color: z.ZodOptional<z.ZodString>;
                label: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                kind: "image" | "color";
                color?: string | undefined;
                url?: string | undefined;
                label?: string | undefined;
            }, {
                kind: "image" | "color";
                color?: string | undefined;
                url?: string | undefined;
                label?: string | undefined;
            }>, "many">>;
            links: z.ZodDefault<z.ZodArray<z.ZodObject<{
                label: z.ZodString;
                target: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
                    kind: z.ZodLiteral<"sample">;
                    pageId: z.ZodString;
                    elementId: z.ZodString;
                    bbox: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
                }, "strip", z.ZodTypeAny, {
                    elementId: string;
                    pageId: string;
                    bbox: [number, number, number, number];
                    kind: "sample";
                }, {
                    elementId: string;
                    pageId: string;
                    bbox: [number, number, number, number];
                    kind: "sample";
                }>, z.ZodObject<{
                    kind: z.ZodLiteral<"page">;
                    pageId: z.ZodString;
                }, "strip", z.ZodTypeAny, {
                    pageId: string;
                    kind: "page";
                }, {
                    pageId: string;
                    kind: "page";
                }>]>;
            }, "strip", z.ZodTypeAny, {
                label: string;
                target: {
                    elementId: string;
                    pageId: string;
                    bbox: [number, number, number, number];
                    kind: "sample";
                } | {
                    pageId: string;
                    kind: "page";
                };
            }, {
                label: string;
                target: {
                    elementId: string;
                    pageId: string;
                    bbox: [number, number, number, number];
                    kind: "sample";
                } | {
                    pageId: string;
                    kind: "page";
                };
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            title: string;
            badges: string[];
            body: string[];
            assets: {
                kind: "image" | "color";
                color?: string | undefined;
                url?: string | undefined;
                label?: string | undefined;
            }[];
            links: {
                label: string;
                target: {
                    elementId: string;
                    pageId: string;
                    bbox: [number, number, number, number];
                    kind: "sample";
                } | {
                    pageId: string;
                    kind: "page";
                };
            }[];
            subtitle?: string | undefined;
        }, {
            id: string;
            title: string;
            subtitle?: string | undefined;
            badges?: string[] | undefined;
            body?: string[] | undefined;
            assets?: {
                kind: "image" | "color";
                color?: string | undefined;
                url?: string | undefined;
                label?: string | undefined;
            }[] | undefined;
            links?: {
                label: string;
                target: {
                    elementId: string;
                    pageId: string;
                    bbox: [number, number, number, number];
                    kind: "sample";
                } | {
                    pageId: string;
                    kind: "page";
                };
            }[] | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        kind: "issues" | "notes" | "templates" | "tokens" | "components";
        title: string;
        cards: {
            id: string;
            title: string;
            badges: string[];
            body: string[];
            assets: {
                kind: "image" | "color";
                color?: string | undefined;
                url?: string | undefined;
                label?: string | undefined;
            }[];
            links: {
                label: string;
                target: {
                    elementId: string;
                    pageId: string;
                    bbox: [number, number, number, number];
                    kind: "sample";
                } | {
                    pageId: string;
                    kind: "page";
                };
            }[];
            subtitle?: string | undefined;
        }[];
    }, {
        id: string;
        kind: "issues" | "notes" | "templates" | "tokens" | "components";
        title: string;
        cards?: {
            id: string;
            title: string;
            subtitle?: string | undefined;
            badges?: string[] | undefined;
            body?: string[] | undefined;
            assets?: {
                kind: "image" | "color";
                color?: string | undefined;
                url?: string | undefined;
                label?: string | undefined;
            }[] | undefined;
            links?: {
                label: string;
                target: {
                    elementId: string;
                    pageId: string;
                    bbox: [number, number, number, number];
                    kind: "sample";
                } | {
                    pageId: string;
                    kind: "page";
                };
            }[] | undefined;
        }[] | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    sections: {
        id: string;
        kind: "issues" | "notes" | "templates" | "tokens" | "components";
        title: string;
        cards: {
            id: string;
            title: string;
            badges: string[];
            body: string[];
            assets: {
                kind: "image" | "color";
                color?: string | undefined;
                url?: string | undefined;
                label?: string | undefined;
            }[];
            links: {
                label: string;
                target: {
                    elementId: string;
                    pageId: string;
                    bbox: [number, number, number, number];
                    kind: "sample";
                } | {
                    pageId: string;
                    kind: "page";
                };
            }[];
            subtitle?: string | undefined;
        }[];
    }[];
}, {
    id: string;
    title: string;
    sections?: {
        id: string;
        kind: "issues" | "notes" | "templates" | "tokens" | "components";
        title: string;
        cards?: {
            id: string;
            title: string;
            subtitle?: string | undefined;
            badges?: string[] | undefined;
            body?: string[] | undefined;
            assets?: {
                kind: "image" | "color";
                color?: string | undefined;
                url?: string | undefined;
                label?: string | undefined;
            }[] | undefined;
            links?: {
                label: string;
                target: {
                    elementId: string;
                    pageId: string;
                    bbox: [number, number, number, number];
                    kind: "sample";
                } | {
                    pageId: string;
                    kind: "page";
                };
            }[] | undefined;
        }[] | undefined;
    }[] | undefined;
}>;
export declare const InventoryRenderDataSchema: z.ZodObject<{
    projectId: z.ZodString;
    hasWorkspace: z.ZodDefault<z.ZodBoolean>;
    build: z.ZodObject<{
        inventoryBuildId: z.ZodNullable<z.ZodString>;
        crawlRunId: z.ZodNullable<z.ZodString>;
        isWorkspaceStale: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        crawlRunId: string | null;
        inventoryBuildId: string | null;
        isWorkspaceStale: boolean;
    }, {
        crawlRunId: string | null;
        inventoryBuildId: string | null;
        isWorkspaceStale: boolean;
    }>;
    boards: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        sections: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
            kind: z.ZodEnum<["components", "tokens", "issues", "templates", "notes"]>;
            cards: z.ZodDefault<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                title: z.ZodString;
                subtitle: z.ZodOptional<z.ZodString>;
                badges: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                body: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                assets: z.ZodDefault<z.ZodArray<z.ZodObject<{
                    kind: z.ZodEnum<["image", "color"]>;
                    url: z.ZodOptional<z.ZodString>;
                    color: z.ZodOptional<z.ZodString>;
                    label: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    kind: "image" | "color";
                    color?: string | undefined;
                    url?: string | undefined;
                    label?: string | undefined;
                }, {
                    kind: "image" | "color";
                    color?: string | undefined;
                    url?: string | undefined;
                    label?: string | undefined;
                }>, "many">>;
                links: z.ZodDefault<z.ZodArray<z.ZodObject<{
                    label: z.ZodString;
                    target: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
                        kind: z.ZodLiteral<"sample">;
                        pageId: z.ZodString;
                        elementId: z.ZodString;
                        bbox: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
                    }, "strip", z.ZodTypeAny, {
                        elementId: string;
                        pageId: string;
                        bbox: [number, number, number, number];
                        kind: "sample";
                    }, {
                        elementId: string;
                        pageId: string;
                        bbox: [number, number, number, number];
                        kind: "sample";
                    }>, z.ZodObject<{
                        kind: z.ZodLiteral<"page">;
                        pageId: z.ZodString;
                    }, "strip", z.ZodTypeAny, {
                        pageId: string;
                        kind: "page";
                    }, {
                        pageId: string;
                        kind: "page";
                    }>]>;
                }, "strip", z.ZodTypeAny, {
                    label: string;
                    target: {
                        elementId: string;
                        pageId: string;
                        bbox: [number, number, number, number];
                        kind: "sample";
                    } | {
                        pageId: string;
                        kind: "page";
                    };
                }, {
                    label: string;
                    target: {
                        elementId: string;
                        pageId: string;
                        bbox: [number, number, number, number];
                        kind: "sample";
                    } | {
                        pageId: string;
                        kind: "page";
                    };
                }>, "many">>;
            }, "strip", z.ZodTypeAny, {
                id: string;
                title: string;
                badges: string[];
                body: string[];
                assets: {
                    kind: "image" | "color";
                    color?: string | undefined;
                    url?: string | undefined;
                    label?: string | undefined;
                }[];
                links: {
                    label: string;
                    target: {
                        elementId: string;
                        pageId: string;
                        bbox: [number, number, number, number];
                        kind: "sample";
                    } | {
                        pageId: string;
                        kind: "page";
                    };
                }[];
                subtitle?: string | undefined;
            }, {
                id: string;
                title: string;
                subtitle?: string | undefined;
                badges?: string[] | undefined;
                body?: string[] | undefined;
                assets?: {
                    kind: "image" | "color";
                    color?: string | undefined;
                    url?: string | undefined;
                    label?: string | undefined;
                }[] | undefined;
                links?: {
                    label: string;
                    target: {
                        elementId: string;
                        pageId: string;
                        bbox: [number, number, number, number];
                        kind: "sample";
                    } | {
                        pageId: string;
                        kind: "page";
                    };
                }[] | undefined;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            kind: "issues" | "notes" | "templates" | "tokens" | "components";
            title: string;
            cards: {
                id: string;
                title: string;
                badges: string[];
                body: string[];
                assets: {
                    kind: "image" | "color";
                    color?: string | undefined;
                    url?: string | undefined;
                    label?: string | undefined;
                }[];
                links: {
                    label: string;
                    target: {
                        elementId: string;
                        pageId: string;
                        bbox: [number, number, number, number];
                        kind: "sample";
                    } | {
                        pageId: string;
                        kind: "page";
                    };
                }[];
                subtitle?: string | undefined;
            }[];
        }, {
            id: string;
            kind: "issues" | "notes" | "templates" | "tokens" | "components";
            title: string;
            cards?: {
                id: string;
                title: string;
                subtitle?: string | undefined;
                badges?: string[] | undefined;
                body?: string[] | undefined;
                assets?: {
                    kind: "image" | "color";
                    color?: string | undefined;
                    url?: string | undefined;
                    label?: string | undefined;
                }[] | undefined;
                links?: {
                    label: string;
                    target: {
                        elementId: string;
                        pageId: string;
                        bbox: [number, number, number, number];
                        kind: "sample";
                    } | {
                        pageId: string;
                        kind: "page";
                    };
                }[] | undefined;
            }[] | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
        sections: {
            id: string;
            kind: "issues" | "notes" | "templates" | "tokens" | "components";
            title: string;
            cards: {
                id: string;
                title: string;
                badges: string[];
                body: string[];
                assets: {
                    kind: "image" | "color";
                    color?: string | undefined;
                    url?: string | undefined;
                    label?: string | undefined;
                }[];
                links: {
                    label: string;
                    target: {
                        elementId: string;
                        pageId: string;
                        bbox: [number, number, number, number];
                        kind: "sample";
                    } | {
                        pageId: string;
                        kind: "page";
                    };
                }[];
                subtitle?: string | undefined;
            }[];
        }[];
    }, {
        id: string;
        title: string;
        sections?: {
            id: string;
            kind: "issues" | "notes" | "templates" | "tokens" | "components";
            title: string;
            cards?: {
                id: string;
                title: string;
                subtitle?: string | undefined;
                badges?: string[] | undefined;
                body?: string[] | undefined;
                assets?: {
                    kind: "image" | "color";
                    color?: string | undefined;
                    url?: string | undefined;
                    label?: string | undefined;
                }[] | undefined;
                links?: {
                    label: string;
                    target: {
                        elementId: string;
                        pageId: string;
                        bbox: [number, number, number, number];
                        kind: "sample";
                    } | {
                        pageId: string;
                        kind: "page";
                    };
                }[] | undefined;
            }[] | undefined;
        }[] | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    projectId: string;
    hasWorkspace: boolean;
    build: {
        crawlRunId: string | null;
        inventoryBuildId: string | null;
        isWorkspaceStale: boolean;
    };
    boards: {
        id: string;
        title: string;
        sections: {
            id: string;
            kind: "issues" | "notes" | "templates" | "tokens" | "components";
            title: string;
            cards: {
                id: string;
                title: string;
                badges: string[];
                body: string[];
                assets: {
                    kind: "image" | "color";
                    color?: string | undefined;
                    url?: string | undefined;
                    label?: string | undefined;
                }[];
                links: {
                    label: string;
                    target: {
                        elementId: string;
                        pageId: string;
                        bbox: [number, number, number, number];
                        kind: "sample";
                    } | {
                        pageId: string;
                        kind: "page";
                    };
                }[];
                subtitle?: string | undefined;
            }[];
        }[];
    }[];
}, {
    projectId: string;
    build: {
        crawlRunId: string | null;
        inventoryBuildId: string | null;
        isWorkspaceStale: boolean;
    };
    hasWorkspace?: boolean | undefined;
    boards?: {
        id: string;
        title: string;
        sections?: {
            id: string;
            kind: "issues" | "notes" | "templates" | "tokens" | "components";
            title: string;
            cards?: {
                id: string;
                title: string;
                subtitle?: string | undefined;
                badges?: string[] | undefined;
                body?: string[] | undefined;
                assets?: {
                    kind: "image" | "color";
                    color?: string | undefined;
                    url?: string | undefined;
                    label?: string | undefined;
                }[] | undefined;
                links?: {
                    label: string;
                    target: {
                        elementId: string;
                        pageId: string;
                        bbox: [number, number, number, number];
                        kind: "sample";
                    } | {
                        pageId: string;
                        kind: "page";
                    };
                }[] | undefined;
            }[] | undefined;
        }[] | undefined;
    }[] | undefined;
}>;
export declare const WorkspaceMetaSchema: z.ZodObject<{
    schemaVersion: z.ZodNumber;
    lastBuiltAt: z.ZodOptional<z.ZodString>;
    projectId: z.ZodOptional<z.ZodString>;
    sourceDbRowVersions: z.ZodOptional<z.ZodObject<{
        pageIds: z.ZodArray<z.ZodString, "many">;
        elementCount: z.ZodNumber;
        latestPageUpdatedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        pageIds: string[];
        elementCount: number;
        latestPageUpdatedAt: string | null;
    }, {
        pageIds: string[];
        elementCount: number;
        latestPageUpdatedAt: string | null;
    }>>;
    inventoryBuildId: z.ZodOptional<z.ZodString>;
    crawlRunId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    schemaVersion: number;
    projectId?: string | undefined;
    lastBuiltAt?: string | undefined;
    crawlRunId?: string | undefined;
    inventoryBuildId?: string | undefined;
    sourceDbRowVersions?: {
        pageIds: string[];
        elementCount: number;
        latestPageUpdatedAt: string | null;
    } | undefined;
}, {
    schemaVersion: number;
    projectId?: string | undefined;
    lastBuiltAt?: string | undefined;
    crawlRunId?: string | undefined;
    inventoryBuildId?: string | undefined;
    sourceDbRowVersions?: {
        pageIds: string[];
        elementCount: number;
        latestPageUpdatedAt: string | null;
    } | undefined;
}>;
export declare const CrawlRunSchema: z.ZodObject<{
    id: z.ZodNumber;
    projectId: z.ZodNumber;
    jobId: z.ZodNullable<z.ZodString>;
    startUrl: z.ZodString;
    settingsJson: z.ZodString;
    pageIdsJson: z.ZodString;
    pageCount: z.ZodNumber;
    elementCount: z.ZodNumber;
    status: z.ZodEnum<["running", "completed", "failed"]>;
    startedAt: z.ZodNumber;
    completedAt: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    status: "running" | "completed" | "failed";
    id: number;
    pageCount: number;
    projectId: number;
    elementCount: number;
    jobId: string | null;
    startUrl: string;
    settingsJson: string;
    pageIdsJson: string;
    startedAt: number;
    completedAt: number | null;
}, {
    status: "running" | "completed" | "failed";
    id: number;
    pageCount: number;
    projectId: number;
    elementCount: number;
    jobId: string | null;
    startUrl: string;
    settingsJson: string;
    pageIdsJson: string;
    startedAt: number;
    completedAt: number | null;
}>;
export declare const InventoryBuildSchema: z.ZodObject<{
    id: z.ZodNumber;
    projectId: z.ZodNumber;
    crawlRunId: z.ZodNullable<z.ZodNumber>;
    workspacePath: z.ZodString;
    schemaVersion: z.ZodNumber;
    pageCount: z.ZodNumber;
    elementCount: z.ZodNumber;
    status: z.ZodEnum<["running", "completed", "failed"]>;
    startedAt: z.ZodNumber;
    completedAt: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    status: "running" | "completed" | "failed";
    id: number;
    pageCount: number;
    projectId: number;
    elementCount: number;
    crawlRunId: number | null;
    schemaVersion: number;
    startedAt: number;
    completedAt: number | null;
    workspacePath: string;
}, {
    status: "running" | "completed" | "failed";
    id: number;
    pageCount: number;
    projectId: number;
    elementCount: number;
    crawlRunId: number | null;
    schemaVersion: number;
    startedAt: number;
    completedAt: number | null;
    workspacePath: string;
}>;
export type InventoryCategory = z.infer<typeof InventoryCategorySchema>;
export type InventoryTokenGroup = z.infer<typeof InventoryTokenGroupSchema>;
export type InventoryTokenDecision = z.infer<typeof InventoryTokenDecisionSchema>;
export type InventoryTokenDecisionFile = z.infer<typeof InventoryTokenDecisionFileSchema>;
export type InventoryClusterDecision = z.infer<typeof InventoryClusterDecisionSchema>;
export type InventoryClusterDecisionFile = z.infer<typeof InventoryClusterDecisionFileSchema>;
export type InventoryInconsistencyDecision = z.infer<typeof InventoryInconsistencyDecisionSchema>;
export type InventoryInconsistencyDecisionFile = z.infer<typeof InventoryInconsistencyDecisionFileSchema>;
export type InventoryTemplateDecision = z.infer<typeof InventoryTemplateDecisionSchema>;
export type InventoryTemplateDecisionFile = z.infer<typeof InventoryTemplateDecisionFileSchema>;
export type ClusterExample = z.infer<typeof ClusterExampleSchema>;
export type InventoryDecisionSummary = z.infer<typeof InventoryDecisionSummarySchema>;
export type InventoryOverview = z.infer<typeof InventoryOverviewSchema>;
export type InventoryDecisions = z.infer<typeof InventoryDecisionsSchema>;
export type RenderAsset = z.infer<typeof RenderAssetSchema>;
export type RenderLinkTarget = z.infer<typeof RenderLinkTargetSchema>;
export type RenderLink = z.infer<typeof RenderLinkSchema>;
export type RenderCard = z.infer<typeof RenderCardSchema>;
export type RenderSection = z.infer<typeof RenderSectionSchema>;
export type RenderBoard = z.infer<typeof RenderBoardSchema>;
export type InventoryRenderData = z.infer<typeof InventoryRenderDataSchema>;
export type WorkspaceMeta = z.infer<typeof WorkspaceMetaSchema>;
export type CrawlRun = z.infer<typeof CrawlRunSchema>;
export type InventoryBuild = z.infer<typeof InventoryBuildSchema>;
