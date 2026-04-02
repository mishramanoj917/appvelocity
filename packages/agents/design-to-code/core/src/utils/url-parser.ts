/**
 * Figma URL parser
 *
 * Handles all Figma URL formats:
 *   https://www.figma.com/file/KEY/Name?node-id=...
 *   https://www.figma.com/design/KEY/Name?node-id=...
 *   https://figma.com/file/KEY/...
 */

export interface ParsedFigmaUrl {
  fileKey: string;
  nodeId?: string;
  fileName?: string;
}

const FIGMA_URL_RE =
  /figma\.com\/(?:file|design)\/([a-zA-Z0-9_-]+)(?:\/([^?#]*))?(?:\?.*?node-id=([^&#]+))?/;

export function parseFigmaUrl(url: string): ParsedFigmaUrl {
  // Also accept a bare file key (no URL)
  if (!url.includes('figma.com')) {
    if (/^[a-zA-Z0-9_-]{10,}$/.test(url)) {
      return { fileKey: url };
    }
    throw new Error(
      `Invalid Figma URL or file key: "${url}". ` +
        'Expected a full Figma URL (https://www.figma.com/file/...) or a bare file key.'
    );
  }

  const match = FIGMA_URL_RE.exec(url);
  if (!match?.[1]) {
    throw new Error(
      `Could not extract file key from Figma URL: "${url}". ` +
        'Make sure the URL contains /file/ or /design/ followed by the file key.'
    );
  }

  return {
    fileKey: match[1],
    fileName: match[2] ? decodeURIComponent(match[2].replace(/-/g, ' ')).trim() : undefined,
    nodeId: match[3] ? decodeURIComponent(match[3]) : undefined,
  };
}

/** Normalises a Figma node ID to the colon format used by the REST API */
export function normaliseNodeId(nodeId: string): string {
  // Figma uses "0:1" in the API but URLs encode it as "0-1"
  return nodeId.replace(/-/g, ':');
}
