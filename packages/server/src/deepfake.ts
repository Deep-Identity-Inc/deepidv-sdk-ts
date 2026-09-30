import { z } from 'zod';
import type { HttpClient } from '@deepidv/core';
import { mapZodError } from '@deepidv/core';
import {
  DeepfakeAnalyzeInputSchema,
  DeepfakeAnalyzeResultSchema,
  DeepfakeChallengeResultSchema,
  DeepfakeUploadUrlsInputSchema,
  DeepfakeUploadUrlsResultSchema,
  type DeepfakeAnalyzeResult,
  type DeepfakeChallengeResult,
  type DeepfakeUploadUrlsResult,
} from './deepfake.types.js';

/** Deepfake challenge, upload-target, and synchronous analysis operations. */
export class Deepfake {
  constructor(private readonly client: HttpClient) {}

  async getChallenge(sessionId: string): Promise<DeepfakeChallengeResult> {
    const parsed = z.uuid().safeParse(sessionId);
    if (!parsed.success) throw mapZodError(parsed.error);
    const raw = await this.client.get<unknown>(
      `/v1/deepfake/challenge/${encodeURIComponent(parsed.data)}`,
    );
    return DeepfakeChallengeResultSchema.parse(raw);
  }

  async createUploadUrls(
    input: z.input<typeof DeepfakeUploadUrlsInputSchema>,
  ): Promise<DeepfakeUploadUrlsResult> {
    const parsed = DeepfakeUploadUrlsInputSchema.safeParse(input);
    if (!parsed.success) throw mapZodError(parsed.error);
    const raw = await this.client.post<unknown>('/v1/deepfake/upload-urls', parsed.data);
    return DeepfakeUploadUrlsResultSchema.parse(raw);
  }

  async analyze(input: z.input<typeof DeepfakeAnalyzeInputSchema>): Promise<DeepfakeAnalyzeResult> {
    const parsed = DeepfakeAnalyzeInputSchema.safeParse(input);
    if (!parsed.success) throw mapZodError(parsed.error);
    const raw = await this.client.post<unknown>('/v1/deepfake/analyze', parsed.data, {
      maxRetries: 0,
    });
    return DeepfakeAnalyzeResultSchema.parse(raw);
  }
}
