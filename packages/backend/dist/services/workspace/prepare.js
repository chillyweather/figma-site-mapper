import { analyzeRegionsAndTemplates } from "../inventory/regionDetection.js";
import { buildCatalogGroups, categoryCounts } from "./manifests.js";
export function composeWorkspaceArtifacts(data) {
    return {
        catalogGroups: buildCatalogGroups(data.elements),
        regionAnalysis: analyzeRegionsAndTemplates(data.pages, data.elements),
        globalChromeElements: data.elements.filter((element) => element.isGlobalChrome === true),
        categoryCountsAll: categoryCounts(data.elements),
    };
}
