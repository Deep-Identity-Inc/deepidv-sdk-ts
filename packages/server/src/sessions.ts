/** OpenAPI-aligned hosted verification session client. */

import { z } from 'zod';
import type { HttpClient } from '@deepidv/core';
import { mapZodError, ValidationError } from '@deepidv/core';
import {
  SessionCreateInputSchema,
  SessionCreateWireResultSchema,
  SessionListParamsSchema,
  SessionListWireResultSchema,
  SessionRetrieveWireResultSchema,
  SessionStatusUpdateSchema,
  SessionStatusUpdateWireResultSchema,
  type SessionCreateResult,
  type SessionListParams,
  type SessionListResult,
  type SessionRetrieveResult,
  type SessionStatusUpdateResult,
} from './sessions.types.js';

function validateSessionId(sessionId: string): void {
  if (typeof sessionId !== 'string' || sessionId.trim() === '') {
    throw new ValidationError("expected non-empty string at 'sessionId'");
  }
}

function buildQueryString(params: SessionListParams): string {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.nextToken !== undefined) query.set('next_token', params.nextToken);
  if (params.startDate !== undefined) query.set('start_date', params.startDate);
  if (params.endDate !== undefined) query.set('end_date', params.endDate);
  if (params.byOrganization !== undefined && params.byOrganization !== null) {
    query.set('by_organization', String(params.byOrganization));
  }
  if (params.externalId !== undefined) query.set('external_id', params.externalId);
  if (params.workflowId !== undefined) query.set('workflow_id', params.workflowId);
  const value = query.toString();
  return value ? `?${value}` : '';
}

export class Sessions {
  constructor(private readonly client: HttpClient) {}

  async create(input: z.input<typeof SessionCreateInputSchema>): Promise<SessionCreateResult> {
    const parsed = SessionCreateInputSchema.safeParse(input);
    if (!parsed.success) throw mapZodError(parsed.error);
    const raw = await this.client.post<unknown>('/v1/sessions', parsed.data);
    return SessionCreateWireResultSchema.parse(raw);
  }

  async retrieve(sessionId: string): Promise<SessionRetrieveResult> {
    validateSessionId(sessionId);
    const raw = await this.client.get<unknown>(`/v1/sessions/${encodeURIComponent(sessionId)}`);
    return SessionRetrieveWireResultSchema.parse(raw);
  }

  async list(params?: z.input<typeof SessionListParamsSchema>): Promise<SessionListResult> {
    const parsed = SessionListParamsSchema.safeParse(params ?? {});
    if (!parsed.success) throw mapZodError(parsed.error);
    const raw = await this.client.get<unknown>(`/v1/sessions${buildQueryString(parsed.data)}`);
    return SessionListWireResultSchema.parse(raw);
  }

  async updateStatus(
    sessionId: string,
    status: z.input<typeof SessionStatusUpdateSchema>,
  ): Promise<SessionStatusUpdateResult> {
    validateSessionId(sessionId);
    const parsed = SessionStatusUpdateSchema.safeParse(status);
    if (!parsed.success) throw mapZodError(parsed.error);
    const raw = await this.client.patch<unknown>(
      `/v1/sessions/${encodeURIComponent(sessionId)}/update-status`,
      { new_status: parsed.data },
    );
    return SessionStatusUpdateWireResultSchema.parse(raw);
  }
}
