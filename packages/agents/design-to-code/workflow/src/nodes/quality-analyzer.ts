/**
 * Design Quality Analyzer
 *
 * Pure-computation engine — no LLM calls, no I/O.
 * Walks the FigmaFile tree and scores 5 quality dimensions to produce
 * a DesignQualityReport with issue highlights and actionable suggestions.
 *
 * Inputs:
 *   figmaFile        — required; the raw Figma REST API response
 *   variablesResponse — optional; Figma Variables (design tokens)
 *   visualAnalysis   — optional; spacing unit + font families from vision LLM
 *   designIR         — optional; built IR with token counts and warnings
 */

import type { FigmaFile, FigmaNode, FigmaPaint, DesignIR, FigmaVariablesResponse } from '@appvelocity/agent-design-to-code-core';
import type { VisualAnalysis, DesignQualityReport, DesignIssue, QualitySuggestion, IssueCategory } from '../types.js';

// ─── Internal accumulator ─────────────────────────────────────────────────────

interface RawStats {
  totalNodes: number;
  frameNodes: number;
  framesWithAutoLayout: number;
  instanceNodes: number;
  leafNodes: number;
  wellNamedNodes: number;
  poorlyNamedNodes: number;
  poorlyNamedNodeIds: string[];
  solidFillColors: Set<string>;
  fontCombos: Set<string>;
  screenWidths: number[];
}

// ─── Tree walk ────────────────────────────────────────────────────────────────

const GENERIC_NAME_RE = /^(Frame|Rectangle|Group|Ellipse|Vector|Line|Polygon|Star|Text|Layer|Component|Section)\s*\d*$/i;

