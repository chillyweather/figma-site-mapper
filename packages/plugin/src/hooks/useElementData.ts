import { useEffect } from "react";
import { useAtom } from "jotai";
import { manifestDataAtom, categorizedElementsAtom } from "../store/atoms";
import { categorizeElements } from "../utils/elementCategorization";

/**
 * Hook to load and categorize elements from manifest data
 * Automatically updates categorizedElementsAtom when manifest changes
 */
export function useElementData() {
  const [manifestData] = useAtom(manifestDataAtom);
  const [categorizedElements, setCategorizedElements] = useAtom(
    categorizedElementsAtom
  );

  useEffect(() => {
    if (!manifestData?.tree?.styleData?.elements) {
      setCategorizedElements(null);
      return;
    }

    const elements = manifestData.tree.styleData.elements;
    const categorized = categorizeElements(elements);
    setCategorizedElements(categorized);

    console.log("Categorized elements:", categorized);
    console.log(
      "Element counts:",
      Object.entries(categorized).map(([type, els]) => `${type}: ${els.length}`)
    );
  }, [manifestData, setCategorizedElements]);

  return {
    manifestData,
    categorizedElements,
  };
}
