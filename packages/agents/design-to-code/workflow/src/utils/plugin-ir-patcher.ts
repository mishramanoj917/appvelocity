/**
 * plugin-ir-patcher — post-process the DesignIR with Figma Plugin export data.
 *
 * The Figma REST API provides absoluteBoundingBox which is the layout box before
 * text wrapping, effect bounds, and overflow. The plugin exports absoluteRenderBounds
 * which is the ACTUAL rendered geometry. This patcher overlays those values onto the IR.
 *
 * Two passes:
 *   1. applyPluginRenderedBounds — override layout.height for text/image nodes
 *   2. applyPluginAssetPaths     — set image.src to local PNG paths (no CDN expiry)
 */

import type { DesignIR, IRElement, IRScreen, IRComponent } from '@appvelocity/agent-design-to-code-core';
import type { PluginRenderedBounds } from '../agent-memory.js';

/**
 * Walks every element in the IR and overrides layout.width/height with the
 * plugin's rendered bounds for text and image nodes where it matters most.
 *
 * Returns the number of nodes that were patched.
 */
export function applyPluginRenderedBounds(
  ir: DesignIR,
  renderedBounds: Record<string, PluginRenderedBounds>
): number {
  let patched = 0;

  const patchElement = (el: IRElement): void => {
    const rb = renderedBounds[el.id];
    if (rb) {
      if (el.type === 'text') {
        // Text nodes: use rendered height (post-wrap) — width stays from layout box
        if (typeof el.layout.height === 'number' && Math.abs(el.layout.height - rb.height) > 2) {
          el.layout.height = Math.round(rb.height);
          patched++;
        }
      } else if (el.type === 'image' || el.type === 'imagebackground' || el.type === 'icon') {
        // Image nodes: use rendered dimensions (may include shadow bleed)
        if (typeof el.layout.width === 'number' && Math.abs(el.layout.width - rb.width) > 2) {
          el.layout.width = Math.round(rb.width);
          patched++;
        }
        if (typeof el.layout.height === 'number' && Math.abs(el.layout.height - rb.height) > 2) {
          el.layout.height = Math.round(rb.height);
          patched++;
        }
      }
    }
    for (const child of el.children) patchElement(child);
  };

  const patchScreen = (screen: IRScreen): void => patchElement(screen.root);
  const patchComponent = (comp: IRComponent): void => {
    patchElement(comp.defaultVariant);
    comp.variants.forEach((v) => patchElement(v.root));
  };

  ir.screens.forEach(patchScreen);
  ir.components.forEach(patchComponent);
  return patched;
}

/**
 * For each IR asset that has a matching local PNG path from the plugin export,
 * set asset.url to the local file URI so the code generator uses it instead of
 * fetching a CDN URL (which may have expired).
 *
 * Returns the number of assets patched.
 */
export function applyPluginAssetPaths(
  ir: DesignIR,
  assetPaths: Record<string, string>
): number {
  let patched = 0;
  for (const asset of ir.assets) {
    const localPath = assetPaths[asset.nodeId];
    if (localPath) {
      asset.url = `file://${localPath}`;
      patched++;
    }
  }
  return patched;
}
