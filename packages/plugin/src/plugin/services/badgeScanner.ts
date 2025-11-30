import { BadgeLink } from "../types";

/**
 * Scan current Figma page for badge-with-link elements
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
      if (group.type !== "GROUP") continue;

      const links = extractLinksFromBadge(group);
      badgeLinks.push(...links);
    }

    badgeLinks.sort(compareBadgeLinks);

    console.log(`Found ${badgeLinks.length} internal badge links`);
    return badgeLinks;
  } catch (error) {
    console.error("Error scanning for badge links:", error);
    return [];
  }
}

/**
 * Extract hyperlinks from badge group
 */
function extractLinksFromBadge(group: GroupNode): BadgeLink[] {
  const links: BadgeLink[] = [];
  const textNodes = group.findAll((node: SceneNode) => node.type === "TEXT");
  const groupBadgeNumber = parseBadgeNumber(group.name);

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
          const badgeNumber = groupBadgeNumber ?? parseBadgeNumber(node.name);
          console.log(
            `🔗 Badge scanner: Found badge "${text}" (#${badgeNumber ?? "?"}) with URL "${url}" (node ID: ${node.id})`
          );
          links.push({
            id: node.id,
            text,
            url,
            badgeNumber: badgeNumber ?? undefined,
          });
        }
      } catch (e) {
        console.log("⚠️ Failed to extract hyperlink:", e);
      }
    }
  }

  return links;
}

function parseBadgeNumber(name?: string): number | null {
  if (!name) {
    return null;
  }

  const match = name.match(/link_(\d+)/i);
  if (!match) {
    return null;
  }

  const value = parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
}

function compareBadgeLinks(a: BadgeLink, b: BadgeLink): number {
  const aNumber = typeof a.badgeNumber === "number" ? a.badgeNumber : null;
  const bNumber = typeof b.badgeNumber === "number" ? b.badgeNumber : null;

  if (aNumber !== null && bNumber !== null && aNumber !== bNumber) {
    return aNumber - bNumber;
  }

  if (aNumber !== null && bNumber === null) {
    return -1;
  }

  if (aNumber === null && bNumber !== null) {
    return 1;
  }

  if (a.text !== b.text) {
    return a.text.localeCompare(b.text);
  }

  return a.id.localeCompare(b.id);
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
