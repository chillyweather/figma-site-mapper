/**
 * Parse hostname from a URL string
 */
export function parseHostname(url: string): string | null {
  try {
    const withoutProtocol = url.replace(/^https?:\/\//, "");
    const hostname = withoutProtocol.split(/[\/:\?#]/)[0];
    return hostname.toLowerCase();
  } catch (error) {
    return null;
  }
}

/**
 * Check if a link is external (different domain)
 */
export function isExternalLink(href: string, baseUrl: string): boolean {
  try {
    // Handle relative URLs - they are internal
    if (!href.startsWith("http://") && !href.startsWith("https://")) {
      return false;
    }

    const linkHostname = parseHostname(href);
    const baseHostname = parseHostname(baseUrl);

    if (!linkHostname || !baseHostname) {
      return false;
    }

    return linkHostname !== baseHostname;
  } catch (error) {
    return false;
  }
}
