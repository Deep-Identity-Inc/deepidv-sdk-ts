import { z } from 'zod';
import type { HttpClient } from '@deepidv/core';
import { mapZodError } from '@deepidv/core';
import {
  AgeVerificationBoundariesWireSchema,
  AgeVerificationCreateInputSchema,
  AgeVerificationCreateWireResultSchema,
  ParentConnectListParamsSchema,
  ParentConnectListWireResultSchema,
  ParentConnectRequestWireSchema,
  type AgeVerificationBoundaries,
  type AgeVerificationCreateResult,
  type ParentConnectListResult,
  type ParentConnectRequest,
} from './ageVerification.types.js';

function parseNonEmptyId(value: string): string {
  const parsed = z.string().min(1).safeParse(value);
  if (!parsed.success) throw mapZodError(parsed.error);
  return parsed.data;
}

/** Standalone age-verification sessions and read-only Parent Connect resources. */
export class AgeVerification {
  constructor(private readonly client: HttpClient) {}

  async create(
    input: z.input<typeof AgeVerificationCreateInputSchema>,
  ): Promise<AgeVerificationCreateResult> {
    const parsed = AgeVerificationCreateInputSchema.safeParse(input);
    if (!parsed.success) throw mapZodError(parsed.error);
    const raw = await this.client.post<unknown>('/v1/age-verification', parsed.data, {
      maxRetries: 0,
    });
    return AgeVerificationCreateWireResultSchema.parse(raw);
  }

  async listParentConnectRequests(
    params?: z.input<typeof ParentConnectListParamsSchema>,
  ): Promise<ParentConnectListResult> {
    const parsed = ParentConnectListParamsSchema.safeParse(params ?? {});
    if (!parsed.success) throw mapZodError(parsed.error);
    const query = new URLSearchParams();
    if (parsed.data.limit !== undefined) query.set('limit', String(parsed.data.limit));
    if (parsed.data.nextToken !== undefined) query.set('next_token', parsed.data.nextToken);
    if (parsed.data.childSessionId !== undefined) {
      query.set('child_session_id', parsed.data.childSessionId);
    }
    if (parsed.data.status !== undefined) query.set('status', parsed.data.status);
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    const raw = await this.client.get<unknown>(`/v1/age-verification/parent-connect${suffix}`);
    return ParentConnectListWireResultSchema.parse(raw);
  }

  async retrieveParentConnectRequest(parentConnectId: string): Promise<ParentConnectRequest> {
    const id = parseNonEmptyId(parentConnectId);
    const raw = await this.client.get<unknown>(
      `/v1/age-verification/parent-connect/${encodeURIComponent(id)}`,
    );
    return ParentConnectRequestWireSchema.parse(raw);
  }

  async getBoundaries(childAttestationId: string): Promise<AgeVerificationBoundaries> {
    const id = parseNonEmptyId(childAttestationId);
    const raw = await this.client.get<unknown>(
      `/v1/age-verification/boundaries/${encodeURIComponent(id)}`,
    );
    return AgeVerificationBoundariesWireSchema.parse(raw);
  }
}