function figmaColorToHex(color: { r: number; g: number; b: number; a?: number }): string {
  const r = Math.round(color.r * 255).toString(16).padStart(2, '0');
  const g = Math.round(color.g * 255).toString(16).padStart(2, '0');
  const b = Math.round(color.b * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

function walkNode(node: FigmaNode, stats: RawStats, depth: number): void {
  // Skip document/page nodes from naming and content scoring
  if (node.type === 'DOCUMENT' || node.type === 'CANVAS') {
    for (const child of node.children ?? []) walkNode(child, stats, depth + 1);
    return;
  }

  stats.totalNodes++;

  // Naming quality — skip COMPONENT_SET containers (internal Figma grouping)
  if (node.type !== 'COMPONENT_SET') {
    if (GENERIC_NAME_RE.test(node.name.trim())) {
      stats.poorlyNamedNodes++;
      if (stats.poorlyNamedNodeIds.length < 50) stats.poorlyNamedNodeIds.push(node.id);
    } else {
      stats.wellNamedNodes++;
    }
  }

  // Frame auto-layout — exclude COMPONENT_SET (always has layout defined)
  if (node.type === 'FRAME' || node.type === 'COMPONENT') {
    stats.frameNodes++;
    if (node.layoutMode && node.layoutMode !== 'NONE') {
      stats.framesWithAutoLayout++;
    }
  }

  if (node.type === 'INSTANCE') {
    stats.instanceNodes++;
  }

  // Collect inline SOLID fill colours (skip white and transparent)
  for (const fill of (node.fills as FigmaPaint[] | undefined) ?? []) {
    if (fill.type === 'SOLID' && fill.visible !== false && fill.color) {
      if ((fill.color.a ?? 1) < 0.05) continue; // transparent
      const hex = figmaColorToHex(fill.color);
      if (hex === '#ffffff' || hex === '#ffffffff') continue; // pure white
      stats.solidFillColors.add(hex);
    }
  }

  // Collect font combos from TEXT nodes
  if (node.type === 'TEXT' && node.style) {
    const family = node.style.fontFamily ?? 'unknown';
    const size   = node.style.fontSize   ?? 0;
    stats.fontCombos.add(`${family}|${size}`);
  }

  // Count leaf nodes (non-text, non-vector leaves — for component reuse denominator)
  const isLeaf = !node.children || node.children.length === 0;
  const isContentNode = !['TEXT', 'VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'LINE',
    'ELLIPSE', 'REGULAR_POLYGON'].includes(node.type);
  if (isLeaf && isContentNode) {
    stats.leafNodes++;
  }

  // Screen widths — top-level FRAME children of pages (depth 2)
  if (depth === 2 && node.type === 'FRAME') {
    const w = node.absoluteBoundingBox?.width;
    if (w) stats.screenWidths.push(w);
  }

  for (const child of node.children ?? []) walkNode(child, stats, depth + 1);
}

// ─── Dimension scoring ────────────────────────────────────────────────────────

function scoreTokenCoverage(
  ir: DesignIR | undefined,
  variablesResponse: FigmaVariablesResponse | undefined
): number {
  const variableCount = variablesResponse
    ? Object.keys(variablesResponse.meta.variables).length
    : 0;

  if (variableCount === 0) {
    if (ir?.warnings.some((w) => w.code === 'NO_TOKENS'))       return 0;
    if (ir?.warnings.some((w) => w.code === 'TOKENS_INFERRED')) return 20;
    return 0;
  }

  if (variableCount < 5)  return 40;
  if (variableCount < 20) return 60;
  if (variableCount < 50) return 80;
  return 100;
}

function scoreAutoLayoutCoverage(stats: RawStats, ir: DesignIR | undefined): number {
  if (stats.frameNodes === 0) return 100;
  const ratio     = stats.framesWithAutoLayout / stats.frameNodes;
  const baseScore = Math.round(ratio * 100);
  const penalty   = ir?.warnings.some((w) => w.code === 'LAYOUT_RECONSTRUCTED') ? 20 : 0;
  return Math.max(0, baseScore - penalty);
}

function scoreComponentReuse(stats: RawStats): number {
  const denominator = stats.instanceNodes + stats.leafNodes;
  if (denominator === 0) return 50;
  return Math.round((stats.instanceNodes / denominator) * 100);
}

function scoreNamingQuality(stats: RawStats): number {
  if (stats.totalNodes === 0) return 100;
  return Math.round((stats.wellNamedNodes / stats.totalNodes) * 100);
}

function scoreStyleConsistency(stats: RawStats, visualAnalysis: VisualAnalysis | undefined): number {
  const colorCount = stats.solidFillColors.size;
  let colorScore: number;
  if      (colorCount <= 5)  colorScore = 100;
  else if (colorCount <= 10) colorScore = 80;
  else if (colorCount <= 20) colorScore = 60;
  else if (colorCount <= 40) colorScore = 40;
  else                       colorScore = 20;

  const comboCount = stats.fontCombos.size;
  let typographyScore: number;
  if      (comboCount <= 3)  typographyScore = 100;
  else if (comboCount <= 5)  typographyScore = 80;
  else if (comboCount <= 8)  typographyScore = 60;
  else if (comboCount <= 12) typographyScore = 40;
  else                       typographyScore = 20;

  const fontFamilyCount = visualAnalysis?.fontFamilies.length ?? 1;
  const fontFamilyPenalty = Math.max(0, (fontFamilyCount - 2) * 10);

  return Math.max(0, Math.round((colorScore + typographyScore) / 2) - fontFamilyPenalty);
}

function computeOverallScore(dims: DesignQualityReport['dimensions']): number {
  return Math.round(
    dims.tokenCoverage.score      * 0.25 +
    dims.autoLayoutCoverage.score * 0.25 +
    dims.componentReuse.score     * 0.20 +
    dims.namingQuality.score      * 0.15 +
    dims.styleConsistency.score   * 0.15
  );
}

function computeGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

// ─── Issue generation ─────────────────────────────────────────────────────────

function generateIssues(
  stats: RawStats,
  ir: DesignIR | undefined,
  variablesResponse: FigmaVariablesResponse | undefined
): DesignIssue[] {
  const issues: DesignIssue[] = [];
  const tokenCount    = ir?.meta.stats.tokenCount ?? 0;
  const variableCount = variablesResponse ? Object.keys(variablesResponse.meta.variables).length : 0;

  // CRITICAL: no design tokens
  if (tokenCount === 0 && variableCount === 0) {
    issues.push({
      id: 'missing-design-tokens',
      category: 'missing-design-tokens',
      severity: 'critical',
      title: 'No Design Tokens Found',
      description: 'Your design uses no Figma Variables or Styles. Every colour, font, and spacing value is hardcoded inline.',
      impact: 'Generated code will contain magic numbers and hex literals, making theming and design system updates extremely difficult.',
      suggestion: 'Open the Resources panel → Libraries → create a local colour and typography library, then apply styles to all elements.',
      affectedCount: stats.totalNodes,
    });
  }

  // CRITICAL: hardcoded colours
  if (stats.solidFillColors.size > 10) {
    issues.push({
      id: 'hardcoded-colors',
      category: 'hardcoded-colors',
      severity: 'critical',
      title: `${stats.solidFillColors.size} Unique Hardcoded Colours`,
      description: `${stats.solidFillColors.size} distinct inline fill colours were detected, none mapped to a token.`,
      impact: 'Generated code uses raw hex values. Implementing dark mode or a rebrand requires touching every component individually.',
      suggestion: 'Select all elements with a given colour → right-click fill → "Create Style". Use Edit → Find and Replace Color to apply systematically.',
      affectedCount: stats.solidFillColors.size,
    });
  }

  // CRITICAL: absolute positioning
  if (stats.frameNodes > 0) {
    const absoluteCount = stats.frameNodes - stats.framesWithAutoLayout;
    const absoluteRatio = absoluteCount / stats.frameNodes;
    if (absoluteRatio > 0.3) {
      issues.push({
        id: 'absolute-positioning',
        category: 'absolute-positioning',
        severity: 'critical',
        title: `${Math.round(absoluteRatio * 100)}% of Frames Use Absolute Positioning`,
        description: `${absoluteCount} out of ${stats.frameNodes} frames lack Auto Layout. Children are positioned with absolute coordinates.`,
        impact: 'Generated code uses hardcoded position values. Layouts will break on different screen sizes and when content length changes.',
        suggestion: 'Select problematic frames → press Shift+A to add Auto Layout → adjust gap and padding in the design panel.',
        affectedCount: absoluteCount,
      });
    }
  }

  // WARNING: low component reuse
  const denominator = stats.instanceNodes + stats.leafNodes;
  if (denominator > 0) {
    const reuseRate = stats.instanceNodes / denominator;
    if (reuseRate < 0.2) {
      issues.push({
        id: 'low-component-reuse',
        category: 'low-component-reuse',
        severity: 'warning',
        title: `Low Component Reuse (${Math.round(reuseRate * 100)}%)`,
        description: 'Less than 20% of elements are Component Instances from a shared library.',
        impact: 'Generated code duplicates UI patterns. Maintaining consistency across screens becomes increasingly difficult.',
        suggestion: 'Identify repeated UI patterns (buttons, cards, list items) → right-click → Create component (Ctrl+Alt+K) → replace occurrences with instances.',
        affectedCount: stats.leafNodes,
      });
    }
  }

  // WARNING: inconsistent typography
  if (stats.fontCombos.size > 5) {
    issues.push({
      id: 'inconsistent-typography',
      category: 'inconsistent-typography',
      severity: 'warning',
      title: `${stats.fontCombos.size} Unique Typography Combinations`,
      description: `The design uses ${stats.fontCombos.size} unique font-family × font-size combinations. A well-structured type scale typically uses 3–5.`,
      impact: 'Generated code defines many one-off text styles. Heading hierarchy becomes inconsistent across screens.',
      suggestion: 'Define a type scale (Display, H1, H2, Body, Caption) as Figma Text Styles and apply uniformly to all text nodes.',
      affectedCount: stats.fontCombos.size,
    });
  }

  // WARNING: poor naming
  if (stats.totalNodes > 0) {
    const poorRatio = stats.poorlyNamedNodes / stats.totalNodes;
    if (poorRatio > 0.3) {
      issues.push({
        id: 'poor-naming',
        category: 'poor-naming',
        severity: 'warning',
        title: `${Math.round(poorRatio * 100)}% of Nodes Have Generic Names`,
        description: `${stats.poorlyNamedNodes} nodes use default names like "Frame 1", "Rectangle 3", or "Group 7".`,
        impact: 'Generated component and variable names will be non-descriptive (e.g., Frame1). Code review and maintenance become significantly harder.',
        suggestion: 'Select layers → press Ctrl+R to rename, or use the "Rename It" plugin for bulk renaming. Follow a convention like "card/product-card".',
        affectedCount: stats.poorlyNamedNodes,
        nodeIds: stats.poorlyNamedNodeIds,
      });
    }
  }

  // INFO: non-standard screen size
  const STANDARD_WIDTHS = new Set([375, 390, 393, 414, 430, 360]);
  const nonStandardScreens = stats.screenWidths.filter((w) => !STANDARD_WIDTHS.has(Math.round(w)));
  if (nonStandardScreens.length > 0) {
    const uniqueNonStd = [...new Set(nonStandardScreens.map(Math.round))];
    issues.push({
      id: 'non-standard-screen-size',
      category: 'non-standard-screen-size',
      severity: 'info',
      title: 'Non-Standard Screen Dimensions',
      description: `${nonStandardScreens.length} screen(s) use widths (${uniqueNonStd.join(', ')}px) that differ from common mobile standards (375, 390, 414, 360px).`,
      impact: 'Generated code may need responsive adjustments to display correctly on real devices.',
      suggestion: 'Resize screen frames to 390px (iPhone 14 Pro) or 360px (Android standard) width.',
      affectedCount: nonStandardScreens.length,
    });
  }

  // INFO: missing spacing tokens (when colour tokens exist but spacing does not)
  if (variableCount > 0 && ir) {
    const spacingTokenCount = Object.keys(ir.tokens.spacing ?? {}).length;
    if (spacingTokenCount === 0) {
      issues.push({
        id: 'missing-spacing-tokens',
        category: 'missing-spacing-tokens',
        severity: 'info',
        title: 'No Spacing Tokens Defined',
        description: 'Colour tokens are present but no spacing Variables were found.',
        impact: 'Generated code uses numeric spacing literals. Layout consistency depends on developers memorising magic numbers.',
        suggestion: 'Create a "spacing" variable collection in Figma Variables: xs=4, sm=8, md=16, lg=24, xl=32.',
        affectedCount: 0,
      });
    }
  }

  // INFO: status bar included
  const statusBarWarning = ir?.warnings.find((w) => w.code === 'STATUS_BAR_FILTERED');
  if (statusBarWarning) {
    issues.push({
      id: 'status-bar-included',
      category: 'status-bar-included',
      severity: 'info',
      title: 'System UI Elements Detected',
      description: `${statusBarWarning.nodeCount ?? 1} system UI element(s) (status bar, battery, WiFi indicator) were found and automatically filtered.`,
      impact: 'These elements are rendered by the OS; including them in the design causes duplicate UI in the generated app.',
      suggestion: 'Move status bar elements to a separate "System UI" page or wrap them in a non-exportable frame.',
      affectedCount: statusBarWarning.nodeCount ?? 1,
    });
  }

  const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const;
  return issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

// ─── Suggestion generation ────────────────────────────────────────────────────

const ISSUE_SUGGESTION_MAP: Record<IssueCategory, { title: string; steps: string[]; delta: number }> = {
  'missing-design-tokens': {
    title: 'Publish Colour and Typography Styles',
    steps: [
      'Select unique colours in your design',
      'Right-click any fill → "Create Style" → name it (e.g. "Primary/500")',
      'Repeat for typography: select text → "Create Text Style"',
      'Use Edit → Find and Replace Color to apply styles to all elements',
    ],
    delta: 25,
  },
  'absolute-positioning': {
    title: 'Add Auto Layout to Key Screens',
    steps: [
      'Select frames with the most children first (cards, list rows, headers)',
      'Press Shift+A to add Auto Layout',
      'Set gap to match your spacing unit (8pt or 16pt)',
      'Set padding on all sides (16pt for screen edges)',
      'Delete any manually positioned spacer elements',
    ],
    delta: 20,
  },
  'hardcoded-colors': {
    title: 'Replace Inline Colours with Styles',
    steps: [
      'Go to Edit → Find and Replace → filter by fill colour',
      'For each unique colour, create a named Style',
      'Use "Select All with Same Fill" to bulk-replace',
      'Verify replacements in the Inspect panel',
    ],
    delta: 15,
  },
  'low-component-reuse': {
    title: 'Extract Repeated Patterns as Components',
    steps: [
      'Identify the most repeated UI pattern (buttons, cards, list items)',
      'Select an instance → right-click → Create component (Ctrl+Alt+K)',
      'Replace all identical elements with instances of the new component',
      'Repeat for navigation bars, headers, and input fields',
    ],
    delta: 12,
  },
  'poor-naming': {
    title: 'Rename Generic Layers',
    steps: [
      'Install the "Rename It" Figma plugin',
      'Select all frames (Ctrl+A on a page) → run Rename It',
      'Use kebab-case or PascalCase naming that matches your code style',
      'Prioritise top-level screens and reusable component frames',
    ],
    delta: 8,
  },
  'inconsistent-typography': {
    title: 'Define a Type Scale as Text Styles',
    steps: [
      'Decide on 4–5 text sizes: Display 32, H1 24, H2 20, Body 16, Caption 12',
      'Create Text Styles for each via the Styles panel → + New',
      'Apply styles to all text nodes using Find/Replace',
    ],
    delta: 6,
  },
  'non-standard-screen-size': {
    title: 'Resize Screens to Standard Mobile Dimensions',
    steps: [
      'Select screen frames → set width to 390px (iPhone 14) or 360px (Android)',
      'Check "Scale with frame" to resize content proportionally',
      'Adjust any manually positioned elements after resize',
    ],
    delta: 4,
  },
  'missing-spacing-tokens': {
    title: 'Create a Spacing Variable Collection',
    steps: [
      'Open the Local Variables panel → create collection named "Spacing"',
      'Add variables: xs=4, sm=8, md=16, lg=24, xl=32, 2xl=48',
      'Apply to Auto Layout gap and padding fields',
    ],
    delta: 4,
  },
  'status-bar-included': {
    title: 'Isolate System UI in a Separate Page',
    steps: [
      'Select all status bar layers',
      'Move to a dedicated "System UI / Not for export" page',
      'Add an annotation frame explaining these are OS-rendered elements',
    ],
    delta: 2,
  },
};

function generateSuggestions(issues: DesignIssue[]): QualitySuggestion[] {
  return issues.slice(0, 5).map((issue, i) => {
    const template = ISSUE_SUGGESTION_MAP[issue.category];
    return {
      priority: (i + 1) as 1 | 2 | 3 | 4 | 5,
      title: template.title,
      steps: template.steps,
      scoreDelta: template.delta,
    };
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function analyzeDesignQuality(
  figmaFile: FigmaFile,
  variablesResponse?: FigmaVariablesResponse,
  visualAnalysis?: VisualAnalysis,
  designIR?: DesignIR
): DesignQualityReport {
  // 1. Tree walk
  const stats: RawStats = {
    totalNodes: 0,
    frameNodes: 0,
    framesWithAutoLayout: 0,
    instanceNodes: 0,
    leafNodes: 0,
    wellNamedNodes: 0,
    poorlyNamedNodes: 0,
    poorlyNamedNodeIds: [],
    solidFillColors: new Set(),
    fontCombos: new Set(),
    screenWidths: [],
  };
  walkNode(figmaFile.document as unknown as FigmaNode, stats, 0);

  // 2. Score dimensions
  const tokenScore       = scoreTokenCoverage(designIR, variablesResponse);
  const autoLayoutScore  = scoreAutoLayoutCoverage(stats, designIR);
  const reuseScore       = scoreComponentReuse(stats);
  const namingScore      = scoreNamingQuality(stats);
  const consistencyScore = scoreStyleConsistency(stats, visualAnalysis);

  const dimensions: DesignQualityReport['dimensions'] = {
    tokenCoverage:      { score: tokenScore,       weight: 25, label: 'Token Coverage' },
    autoLayoutCoverage: { score: autoLayoutScore,  weight: 25, label: 'Auto Layout Coverage' },
    componentReuse:     { score: reuseScore,        weight: 20, label: 'Component Reuse' },
    namingQuality:      { score: namingScore,       weight: 15, label: 'Naming Quality' },
    styleConsistency:   { score: consistencyScore,  weight: 15, label: 'Style Consistency' },
  };

  // 3. Overall score + grade
  const irScore = computeOverallScore(dimensions);
  const grade   = computeGrade(irScore);

  // 4. Issues
  const issues = generateIssues(stats, designIR, variablesResponse);

  // 5. Suggestions (top 5 from issues)
  const suggestions = generateSuggestions(issues);

  // 6. Aggregate stats
  const inferredFonts = [...new Set([...stats.fontCombos].map((c) => c.split('|')[0] ?? 'unknown'))];

  return {
    irScore,
    grade,
    dimensions,
    issues,
    suggestions,
    stats: {
      screenCount:          designIR?.meta.stats.screenCount    ?? stats.screenWidths.length,
      componentCount:       designIR?.meta.stats.componentCount ?? 0,
      tokenCount:           designIR?.meta.stats.tokenCount     ?? 0,
      instanceCount:        stats.instanceNodes,
      totalNodes:           stats.totalNodes,
      uniqueColors:         stats.solidFillColors.size,
      uniqueFontCombos:     stats.fontCombos.size,
      framesWithAutoLayout: stats.framesWithAutoLayout,
      totalFrames:          stats.frameNodes,
      wellNamedNodes:       stats.wellNamedNodes,
      poorlyNamedNodes:     stats.poorlyNamedNodes,
      spacingUnit:          visualAnalysis
                              ? (visualAnalysis.spacingUnit === 4 ? 4 : visualAnalysis.spacingUnit === 8 ? 8 : null)
                              : null,
      fontFamilies: visualAnalysis?.fontFamilies ?? inferredFonts,
    },
    figmaFileName:     figmaFile.name,
    analysisTimestamp: new Date().toISOString(),
  };
}
