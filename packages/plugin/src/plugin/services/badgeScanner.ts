import { BadgeLink } from "../types";
import { BADGE_COLORS } from "../constants";

/**
 * Scan current Figma page for badge-with-link elements (only internal links)
 */
export async function scanForBadgeLinks(): Promise<BadgeLink[]> {
  const badgeLinks: BadgeLink[] = [];

  try {
    const badgeGroups = figma.currentPage.findAll(
      (node: SceneNode) =>
        node.type === "GROUP" &&
        node.name.startsWith("link_") &&
        node.name.endsWith("_badge")
    );

    for (const group of badgeGroups) {
      if (group.type === "GROUP") {
        const isInternal = checkIfInternalBadge(group);

        if (!isInternal) continue;

        const links = extractLinksFromBadge(group);
        badgeLinks.push(...links);
      }
    }

    console.log(`Found ${badgeLinks.length} internal badge links`);
    return badgeLinks;
  } catch (error) {
    console.error("Error scanning for badge links:", error);
    return [];
  }
}

/**
 * Check if badge is for an internal link (orange badge)
 */
function checkIfInternalBadge(group: GroupNode): boolean {
  const ellipseNodes = group.findAll(
    (node: SceneNode) => node.type === "ELLIPSE"
  );

  for (const node of ellipseNodes) {
    if (
      node.type === "ELLIPSE" &&
      node.fills &&
      Array.isArray(node.fills) &&
      node.fills.length > 0
    ) {
      const fill = node.fills[0];
      if (fill.type === "SOLID") {
        const color = fill.color;
        const internal = BADGE_COLORS.INTERNAL;

        if (
          Math.abs(color.r - internal.r) < 0.1 &&
          Math.abs(color.g - internal.g) < 0.1 &&
          Math.abs(color.b - internal.b) < 0.1
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Extract hyperlinks from badge group
 */
function extractLinksFromBadge(group: GroupNode): BadgeLink[] {
  const links: BadgeLink[] = [];
  const textNodes = group.findAll((node: SceneNode) => node.type === "TEXT");

  for (const node of textNodes) {
    if (node.type === "TEXT" && node.hyperlink) {
      try {
        const hyperlink = node.hyperlink;
        let url = "";
        const text = node.characters || "Link";

        if (typeof hyperlink === "object" && hyperlink !== null) {
          if ("type" in hyperlink && hyperlink.type === "URL") {
            url = (hyperlink as any).value || "";
          } else if ("value" in hyperlink) {
            url = (hyperlink as any).value || "";
          }
        }

        if (url) {
          links.push({ id: node.id, text, url });
        }
      } catch (e) {
        console.log('⚠️ Failed to extract hyperlink:', e);
      }
    }
  }

  return links;
}

/**
 * Send badge links to UI
 */
export async function updateMappingTab(): Promise<void> {
  const badgeLinks = await scanForBadgeLinks();
  figma.ui.postMessage({
    type: "badge-links-update",
    badgeLinks,
  });
}
