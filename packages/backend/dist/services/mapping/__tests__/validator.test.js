import { describe, it, expect } from "vitest";
import { normalizeComponentType, validateDecisionFile, loadAndValidateDecisionFile, TIDY_MAPPER_COMPONENT_TYPES, } from "../validator.js";
const validInstance = {
    pageId: "5",
    elementId: "42",
    bbox: { x: 10, y: 20, width: 100, height: 40 },
    source: "dom",
    confidence: "high",
};
const validFile = {
    schemaVersion: 1,
    generatedAt: "2026-05-28T12:00:00Z",
    projectId: "1",
    components: [
        { type: "Buttons", instances: [validInstance] },
    ],
};
describe("normalizeComponentType", () => {
    it("passes through exact taxonomy names unchanged", () => {
        expect(normalizeComponentType("Buttons")).toBe("Buttons");
        expect(normalizeComponentType("Cards")).toBe("Cards");
        expect(normalizeComponentType("Other")).toBe("Other");
    });
    it("normalises lowercase aliases", () => {
        expect(normalizeComponentType("button")).toBe("Buttons");
        expect(normalizeComponentType("buttons")).toBe("Buttons");
        expect(normalizeComponentType("card")).toBe("Cards");
    });
    it("maps Slice-prefixed names to Other", () => {
        expect(normalizeComponentType("Slice 1")).toBe("Other");
        expect(normalizeComponentType("Slice")).toBe("Other");
    });
    it("maps empty string to Other", () => {
        expect(normalizeComponentType("")).toBe("Other");
    });
    it("preserves promoted types that look like proper nouns", () => {
        expect(normalizeComponentType("HeroSection")).toBe("HeroSection");
        expect(normalizeComponentType("ProductCard")).toBe("ProductCard");
    });
    it("maps lowercase unknown types to Other", () => {
        expect(normalizeComponentType("unknowntype")).toBe("Other");
    });
    it("handles whitespace trimming", () => {
        expect(normalizeComponentType("  Buttons  ")).toBe("Buttons");
    });
});
describe("validateDecisionFile", () => {
    it("accepts a valid file", () => {
        const { valid, warnings } = validateDecisionFile(validFile);
        expect(valid).toHaveLength(1);
        expect(valid[0].type).toBe("Buttons");
        expect(valid[0].instances).toHaveLength(1);
        expect(warnings).toHaveLength(0);
    });
    it("normalises type variants and records a warning", () => {
        const file = { ...validFile, components: [{ type: "button", instances: [validInstance] }] };
        const { valid, warnings } = validateDecisionFile(file);
        expect(valid[0].type).toBe("Buttons");
        expect(warnings.some((w) => w.includes("normalised"))).toBe(true);
    });
    it("skips instances with missing pageId", () => {
        const inst = { ...validInstance, pageId: "" };
        const { valid, warnings } = validateDecisionFile({ ...validFile, components: [{ type: "Buttons", instances: [inst] }] });
        expect(valid).toHaveLength(0);
        expect(warnings.length).toBeGreaterThan(0);
    });
    it("skips DOM instances with missing elementId", () => {
        const inst = { ...validInstance, elementId: "" };
        const { valid, warnings } = validateDecisionFile({ ...validFile, components: [{ type: "Buttons", instances: [inst] }] });
        expect(valid).toHaveLength(0);
    });
    it("accepts vision instances without elementId", () => {
        const { elementId, ...inst } = { ...validInstance, source: "vision" };
        const { valid, warnings } = validateDecisionFile({ ...validFile, components: [{ type: "Hero", instances: [inst] }] });
        expect(valid).toHaveLength(1);
        expect(valid[0].instances[0].source).toBe("vision");
        expect(valid[0].instances[0].instanceId).toBe("5:vision:0");
        expect(warnings).toHaveLength(0);
    });
    it("skips instances with zero-dimension bbox", () => {
        const inst = { ...validInstance, bbox: { x: 0, y: 0, width: 0, height: 0 } };
        const { valid, warnings } = validateDecisionFile({ ...validFile, components: [{ type: "Buttons", instances: [inst] }] });
        expect(valid).toHaveLength(0);
        expect(warnings.some((w) => w.includes("bbox"))).toBe(true);
    });
    it("skips instances with null bbox", () => {
        const inst = { ...validInstance, bbox: null };
        const { valid, warnings } = validateDecisionFile({ ...validFile, components: [{ type: "Buttons", instances: [inst] }] });
        expect(valid).toHaveLength(0);
    });
    it("defaults unknown source to dom", () => {
        const inst = { ...validInstance, source: "unknown" };
        const { valid } = validateDecisionFile({ ...validFile, components: [{ type: "Buttons", instances: [inst] }] });
        expect(valid[0].instances[0].source).toBe("dom");
    });
    it("accepts vision source", () => {
        const inst = { ...validInstance, source: "vision" };
        const { valid } = validateDecisionFile({ ...validFile, components: [{ type: "Buttons", instances: [inst] }] });
        expect(valid[0].instances[0].source).toBe("vision");
    });
    it("returns empty on non-object input", () => {
        const { valid, warnings } = validateDecisionFile(null);
        expect(valid).toHaveLength(0);
        expect(warnings.length).toBeGreaterThan(0);
    });
    it("returns empty when components is not an array", () => {
        const { valid, warnings } = validateDecisionFile({ components: "bad" });
        expect(valid).toHaveLength(0);
        expect(warnings.length).toBeGreaterThan(0);
    });
    it("keeps valid instances even when some are invalid in the same component", () => {
        const badInst = { ...validInstance, elementId: "" };
        const file = {
            ...validFile,
            components: [{ type: "Buttons", instances: [badInst, validInstance] }],
        };
        const { valid } = validateDecisionFile(file);
        expect(valid[0].instances).toHaveLength(1);
    });
    it("accepts PRD componentTypes shape and originElementId", () => {
        const file = {
            schemaVersion: 1,
            generatedAt: "2026-05-28T12:00:00Z",
            projectId: "1",
            componentTypes: [
                {
                    type: "Buttons",
                    promotedFromOther: false,
                    instances: [
                        {
                            instanceId: "btn-1",
                            pageId: "5",
                            sourceUrl: "https://example.com",
                            bbox: { x: 10, y: 20, width: 100, height: 40 },
                            originElementId: 42,
                            originSelector: "button.primary",
                            source: "dom",
                            rawLabel: "primary CTA",
                        },
                    ],
                },
            ],
        };
        const { valid } = validateDecisionFile(file);
        expect(valid).toHaveLength(1);
        expect(valid[0].instances[0].instanceId).toBe("btn-1");
        expect(valid[0].instances[0].elementId).toBe("42");
        expect(valid[0].instances[0].sourceUrl).toBe("https://example.com");
        expect(valid[0].instances[0].rawLabel).toBe("primary CTA");
    });
    it("accepts PRD otherInstances as Other", () => {
        const file = {
            schemaVersion: 1,
            generatedAt: "2026-05-28T12:00:00Z",
            projectId: "1",
            componentTypes: [],
            otherInstances: [
                {
                    instanceId: "other-1",
                    pageId: "5",
                    bbox: { x: 10, y: 20, width: 100, height: 40 },
                    source: "vision",
                    confidence: "low",
                },
            ],
        };
        const { valid } = validateDecisionFile(file);
        expect(valid).toHaveLength(1);
        expect(valid[0].type).toBe("Other");
    });
});
describe("loadAndValidateDecisionFile", () => {
    it("validates a valid JSON string", () => {
        const { valid, warnings } = loadAndValidateDecisionFile(JSON.stringify(validFile));
        expect(valid).toHaveLength(1);
        expect(warnings).toHaveLength(0);
    });
    it("returns error warning for invalid JSON", () => {
        const { valid, warnings } = loadAndValidateDecisionFile("not json {");
        expect(valid).toHaveLength(0);
        expect(warnings[0]).toMatch(/parse/i);
    });
});
describe("TIDY_MAPPER_COMPONENT_TYPES", () => {
    it("contains Other", () => {
        expect(TIDY_MAPPER_COMPONENT_TYPES.has("Other")).toBe(true);
    });
    it("contains Buttons", () => {
        expect(TIDY_MAPPER_COMPONENT_TYPES.has("Buttons")).toBe(true);
    });
    it("has at least 40 entries", () => {
        expect(TIDY_MAPPER_COMPONENT_TYPES.size).toBeGreaterThanOrEqual(40);
    });
});
