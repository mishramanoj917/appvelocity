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
  const token = state.figmaAccessToken || process.env['FIGMA_ACCESS_TOKEN'];
  if (!token) {
    return {
      currentStep: 'FigmaFetcherAgent',
      errors: [{
        code: 'MISSING_TOKEN',
        message: 'FIGMA_ACCESS_TOKEN is not set. Enter it in the Settings modal or add it to your .env file.',
        recoverable: false,
      }],
      logs: [makeLogEntry('error', 'FIGMA_ACCESS_TOKEN is missing (checked UI params and environment).')],
    };
  }

  const client = new FigmaClient({
    accessToken: token,
    rateLimitPerMinute: 60,
  });

  const { fileKey } = parseFigmaUrl(state.figmaUrl);

  let figmaFile: Awaited<ReturnType<typeof client.getFile>>;
  let variablesResponse: Awaited<ReturnType<typeof client.getLocalVariables>> | undefined;
  try {
    [figmaFile, variablesResponse] = await Promise.all([
      client.getFile(fileKey),
      client.getLocalVariables(fileKey).catch(() => undefined),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isAuth = msg.toLowerCase().includes('401') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('forbidden');
    return {
      currentStep: 'FigmaFetcherAgent',
      errors: [{
        code: isAuth ? 'FIGMA_AUTH_ERROR' : 'FIGMA_API_ERROR',
        message: isAuth
          ? `Figma authentication failed. Verify FIGMA_ACCESS_TOKEN is valid and has access to this file. (${msg})`
          : `Figma API request failed: ${msg}. Check the Figma URL and your network connection.`,
        recoverable: !isAuth,
      }],
      logs: [makeLogEntry('error', `Figma fetch failed: ${msg}`)],
    };
  }

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
