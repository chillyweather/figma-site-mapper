import { useAtom } from "jotai";
import { useCallback, useEffect } from "react";
import {
  badgeLinksAtom,
  checkedLinksAtom,
  flowProgressAtom,
} from "../store/atoms";

export function useFlowMapping() {
  const [badgeLinks, setBadgeLinks] = useAtom(badgeLinksAtom);
  const [checkedLinks, setCheckedLinks] = useAtom(checkedLinksAtom);
  const [flowProgress, setFlowProgress] = useAtom(flowProgressAtom);

  // Listen for badge links and flow progress updates
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      if (msg.type === "badge-links-update") {
        setBadgeLinks(msg.badgeLinks || []);
      }

      if (msg.type === "flow-progress-update") {
        setFlowProgress(msg.flowProgress);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [setBadgeLinks, setFlowProgress]);

  const handleLinkCheck = useCallback(
    (linkId: string, checked: boolean) => {
      setCheckedLinks((prev: Set<string>) => {
        const newSet = new Set(prev);
        if (checked) {
          newSet.add(linkId);
        } else {
          newSet.delete(linkId);
        }
        return newSet;
      });
    },
    [setCheckedLinks]
  );

  const handleShowFlow = useCallback(() => {
    const selectedLinkIds = Array.from(checkedLinks);
    const selectedLinks = badgeLinks.filter((link) =>
      selectedLinkIds.includes(link.id)
    );

    console.log("Show Flow clicked with selected links:", selectedLinks);

    parent.postMessage(
      {
        pluginMessage: {
          type: "show-flow",
          selectedLinks: selectedLinks,
        },
      },
      "*"
    );

    setCheckedLinks(new Set());
  }, [checkedLinks, badgeLinks, setCheckedLinks]);

  return {
    badgeLinks,
    checkedLinks,
    handleLinkCheck,
    handleShowFlow,
    flowProgress,
  };
}
