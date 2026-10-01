import { z } from 'zod';
import type { HttpClient } from '@deepidv/core';
import { mapZodError, ValidationError } from '@deepidv/core';
import {
  AnalyzeAntiCheatInputSchema,
  AnalyzeInjectionInputSchema,
  AnalyzeInjectionResultSchema,
  AnalyzeIpCheckInputSchema,
  AntiCheatPurgeWireResultSchema,
  AntiCheatResultSchema,
  IpCheckResultSchema,
  SelfExclusionApplicantInputSchema,
  SelfExclusionApplicantWireResultSchema,
  SelfExclusionFaceInputSchema,
  SelfExclusionFaceRemoveWireResultSchema,
  SelfExclusionFaceWireResultSchema,
  SelfExclusionIdentityAddInputSchema,
  SelfExclusionIdentityAddWireResultSchema,
  SelfExclusionIdentityRemoveWireResultSchema,
  SelfExclusionListParamsSchema,
  SelfExclusionListWireResultSchema,
  type AnalyzeInjectionResult,
  type AntiCheatPurgeResult,
  type AntiCheatResult,
  type IpCheckResult,
  type SelfExclusionApplicantResult,
  type SelfExclusionFaceRemoveResult,
  type SelfExclusionFaceResult,
  type SelfExclusionIdentityAddResult,
  type SelfExclusionIdentityRemoveResult,
  type SelfExclusionListResult,
} from './igaming.types.js';

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw mapZodError(parsed.error);
  return parsed.data;
}

function validateId(value: string, name: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`expected non-empty string at '${name}'`);
  }
}

class SelfExclusion {
  constructor(private readonly client: HttpClient) {}

  async list(
    params: z.input<typeof SelfExclusionListParamsSchema> = {},
  ): Promise<SelfExclusionListResult> {
    const parsed = parse(SelfExclusionListParamsSchema, params);
    const query = parsed.limit === undefined ? '' : `?limit=${String(parsed.limit)}`;
    const raw = await this.client.get<unknown>(`/v1/igaming/self-exclusion${query}`);
    return SelfExclusionListWireResultSchema.parse(raw);
  }

  async addIdentity(
    input: z.input<typeof SelfExclusionIdentityAddInputSchema>,
  ): Promise<SelfExclusionIdentityAddResult> {
    const parsed = parse(SelfExclusionIdentityAddInputSchema, input);
    const raw = await this.client.post<unknown>(
      '/v1/igaming/self-exclusion/identity',
      {
        ...(parsed.documentNumber === undefined ? {} : { document_number: parsed.documentNumber }),
        ...(parsed.documentNumbers === undefined
          ? {}
          : { document_numbers: parsed.documentNumbers }),
        ...(parsed.reason === undefined ? {} : { reason: parsed.reason }),
        ...(parsed.firstName === undefined ? {} : { first_name: parsed.firstName }),
        ...(parsed.lastName === undefined ? {} : { last_name: parsed.lastName }),
      },
      { maxRetries: 0 },
    );
    return SelfExclusionIdentityAddWireResultSchema.parse(raw);
  }

  async removeIdentity(documentNumber: string): Promise<SelfExclusionIdentityRemoveResult> {
    validateId(documentNumber, 'documentNumber');
    const raw = await this.client.delete<unknown>(
      `/v1/igaming/self-exclusion/identity/${encodeURIComponent(documentNumber)}`,
      { maxRetries: 0 },
    );
    return SelfExclusionIdentityRemoveWireResultSchema.parse(raw);
  }

  async addFace(
    input: z.input<typeof SelfExclusionFaceInputSchema>,
  ): Promise<SelfExclusionFaceResult> {
    const parsed = parse(SelfExclusionFaceInputSchema, input);
    const raw = await this.client.post<unknown>(
      '/v1/igaming/self-exclusion/face',
      {
        session_id: parsed.sessionId,
        ...(parsed.reason === undefined ? {} : { reason: parsed.reason }),
      },
      { maxRetries: 0 },
    );
    return SelfExclusionFaceWireResultSchema.parse(raw);
  }

