/**
 * Workflow-scoped logger utilities.
 */

import type { LogEntry } from '../types.js';

/** Builds a single LogEntry for inclusion in WorkflowState.logs. */
export function makeLogEntry(
  level: LogEntry['level'],
  message: string,
  nodeId?: string
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(nodeId ? { nodeId } : {}),
  };
}
