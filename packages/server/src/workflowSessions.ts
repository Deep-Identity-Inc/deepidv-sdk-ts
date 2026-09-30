import { z } from 'zod';
import type { HttpClient } from '@deepidv/core';
import { mapZodError, ValidationError } from '@deepidv/core';
import {
  WorkflowSessionStateWireSchema,
  WorkflowStepSubmissionSchemas,
  WorkflowStepSubmitWireResultSchema,
  type WorkflowSessionState,
  type WorkflowStepSubmissionInput,
  type WorkflowStepSubmitResult,
} from './workflowSessions.types.js';
import { WorkflowStepIdSchema, type WorkflowStepId } from './workflows.types.js';

function validateSessionId(sessionId: string): void {
  if (typeof sessionId !== 'string' || sessionId.trim() === '') {
    throw new ValidationError("expected non-empty string at 'sessionId'");
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw mapZodError(parsed.error);
  return parsed.data;
}

export class WorkflowSessions {
  constructor(private readonly client: HttpClient) {}

  async retrieve(sessionId: string): Promise<WorkflowSessionState> {
    validateSessionId(sessionId);
    const raw = await this.client.get<unknown>(
      `/v1/sessions/${encodeURIComponent(sessionId)}/workflow`,
    );
    return WorkflowSessionStateWireSchema.parse(raw);
  }

  async start(sessionId: string): Promise<WorkflowSessionState> {
    validateSessionId(sessionId);
    const raw = await this.client.post<unknown>(
      `/v1/sessions/${encodeURIComponent(sessionId)}/workflow/start`,
      {},
    );
    return WorkflowSessionStateWireSchema.parse(raw);
  }

  async submitStep<T extends WorkflowStepId>(
    sessionId: string,
    stepId: T,
    input: WorkflowStepSubmissionInput<T>,
  ): Promise<WorkflowStepSubmitResult> {
    validateSessionId(sessionId);
    const parsedStepId = parse(WorkflowStepIdSchema, stepId) as T;
    const submissionSchema = WorkflowStepSubmissionSchemas[parsedStepId] as z.ZodType;
    const body = parse(submissionSchema, input);
    const raw = await this.client.post(
      `/v1/sessions/${encodeURIComponent(sessionId)}/steps/${encodeURIComponent(parsedStepId)}`,
      body,
      { maxRetries: 0 },
    );
    return WorkflowStepSubmitWireResultSchema.parse(raw);
  }
}
