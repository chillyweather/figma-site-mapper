import path from "path";
import crypto from "crypto";
import { analyzeRegionsAndTemplates } from "../inventory/regionDetection.js";
import { getNormalizedStyle } from "../inventory/normalizeStyles.js";
import { linkOrCopyFile, publicAssetUrlToLocalPath, toPosixRelative, writeJson, } from "./paths.js";
const CATALOG_FOLDERS = [
    "buttons",
    "links",
    "inputs",
    "headings",
    "images",
    "text-blocks",
    "other",
];
const STYLE_FIELDS = [
    "color",
    "background-color",
    "font-family",
    "font-size",
    "font-weight",
    "line-height",
    "letter-spacing",
    "text-transform",
    "text-decoration",
    "border-color",
    "border-width",
    "border-radius",
    "box-shadow",
    "padding",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "margin",
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "width",
    "height",
];
function increment(map, key) {
    map[key] = (map[key] ?? 0) + 1;
}
function fingerprintFileStem(fingerprint) {
    const hash = crypto.createHash("sha1").update(fingerprint).digest("hex").slice(0, 16);
    return `fp_${hash}`;
}
export function allCatalogFolders() {
    return CATALOG_FOLDERS;
}
export function categoryCounts(elements) {
    const counts = {};
    for (const element of elements) {
        increment(counts, element.category);
    }
    return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}
