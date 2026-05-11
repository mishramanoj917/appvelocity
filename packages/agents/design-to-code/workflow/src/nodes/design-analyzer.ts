/**
 * Node 3 — DesignAnalyzerAgent (Vision / Parser)
 *
 * Exports each screen as a PNG via the Figma Image API, then sends the PNG
 * (base64) + the screen's Figma JSON subtree to a vision-capable LLM to:
 *   - Detect the spacing grid (4pt or 8pt)
 *   - Override flex-direction hints where visual layout differs from JSON
 *   - Confirm which VECTOR nodes are true icons (vs decorative shapes)
 *   - Identify IMAGE fill nodes for hi-res asset export
 *   - Collect font families and colour palette
 *
 * Asset extraction:
 *   - Icon nodes → SVG export via Figma API
 *   - Image nodes → PNG export via Figma API (2x scale)
 *
 * This step is NON-FATAL: if the vision LLM or Figma export fails, the node
 * logs a warning and sets visualAnalysis = null so downstream nodes degrade
 * gracefully rather than blocking the whole pipeline.
 *
 * Input state:  figmaFile, figmaUrl
 * Output state: visualAnalysis, currentStep, logs
 */

import { FigmaClient, parseFigmaUrl } from '@appvelocity/agent-design-to-code-core';
import { createLLMClient } from '../utils/llm-client.js';
import { makeLogEntry } from '../utils/logger.js';
import { parseJsonResponse } from '../utils/parse-json.js';
import type { WorkflowState, VisualAnalysis, LayoutHint, LogEntry } from '../types.js';
import type { FigmaNode } from '@appvelocity/agent-design-to-code-core';

// Maximum screens to analyse with vision (cost/latency cap)
const MAX_VISION_SCREENS = 6;

// ─── Raw LLM response shape ───────────────────────────────────────────────────

interface ScreenAnalysis {
  spacingUnit: number;
  layoutHints: LayoutHint[];
  iconNodeIds: string[];
  imageNodeIds: string[];
  fontFamilies: string[];
  colorPalette: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function collectScreenNodes(figmaFile: WorkflowState['figmaFile']): FigmaNode[] {
  if (!figmaFile) return [];
  const screens: FigmaNode[] = [];
  for (const page of figmaFile.document.children ?? []) {
    for (const node of page.children ?? []) {
      if (node.type === 'FRAME' && node.visible !== false) {
        const w = node.absoluteBoundingBox?.width ?? 0;
        if (w <= 600) screens.push(node);
      }
    }
  }
  return screens.slice(0, MAX_VISION_SCREENS);
}

function buildVisionPrompt(screenJson: string): string {
  return `You are a mobile UI design analyst. Analyse the Figma screen layout shown in the image and the JSON description below.

Return ONLY a valid JSON object matching this exact schema:
{
  "spacingUnit": <4 or 8>,
  "layoutHints": [
    { "nodeId": "<id>", "direction": "row" | "column", "scrollable": true | false }
  ],
  "iconNodeIds": ["<figma-node-id>", ...],
  "imageNodeIds": ["<figma-node-id>", ...],
  "fontFamilies": ["<font-name>", ...],
  "colorPalette": ["#hex", ...]
}

Rules:
- spacingUnit: Determine whether the design uses a 4pt or 8pt grid based on spacing values in the JSON.
- layoutHints: Only include nodes where you can visually confirm the flex direction from the screenshot differs from what the JSON node names imply, or where scrollability is evident from the design.
- iconNodeIds: Only include VECTOR or INSTANCE nodes that are clearly icons (symbols, glyphs, pictograms). Exclude decorative shapes, dividers, and background elements.
- imageNodeIds: Include nodes with IMAGE fills that contain actual photos or illustrations.
- fontFamilies: List distinct font family names visible in the design.
- colorPalette: List the 6-10 most prominent hex colours.

Figma JSON for this screen:
${screenJson}`;
}

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return `data:image/png;base64,${Buffer.from(buf).toString('base64')}`;
  } catch {
    return null;
  }
}

function median(nums: number[]): number {
  if (nums.length === 0) return 8;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[mid - 1] ?? 8) + (sorted[mid] ?? 8)) / 2)
    : (sorted[mid] ?? 8);
}

// ─── Node ─────────────────────────────────────────────────────────────────────