  async removeFace(sessionId: string): Promise<SelfExclusionFaceRemoveResult> {
    validateId(sessionId, 'sessionId');
    const raw = await this.client.delete<unknown>(
      `/v1/igaming/self-exclusion/face/${encodeURIComponent(sessionId)}`,
      { maxRetries: 0 },
    );
    return SelfExclusionFaceRemoveWireResultSchema.parse(raw);
  }

  async addApplicant(
    input: z.input<typeof SelfExclusionApplicantInputSchema>,
  ): Promise<SelfExclusionApplicantResult> {
    const parsed = parse(SelfExclusionApplicantInputSchema, input);
    const raw = await this.client.post<unknown>(
      '/v1/igaming/self-exclusion/applicant',
      {
        session_id: parsed.sessionId,
        ...(parsed.reason === undefined ? {} : { reason: parsed.reason }),
      },
      { maxRetries: 0 },
    );
    return SelfExclusionApplicantWireResultSchema.parse(raw);
  }
}

/** Session iGaming checks and organization self-exclusion management. */
export class IGaming {
  readonly selfExclusion: SelfExclusion;

  constructor(private readonly client: HttpClient) {
    this.selfExclusion = new SelfExclusion(client);
  }

  async analyzeInjection(
    input: z.input<typeof AnalyzeInjectionInputSchema>,
  ): Promise<AnalyzeInjectionResult> {
    const parsed = parse(AnalyzeInjectionInputSchema, input);
    const raw = await this.client.post<unknown>(
      '/v1/igaming/injection',
      {
        session_id: parsed.sessionId,
        ...(parsed.deviceIntegrity === undefined
          ? {}
          : { device_integrity: parsed.deviceIntegrity }),
        ...(parsed.mediaSource === undefined ? {} : { media_source: parsed.mediaSource }),
        ...(parsed.frameTiming === undefined ? {} : { frame_timing: parsed.frameTiming }),
      },
      { maxRetries: 0 },
    );
    return AnalyzeInjectionResultSchema.parse(raw);
  }

  async detectVpn(input: z.input<typeof AnalyzeIpCheckInputSchema>): Promise<IpCheckResult> {
    return this.analyzeIp('/v1/igaming/vpn-detection', input);
  }

  async checkIpJurisdiction(
    input: z.input<typeof AnalyzeIpCheckInputSchema>,
  ): Promise<IpCheckResult> {
    return this.analyzeIp('/v1/igaming/ip-jurisdiction', input);
  }

  async analyzeAntiCheat(
    input: z.input<typeof AnalyzeAntiCheatInputSchema>,
  ): Promise<AntiCheatResult> {
    const parsed = parse(AnalyzeAntiCheatInputSchema, input);
    const raw = await this.client.post<unknown>(
      '/v1/igaming/anti-cheat',
      {
        session_id: parsed.sessionId,
        image: parsed.image,
        ...(parsed.deviceFingerprint === undefined
          ? {}
          : { device_fingerprint: parsed.deviceFingerprint }),
      },
      { maxRetries: 0 },
    );
    return AntiCheatResultSchema.parse(raw);
  }

  async purgeAntiCheatEnrollment(sessionId: string): Promise<AntiCheatPurgeResult> {
    validateId(sessionId, 'sessionId');
    const raw = await this.client.delete<unknown>(
      `/v1/igaming/anti-cheat/${encodeURIComponent(sessionId)}`,
      { maxRetries: 0 },
    );
    return AntiCheatPurgeWireResultSchema.parse(raw);
  }

  private async analyzeIp(
    path: '/v1/igaming/vpn-detection' | '/v1/igaming/ip-jurisdiction',
    input: z.input<typeof AnalyzeIpCheckInputSchema>,
  ): Promise<IpCheckResult> {
    const parsed = parse(AnalyzeIpCheckInputSchema, input);
    const raw = await this.client.post<unknown>(
      path,
      { session_id: parsed.sessionId, ip_address: parsed.ipAddress },
      { maxRetries: 0 },
    );
    return IpCheckResultSchema.parse(raw);
  }
}