export function compactStyles(element) {
    const styles = {};
    for (const field of STYLE_FIELDS) {
        const value = getNormalizedStyle(element.styles, field);
        if (value)
            styles[field] = value;
    }
    return styles;
}
export function buildCatalogGroups(elements) {
    const groups = new Map();
    for (const element of elements) {
        if (!element.componentFingerprint)
            continue;
        const key = `${element.categoryFolder}:${element.componentFingerprint}`;
        const existing = groups.get(key) ?? [];
        existing.push(element);
        groups.set(key, existing);
    }
    const byFolder = new Map();
    for (const folder of CATALOG_FOLDERS)
        byFolder.set(folder, []);
    for (const instances of groups.values()) {
        const first = instances[0];
        if (!first?.componentFingerprint)
            continue;
        const pageIds = Array.from(new Set(instances.map((item) => item.pageId))).sort((a, b) => Number(a) - Number(b));
        const regions = {};
        const textSamples = [];
        for (const instance of instances) {
            increment(regions, instance.regionLabel ?? "content");
            const text = instance.text?.replace(/\s+/g, " ").trim();
            if (text && textSamples.length < 6 && !textSamples.includes(text)) {
                textSamples.push(text.slice(0, 120));
            }
        }
        const exemplar = instances.find((item) => item.cropPath) ??
            instances.find((item) => item.cropContextPath) ??
            first;
        const group = {
            fingerprint: first.componentFingerprint,
            category: first.category,
            categoryFolder: first.categoryFolder,
            instanceCount: instances.length,
            pageCount: pageIds.length,
            pageIds,
            exemplarElementId: exemplar.id,
            styles: compactStyles(first),
            regions: Object.fromEntries(Object.entries(regions).sort(([a], [b]) => a.localeCompare(b))),
            isGlobalChrome: instances.some((item) => item.isGlobalChrome === true),
            textSamples,
            elementIds: instances.map((item) => item.id),
        };
        byFolder.get(first.categoryFolder).push(group);
    }
    for (const [folder, folderGroups] of byFolder.entries()) {
        byFolder.set(folder, folderGroups.sort((a, b) => {
            if (b.instanceCount !== a.instanceCount)
                return b.instanceCount - a.instanceCount;
            return a.fingerprint.localeCompare(b.fingerprint);
        }));
    }
    return byFolder;
}
function compactElement(element, pageDir, catalogDir) {
    const cropPath = element.componentFingerprint
        ? path.join(catalogDir, element.categoryFolder, "crops", `${fingerprintFileStem(element.componentFingerprint)}.png`)
        : undefined;
    const cropContextPath = element.componentFingerprint
        ? path.join(catalogDir, element.categoryFolder, "crops", `${fingerprintFileStem(element.componentFingerprint)}-ctx.png`)
        : undefined;
    return {
        id: element.id,
        fingerprint: element.componentFingerprint,
        parentFingerprint: element.parentFingerprint,
        category: element.category,
        tag: element.tagName,
        role: element.role,
        text: element.text,
        bbox: element.bbox
            ? [element.bbox.x, element.bbox.y, element.bbox.width, element.bbox.height]
            : undefined,
        visible: element.isVisible,
        isGlobalChrome: element.isGlobalChrome ?? false,
        region: element.regionLabel,
        ancestry: element.ancestryPath,
        styles: compactStyles(element),
        crop: cropPath ? toPosixRelative(pageDir, cropPath) : undefined,
        cropContext: cropContextPath ? toPosixRelative(pageDir, cropContextPath) : undefined,
        childCount: element.childCount ?? 0,
    };
}
async function linkPageImages(page, pageDir) {
    const screenshotPaths = [];
    for (let index = 0; index < page.screenshotPaths.length; index++) {
        const source = publicAssetUrlToLocalPath(page.screenshotPaths[index]);
        if (!source)
            continue;
        const filename = index === 0 ? "screenshot.png" : `screenshot-${index + 1}.png`;
        const target = path.join(pageDir, filename);
        if (await linkOrCopyFile(source, target)) {
            screenshotPaths.push(filename);
        }
    }
    let annotatedScreenshotPath;
    const annotatedSource = publicAssetUrlToLocalPath(page.annotatedScreenshotPath);
    if (annotatedSource) {
        const target = path.join(pageDir, "screenshot-annotated.png");
        if (await linkOrCopyFile(annotatedSource, target)) {
            annotatedScreenshotPath = "screenshot-annotated.png";
        }
    }
    return {
        screenshotPath: screenshotPaths[0],
        annotatedScreenshotPath,
        screenshotPaths,
    };
}
export async function writePageManifests(workspacePath, data) {
    const catalogDir = path.join(workspacePath, "catalog");
    const elementsByPage = new Map();
    for (const element of data.elements) {
        const pageElements = elementsByPage.get(element.pageId) ?? [];
        pageElements.push(element);
        elementsByPage.set(element.pageId, pageElements);
    }
    for (const page of data.pages) {
        const pageDir = path.join(workspacePath, "pages", page.id);
        const pageElements = elementsByPage.get(page.id) ?? [];
        const imagePaths = await linkPageImages(page, pageDir);
        const pageCategoryCounts = categoryCounts(pageElements);
        const regionSummary = {};
        for (const element of pageElements) {
            increment(regionSummary, element.regionLabel ?? "content");
        }
        await writeJson(path.join(pageDir, "elements.json"), pageElements.map((element) => compactElement(element, pageDir, catalogDir)));
        await writeJson(path.join(pageDir, "page.json"), {
            pageId: page.id,
            url: page.url,
            title: page.title,
            screenshotPath: imagePaths.screenshotPath,
            screenshotPaths: imagePaths.screenshotPaths,
            annotatedScreenshotPath: imagePaths.annotatedScreenshotPath,
            elementCount: pageElements.length,
            categoryCounts: pageCategoryCounts,
            regionSummary: Object.fromEntries(Object.entries(regionSummary).sort(([a], [b]) => a.localeCompare(b))),
            elementsFile: "elements.json",
            lastCrawledAt: page.lastCrawledAt?.toISOString() ?? null,
        });
    }
}
export async function writeProjectManifest(workspacePath, data, generatedAt) {
    const firstUrl = data.pages[0]?.url;
    const baseUrl = firstUrl ? new URL(firstUrl).origin : null;
    await writeJson(path.join(workspacePath, "project.json"), {
        projectId: data.project.id,
        name: data.project.name,
        baseUrl,
        pageCount: data.pages.length,
        elementCount: data.elements.length,
        categoryCounts: categoryCounts(data.elements),
        generatedAt,
        schemaVersion: 1,
        sourceDb: {
            lastCrawlAt: data.pages
                .map((page) => page.lastCrawledAt?.getTime() ?? 0)
                .sort((a, b) => b - a)[0] ?? null,
        },
    });
}
export async function writeCatalogManifests(workspacePath, data, groupsByFolder) {
    const elementsByFolder = new Map();
    for (const folder of CATALOG_FOLDERS)
        elementsByFolder.set(folder, []);
    for (const element of data.elements) {
        elementsByFolder.get(element.categoryFolder).push(element);
    }
    for (const folder of CATALOG_FOLDERS) {
        const folderDir = path.join(workspacePath, "catalog", folder);
        const cropsDir = path.join(folderDir, "crops");
        const groups = groupsByFolder.get(folder) ?? [];
        const folderElements = elementsByFolder.get(folder) ?? [];
        for (const group of groups) {
            const exemplar = folderElements.find((element) => element.id === group.exemplarElementId);
            const cropSource = publicAssetUrlToLocalPath(exemplar?.cropPath);
            const contextSource = publicAssetUrlToLocalPath(exemplar?.cropContextPath);
            if (cropSource) {
                const fileStem = fingerprintFileStem(group.fingerprint);
                const target = path.join(cropsDir, `${fileStem}.png`);
                if (await linkOrCopyFile(cropSource, target)) {
                    group.cropPath = `crops/${fileStem}.png`;
                }
            }
            if (contextSource) {
                const fileStem = fingerprintFileStem(group.fingerprint);
                const target = path.join(cropsDir, `${fileStem}-ctx.png`);
                if (await linkOrCopyFile(contextSource, target)) {
                    group.cropContextPath = `crops/${fileStem}-ctx.png`;
                }
            }
        }
        await writeJson(path.join(folderDir, "groups.json"), groups);
        await writeJson(path.join(folderDir, "all-instances.json"), folderElements.map((element) => ({
            id: element.id,
            pageId: element.pageId,
            fingerprint: element.componentFingerprint,
            category: element.category,
            tag: element.tagName,
            role: element.role,
            text: element.text,
            region: element.regionLabel,
            isGlobalChrome: element.isGlobalChrome ?? false,
            cropPath: element.cropPath,
            cropContextPath: element.cropContextPath,
            childCount: element.childCount ?? 0,
            styles: compactStyles(element),
        })));
    }
}
export async function writeRegionManifests(workspacePath, data) {
    const { regions, templates } = analyzeRegionsAndTemplates(data.pages, data.elements);
    const globalChrome = data.elements
        .filter((element) => element.isGlobalChrome)
        .map((element) => ({
        id: element.id,
        pageId: element.pageId,
        fingerprint: element.componentFingerprint,
        category: element.category,
        text: element.text,
        region: element.regionLabel,
    }));
    await writeJson(path.join(workspacePath, "regions", "regions.json"), {
        regions,
        templates,
    });
    await writeJson(path.join(workspacePath, "regions", "global-chrome.json"), {
        count: globalChrome.length,
        elements: globalChrome,
    });
}