export async function designAnalyzerAgent(
  state: WorkflowState
): Promise<Partial<WorkflowState>> {
  const logs: LogEntry[] = [];
  const warn = (msg: string) => logs.push(makeLogEntry('warning', msg));

  if (!state.figmaFile) {
    warn('[DesignAnalyzer] No Figma file in state — skipping visual analysis');
    return { visualAnalysis: undefined, currentStep: 'DesignAnalyzerAgent', logs };
  }

  const { fileKey } = parseFigmaUrl(state.figmaUrl);
  const accessToken = state.figmaAccessToken || (process.env['FIGMA_ACCESS_TOKEN'] ?? '');
  const client = new FigmaClient({ accessToken });

  const screens = collectScreenNodes(state.figmaFile);
  if (screens.length === 0) {
    warn('[DesignAnalyzer] No mobile screens found — skipping visual analysis');
    return { visualAnalysis: undefined, currentStep: 'DesignAnalyzerAgent', logs };
  }

  logs.push(makeLogEntry('info', `[DesignAnalyzer] Analysing ${screens.length} screens with vision LLM`));

  // 1. Export screens as PNG — returns FigmaImagesResponse { images: Record<string, string|null> }
  const screenNodeIds = screens.map((s) => s.id);
  let screenshotImages: Record<string, string | null> = {};
  try {
    const response = await client.getImageExports(fileKey, screenNodeIds, {
      format: 'png',
      scale: 1,
    } as Parameters<typeof client.getImageExports>[2]);
    screenshotImages = response.images;
  } catch (err) {
    warn(`[DesignAnalyzer] Figma PNG export failed: ${err instanceof Error ? err.message : String(err)}. Continuing without visual analysis.`);
    return { visualAnalysis: undefined, currentStep: 'DesignAnalyzerAgent', logs };
  }

  // 2. Run vision LLM for each screen in parallel
  const llm = createLLMClient();
  const visionModel = process.env['VISION_MODEL'] ?? 'claude-sonnet-4';

  const analysisResults = await Promise.all(
    screens.map(async (screen): Promise<ScreenAnalysis | null> => {
      const url = screenshotImages[screen.id];
      if (!url) return null;

      const base64 = await fetchImageAsBase64(url);
      if (!base64) return null;

      const screenJson = JSON.stringify({
        id: screen.id,
        name: screen.name,
        type: screen.type,
        children: (screen.children ?? []).slice(0, 30), // cap JSON size
      }, null, 0);

      try {
        const response = await llm.chat({
          model: visionModel,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: base64 } },
                { type: 'text', text: buildVisionPrompt(screenJson) },
              ],
            },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 2048,
        });
        return parseJsonResponse<ScreenAnalysis>(response.content);
      } catch {
        return null;
      }
    })
  );

  // 3. Merge results across all screens
  const validResults = analysisResults.filter((r): r is ScreenAnalysis => r !== null);

  if (validResults.length === 0) {
    warn('[DesignAnalyzer] Vision LLM returned no results — continuing without visual analysis');
    return { visualAnalysis: undefined, currentStep: 'DesignAnalyzerAgent', logs };
  }

  const spacingUnit = median(validResults.map((r) => r.spacingUnit).filter((n) => n === 4 || n === 8));
  const layoutHints = validResults.flatMap((r) => r.layoutHints);
  const iconNodeIds = [...new Set(validResults.flatMap((r) => r.iconNodeIds))];
  const imageNodeIds = [...new Set(validResults.flatMap((r) => r.imageNodeIds))];
  const fontFamilies = [...new Set(validResults.flatMap((r) => r.fontFamilies))];
  const colorPalette = [...new Set(validResults.flatMap((r) => r.colorPalette))];

  // 4. Export confirmed icon nodes as SVG and image nodes as PNG — store CDN URLs in state
  let iconUrls: Record<string, string> = {};
  let imageUrls: Record<string, string> = {};

  if (iconNodeIds.length > 0 || imageNodeIds.length > 0) {
    try {
      if (iconNodeIds.length > 0) {
        const svgResponse = await client.getImageExports(
          fileKey,
          iconNodeIds.slice(0, 20),
          { format: 'svg' } as Parameters<typeof client.getImageExports>[2]
        );
        iconUrls = Object.fromEntries(
          Object.entries(svgResponse.images).filter((e): e is [string, string] => e[1] !== null)
        );
      }
      if (imageNodeIds.length > 0) {
        const pngResponse = await client.getImageExports(
          fileKey,
          imageNodeIds.slice(0, 20),
          { format: 'png', scale: 2 } as Parameters<typeof client.getImageExports>[2]
        );
        imageUrls = Object.fromEntries(
          Object.entries(pngResponse.images).filter((e): e is [string, string] => e[1] !== null)
        );
      }
    } catch {
      warn('[DesignAnalyzer] Asset export partially failed — CDN URLs may be missing for some assets');
    }
  }

  const visualAnalysis: VisualAnalysis = {
    spacingUnit,
    layoutHints,
    iconNodeIds,
    imageNodeIds,
    fontFamilies,
    colorPalette,
    iconUrls,
    imageUrls,
  };

  logs.push(makeLogEntry('success',
    `[DesignAnalyzer] Analysis complete: spacingUnit=${spacingUnit}, ` +
    `${iconNodeIds.length} icons, ${imageNodeIds.length} images, ` +
    `${layoutHints.length} layout hints`
  ));

  return { visualAnalysis, currentStep: 'DesignAnalyzerAgent', logs };
}
