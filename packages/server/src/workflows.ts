import { z } from 'zod';
import type { HttpClient } from '@deepidv/core';
import { mapZodError, ValidationError } from '@deepidv/core';
import {
  WorkflowCreateInputSchema,
  WorkflowListWireResultSchema,
  WorkflowStepConfigSchema,
  WorkflowWireResultSchema,
  type WorkflowListResult,
  type WorkflowResult,
} from './workflows.types.js';
import {
  WorkflowSessionCreateInputSchema,
  WorkflowSessionCreateWireResultSchema,
  type WorkflowSessionCreateResult,
} from './workflowSessions.types.js';

function validateId(value: string, name: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`expected non-empty string at '${name}'`);
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw mapZodError(parsed.error);
  return parsed.data;
}

export class Workflows {
  constructor(private readonly client: HttpClient) {}

  async list(): Promise<WorkflowListResult> {
    const raw = await this.client.get<unknown>('/v1/workflows');
    return WorkflowListWireResultSchema.parse(raw);
  }

  async create(input: z.input<typeof WorkflowCreateInputSchema>): Promise<WorkflowResult> {
    const body = parse(WorkflowCreateInputSchema, input);
    const raw = await this.client.post<unknown>('/v1/workflows', body, { maxRetries: 0 });
    return WorkflowWireResultSchema.parse(raw);
  }

  async retrieve(workflowId: string): Promise<WorkflowResult> {
    validateId(workflowId, 'workflowId');
    const raw = await this.client.get<unknown>(`/v1/workflows/${encodeURIComponent(workflowId)}`);
    return WorkflowWireResultSchema.parse(raw);
  }

  async updateStepConfig(
    workflowId: string,
    stepId: string,
    config: z.input<typeof WorkflowStepConfigSchema>,
  ): Promise<WorkflowResult> {
    validateId(workflowId, 'workflowId');
    validateId(stepId, 'stepId');
    const parsedConfig = parse(WorkflowStepConfigSchema, config);
    const raw = await this.client.patch<unknown>(
      `/v1/workflows/${encodeURIComponent(workflowId)}/steps/${encodeURIComponent(stepId)}/config`,
      { config: parsedConfig },
    );
    return WorkflowWireResultSchema.parse(raw);
  }

  async createSession(
    workflowId: string,
    input: z.input<typeof WorkflowSessionCreateInputSchema>,
  ): Promise<WorkflowSessionCreateResult> {
    validateId(workflowId, 'workflowId');
    const parsed = parse(WorkflowSessionCreateInputSchema, input);
    const raw = await this.client.post<unknown>(
      `/v1/workflows/${encodeURIComponent(workflowId)}/sessions`,
      {
        email: parsed.email,
        first_name: parsed.firstName,
        last_name: parsed.lastName,
        phone: parsed.phone,
        ...(parsed.externalId === undefined ? {} : { external_id: parsed.externalId }),
        ...(parsed.expiresInHours === undefined ? {} : { expires_in_hours: parsed.expiresInHours }),
      },
      { maxRetries: 0 },
    );
    return WorkflowSessionCreateWireResultSchema.parse(raw);
  }
}
