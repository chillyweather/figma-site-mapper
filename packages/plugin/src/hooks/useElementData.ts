import { useEffect } from "react";
import { useAtom } from "jotai";
import { manifestDataAtom, categorizedElementsAtom } from "../store/atoms";
import { categorizeElements } from "../utils/elementCategorization";
import type { TreeNode } from "../types";

/**
 * Find a page by URL in the page tree
 */
function findPageByUrl(node: TreeNode, url: string): TreeNode | null {
  if (node.url === url) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findPageByUrl(child, url);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Hook to load and categorize elements from manifest data
 * Automatically updates categorizedElementsAtom when manifest or page changes
 */
export function useElementData(selectedPageUrl?: string) {
  const [manifestData] = useAtom(manifestDataAtom);
  const [categorizedElements, setCategorizedElements] = useAtom(
    categorizedElementsAtom
  );

  useEffect(() => {
    if (!manifestData || !manifestData.tree) {
      console.log("No manifest tree data");
      setCategorizedElements(null);
      return;
    }

    // Find the selected page or use the root page
    const rootPage = manifestData.tree;
    if (!rootPage) {
      setCategorizedElements(null);
      return;
    }

    let targetPage: TreeNode = rootPage;
    if (selectedPageUrl) {
      const foundPage = findPageByUrl(rootPage, selectedPageUrl);
      if (foundPage) {
        targetPage = foundPage;
      }
    }

    console.log(
      "Target page for elements:",
      targetPage.url || targetPage.title
    );
    console.log("Target page styleData:", targetPage.styleData);

    if (!targetPage.styleData || !targetPage.styleData.elements) {
      console.log("No elements in styleData for this page");
      setCategorizedElements(null);
      return;
    }

    const elements = targetPage.styleData.elements;
    console.log(`Found ${elements.length} elements to categorize`);

    const categorized = categorizeElements(elements);
    setCategorizedElements(categorized);

    console.log("Categorized elements:", categorized);
    console.log(
      "Element counts:",
      Object.entries(categorized).map(([type, els]) => `${type}: ${els.length}`)
    );
  }, [manifestData, selectedPageUrl, setCategorizedElements]);

  return {
    manifestData,
    categorizedElements,
  };
}
