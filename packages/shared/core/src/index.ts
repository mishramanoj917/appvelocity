import { z } from 'zod';

// ─── Core agent interfaces ────────────────────────────────────────────────────

export interface AgentInput {
  action: string;
  params: Record<string, unknown>;
  context?: AgentContext;
  options?: AgentOptions;
}

export interface AgentOutput {
  success: boolean;
  data?: unknown;
  errors?: AgentError[];
  warnings?: string[];
  metadata: OutputMetadata;
}

export interface AgentContext {
  userId?: string;
  projectId?: string;
  sessionId: string;
  sharedState?: Record<string, unknown>;
  /** Runtime-only: called by the agent after each pipeline node completes. Not serialized. */
  onStep?: (step: string) => void;
}

export interface AgentOptions {
  dryRun?: boolean;
  verbose?: boolean;
  timeout?: number;
  maxRetries?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface CostEstimate {
  estimatedDuration: number; // seconds
  estimatedTokens?: number;
  estimatedCost?: number;    // USD
  confidence: 'low' | 'medium' | 'high';
}

export interface AgentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  name: string;
  version: string;
  lastCheck: string;
  issues?: string[];
}

export interface AgentError {
  code: string;
  message: string;
  details?: unknown;
  recoverable: boolean;
}

export interface OutputMetadata {
  agentName: string;
  agentVersion: string;
  executionTime: number;
  tokensUsed?: number;
  cost?: number;
  timestamp: string;
}

// ─── AgentBase abstract class ─────────────────────────────────────────────────

export abstract class AgentBase {
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly description: string;
  abstract readonly capabilities: string[];

  abstract execute(input: AgentInput): Promise<AgentOutput>;
  abstract validate(input: AgentInput): ValidationResult;
  abstract estimateCost(input: AgentInput): CostEstimate;

  getHealth(): AgentHealth {
    return {
      status: 'healthy',
      name: this.name,
      version: this.version,
      lastCheck: new Date().toISOString(),
    };
  }

  protected buildOutput(
    success: boolean,
    data: unknown,
    startTime: number,
    errors?: AgentError[]
  ): AgentOutput {
    return {
      success,
      data,
      errors,
      metadata: {
        agentName: this.name,
        agentVersion: this.version,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

export const AgentInputSchema = z.object({
  action: z.string().min(1),
  params: z.record(z.unknown()),
  context: z
    .object({
      userId: z.string().optional(),
      projectId: z.string().optional(),
      sessionId: z.string(),
      sharedState: z.record(z.unknown()).optional(),
    })
    .optional(),
  options: z
    .object({
      dryRun: z.boolean().optional(),
      verbose: z.boolean().optional(),
      timeout: z.number().optional(),
      maxRetries: z.number().optional(),
    })
    .optional(),
});
