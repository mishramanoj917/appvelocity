/**
 * Node 3 — FigmaFetcherAgent
 * Fetches the Figma file and design variables using the FigmaClient.
 */

import { FigmaClient, parseFigmaUrl } from '@appvelocity/agent-design-to-code-core';
import { makeLogEntry } from '../utils/logger.js';
import type { WorkflowState } from '../types.js';

export async function figmaFetcherAgent(
  state: WorkflowState
): Promise<Partial<WorkflowState>> {
  const client = new FigmaClient({
    accessToken: process.env.FIGMA_ACCESS_TOKEN!,
    rateLimitPerMinute: 60,
  });

  const { fileKey } = parseFigmaUrl(state.figmaUrl);

  const [figmaFile, variablesResponse] = await Promise.all([
    client.getFile(fileKey),
    client.getLocalVariables(fileKey).catch(() => undefined),
  ]);

  const logs = [
    makeLogEntry(
      'success',
      `Fetched Figma file: "${figmaFile.name}" (${figmaFile.document.children?.length ?? 0} pages)`
    ),
  ];

  if (variablesResponse) {
    logs.push(
      makeLogEntry(
        'info',
        `Found ${Object.keys(variablesResponse.meta.variables).length} design tokens`
      )
    );
  }

  return {
    figmaFile,
    ...(variablesResponse ? { variablesResponse } : {}),
    currentStep: 'FigmaFetcherAgent',
    logs,
  };
}
