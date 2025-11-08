import { useAtom } from "jotai";
import { useCallback, useEffect, useMemo } from "react";
import {
  markupFiltersAtom,
  activeMarkupPageAtom,
  isMarkupRenderingAtom,
  markupStatusAtom,
} from "../store/atoms";
import type { ElementFilters } from "../types";

type FilterKey = keyof ElementFilters;

const SUPPORTED_FILTERS: FilterKey[] = [
  "buttons",
  "links",
  "inputs",
  "textareas",
  "selects",
  "images",
  "paragraphs",
  "divs",
  "other",
  "headings",
];

interface ActiveMarkupPage {
  pageId: string | null;
  pageUrl: string | null;
  pageName?: string;
}

export function useMarkup() {
  const [filters, setFilters] = useAtom(markupFiltersAtom);
  const [activePage, setActivePage] = useAtom(activeMarkupPageAtom);
  const [isRendering, setIsRendering] = useAtom(isMarkupRenderingAtom);
  const [status, setStatus] = useAtom(markupStatusAtom);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage;
      if (!msg) return;

      switch (msg.type) {
        case "active-screenshot-page": {
          if (msg.isScreenshot) {
            const pageInfo: ActiveMarkupPage = {
              pageId: msg.pageId ?? null,
              pageUrl: msg.pageUrl ?? null,
              pageName: msg.pageName,
            };
            setActivePage(pageInfo);
          } else {
            setActivePage(null);
          }
          break;
        }
        case "markup-render-started": {
          setIsRendering(true);
          setStatus(msg.message || "Rendering highlights...");
          break;
        }
        case "markup-render-progress": {
          if (msg.message) {
            setStatus(msg.message);
          }
          break;
        }
        case "markup-render-complete": {
          setIsRendering(false);
          setStatus(msg.message || "Highlights rendered.");
          break;
        }
        case "markup-render-error": {
          setIsRendering(false);
          setStatus(msg.error || "Failed to render highlights.");
          break;
        }
        case "markup-clear-complete": {
          setIsRendering(false);
          setStatus(msg.message || "Highlights cleared.");
          break;
        }
        case "markup-clear-error": {
          setIsRendering(false);
          setStatus(msg.error || "Failed to clear highlights.");
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [setActivePage, setIsRendering, setStatus]);

  const handleFilterChange = useCallback(
    (filter: FilterKey, checked: boolean) => {
      setFilters((prev) => ({
        ...prev,
        [filter]: checked,
      }));
    },
    [setFilters]
  );

  const selectedFilterCount = useMemo(() => {
    return SUPPORTED_FILTERS.reduce(
      (count, key) => (filters[key] ? count + 1 : count),
      0
    );
  }, [filters]);

  const handleRenderMarkup = useCallback(() => {
    if (!activePage || !activePage.pageId) {
      setStatus("Open a generated screenshot page to render highlights.");
      return;
    }

    if (selectedFilterCount === 0) {
      setStatus("Select at least one element type before rendering.");
      return;
    }

    setIsRendering(true);
    setStatus("Requesting markup highlights...");

    parent.postMessage(
      {
        pluginMessage: {
          type: "render-markup",
          pageId: activePage.pageId,
          pageUrl: activePage.pageUrl,
          elementFilters: filters,
        },
      },
      "*"
    );
  }, [activePage, filters, selectedFilterCount, setIsRendering, setStatus]);

  const handleClearMarkup = useCallback(() => {
    if (!activePage || !activePage.pageId) {
      setStatus("Open a generated screenshot page to clear highlights.");
      return;
    }

    setIsRendering(true);
    setStatus("Clearing highlights...");

    parent.postMessage(
      {
        pluginMessage: {
          type: "clear-markup",
          pageId: activePage.pageId,
          pageUrl: activePage.pageUrl,
        },
      },
      "*"
    );
  }, [activePage, setIsRendering, setStatus]);

  const supportedFilters = useMemo(() => SUPPORTED_FILTERS, []);

  return {
    filters,
    activePage,
    isRendering,
    status,
    handleFilterChange,
    handleRenderMarkup,
    handleClearMarkup,
    supportedFilters,
    selectedFilterCount,
  };
}
