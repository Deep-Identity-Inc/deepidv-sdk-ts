import { z } from 'zod';
import type { HttpClient } from '@deepidv/core';
import { mapZodError } from '@deepidv/core';
import {
  ReVerificationCreateInputSchema,
  ReVerificationCreateWireResultSchema,
  ReVerificationDecisionWireResultSchema,
  ReVerificationLivenessStartWireResultSchema,
  ReVerificationLivenessUploadUrlInputSchema,
  ReVerificationLivenessUploadUrlWireResultSchema,
  type ReVerificationCreateResult,
  type ReVerificationDecisionResult,
  type ReVerificationLivenessStartResult,
  type ReVerificationLivenessUploadUrlResult,
} from './reVerifications.types.js';

function parseId(value: string): string {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw mapZodError(parsed.error);
  return parsed.data;
}

/** Resumable re-verification liveness lifecycle operations. */
export class ReVerifications {
  constructor(private readonly client: HttpClient) {}

  async create(
    input: z.input<typeof ReVerificationCreateInputSchema>,
  ): Promise<ReVerificationCreateResult> {
    const parsed = ReVerificationCreateInputSchema.safeParse(input);
    if (!parsed.success) throw mapZodError(parsed.error);
    const raw = await this.client.post<unknown>(
      '/v1/re-verifications',
      {
        workflow_id: parsed.data.workflowId,
        ...(parsed.data.deviceFingerprint !== undefined
          ? { device_fingerprint: parsed.data.deviceFingerprint }
          : {}),
      },
      { maxRetries: 0 },
    );
    return ReVerificationCreateWireResultSchema.parse(raw);
  }

  async startLiveness(id: string): Promise<ReVerificationLivenessStartResult> {
    const parsedId = parseId(id);
    const raw = await this.client.post<unknown>(
      `/v1/re-verifications/${encodeURIComponent(parsedId)}/liveness/start`,
      {},
      { maxRetries: 0 },
    );
    return ReVerificationLivenessStartWireResultSchema.parse(raw);
  }

  async createLivenessUploadUrl(
    id: string,
    input: z.input<typeof ReVerificationLivenessUploadUrlInputSchema>,
  ): Promise<ReVerificationLivenessUploadUrlResult> {
    const parsedId = parseId(id);
    const parsed = ReVerificationLivenessUploadUrlInputSchema.safeParse(input);
    if (!parsed.success) throw mapZodError(parsed.error);
    const raw = await this.client.post<unknown>(
      `/v1/re-verifications/${encodeURIComponent(parsedId)}/liveness/upload-url`,
      {
        frame_count: parsed.data.frameCount,
        ...(parsed.data.clipMimeType !== undefined
          ? { clip_mime_type: parsed.data.clipMimeType }
          : {}),
      },
    );
    return ReVerificationLivenessUploadUrlWireResultSchema.parse(raw);
  }

  async completeLiveness(id: string): Promise<ReVerificationDecisionResult> {
    const parsedId = parseId(id);
    const raw = await this.client.post<unknown>(
      `/v1/re-verifications/${encodeURIComponent(parsedId)}/liveness/complete`,
      {},
      { maxRetries: 0 },
    );
    return ReVerificationDecisionWireResultSchema.parse(raw);
  }
}
