/// <reference types="@figma/plugin-typings" />

/**
 * AppVelocity Exporter — Figma Plugin
 *
 * Exports the current page as a ZIP containing:
 *   figma-export.json  — design tree + rendered bounds + variant properties
 *   assets/            — PNG @2x exports for every node with an image fill
 *
 * The ZIP is consumed by AppVelocity web UI in place of a Figma URL,
 * giving deterministic pixel-exact layout data and reliable asset bytes.
 */

figma.showUI(__html__, { width: 340, height: 260, title: 'AppVelocity Exporter' });

interface RenderedBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AssetFile {
  nodeId: string;
  fileName: string;
  bytes: number[]; // Uint8Array serialised as plain array for postMessage
}

figma.ui.onmessage = async (msg: { type: string }) => {
  if (msg.type !== 'export') return;

  const page = figma.currentPage;
  const allNodes = page.findAll();
  const total = allNodes.length;
  let processed = 0;

  const renderedBounds: Record<string, RenderedBounds> = {};
  const variantProperties: Record<string, Record<string, string>> = {};
  const assetFiles: AssetFile[] = [];
  const assetFileNames: string[] = [];
  // Track which nodes were already exported (avoid duplicate entries)
  const exportedNodeIds = new Set<string>();

  // Node types that should be exported as SVG (pure vector shapes)
  const SVG_TYPES = new Set<string>([
    'VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'POLYGON', 'LINE', 'ELLIPSE',
  ]);

  for (const node of allNodes) {
    processed++;
    if (processed % 50 === 0) {
      figma.ui.postMessage({ type: 'progress', current: processed, total });
    }

    // Capture actual rendered geometry (includes text wrap, effect bounds)
    const rb = node.absoluteRenderBounds;
    if (rb) {
      renderedBounds[node.id] = { x: rb.x, y: rb.y, width: rb.width, height: rb.height };
    }

    // Export image fills as PNG @2x bytes
    if ('fills' in node) {
      const fills = (node as GeometryMixin).fills as ReadonlyArray<Paint>;
      if (Array.isArray(fills) && fills.some((f) => f.type === 'IMAGE' && f.visible !== false)) {
        try {
          const bytes = await (node as ExportMixin).exportAsync({
            format: 'PNG',
            constraint: { type: 'SCALE', value: 2 },
          });
          const fileName = `${node.id.replace(/:/g, '_')}.png`;
          assetFiles.push({ nodeId: node.id, fileName, bytes: Array.from(bytes) });
          assetFileNames.push(fileName);
          exportedNodeIds.add(node.id);
        } catch {
          // Non-fatal — node may not be renderable
        }
      }
    }

    // Export vector shape nodes as SVG (icons, arrows, illustrations)
    if (SVG_TYPES.has(node.type) && !exportedNodeIds.has(node.id)) {
      try {
        const bytes = await (node as ExportMixin).exportAsync({ format: 'SVG' });
        const fileName = `${node.id.replace(/:/g, '_')}.svg`;
        assetFiles.push({ nodeId: node.id, fileName, bytes: Array.from(bytes) });
        assetFileNames.push(fileName);
        exportedNodeIds.add(node.id);
      } catch {
        // Non-fatal
      }
    }

    // Capture variant properties for component nodes
    if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
      const props = (node as ComponentNode).variantProperties;
      if (props) variantProperties[node.id] = props;
    }
  }

  // Build the JSON payload (figma-export.json inside the ZIP)
  const exportJson = {
    fileKey:        figma.fileKey ?? 'unknown',
    fileName:       figma.root.name,
    exportedAt:     new Date().toISOString(),
    pluginVersion:  '1.0.0',
    renderedBounds,
    variantProperties,
    assetFileNames,
  };

  figma.ui.postMessage({
    type:       'done',
    exportJson,
    assetFiles,
    screenCount: page.children.filter((n) => n.type === 'FRAME').length,
  });
};
