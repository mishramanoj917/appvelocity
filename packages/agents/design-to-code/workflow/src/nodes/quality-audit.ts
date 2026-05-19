/**
 * runDesignAudit — end-to-end wrapper for the quality analysis route.
 *
 * Fetches the Figma file + variables, optionally builds the IR, then
 * calls analyzeDesignQuality. The web API route only needs this one function.
 *
 * Throws typed errors so the caller can map them to HTTP status codes.
 */

import { FigmaClient, IRBuilder, parseFigmaUrl } from '@appvelocity/agent-design-to-code-core';
import { analyzeDesignQuality } from './quality-analyzer.js';
import type { DesignQualityReport } from '../types.js';

export class FigmaAuthError extends Error {
  readonly code = 'FIGMA_AUTH_ERROR';
}

export class FigmaApiError extends Error {
  readonly code = 'FIGMA_API_ERROR';
}

export class InvalidFigmaUrlError extends Error {
  readonly code = 'INVALID_FIGMA_URL';
}

export async function runDesignAudit(
  figmaUrl: string,
  figmaAccessToken: string
): Promise<DesignQualityReport> {
  let fileKey: string;
  try {
    ({ fileKey } = parseFigmaUrl(figmaUrl));
  } catch (err) {
    throw new InvalidFigmaUrlError(err instanceof Error ? err.message : String(err));
  }

  const client = new FigmaClient({ accessToken: figmaAccessToken, rateLimitPerMinute: 60 });

  let figmaFile: Awaited<ReturnType<typeof client.getFile>>;
  let variablesResponse: Awaited<ReturnType<typeof client.getLocalVariables>> | undefined;
  try {
    [figmaFile, variablesResponse] = await Promise.all([
      client.getFile(fileKey),
      client.getLocalVariables(fileKey).catch(() => undefined),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isAuth = msg.includes('403') || msg.toLowerCase().includes('auth') || msg.toLowerCase().includes('unauthorized');
    if (isAuth) throw new FigmaAuthError('Figma authentication failed. Check your access token.');
    throw new FigmaApiError(`Figma API error: ${msg}`);
  }

  // Build IR — non-fatal if it fails
  let designIR: Awaited<ReturnType<InstanceType<typeof IRBuilder>['build']>> | undefined;
  try {
    designIR = new IRBuilder().build(figmaFile, fileKey, variablesResponse);
  } catch {
    designIR = undefined;
  }

  return analyzeDesignQuality(figmaFile, variablesResponse, undefined, designIR);
}
