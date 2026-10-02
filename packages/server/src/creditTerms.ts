import { z } from 'zod';
import type { HttpClient } from '@deepidv/core';
import { mapZodError, NotFoundError, ValidationError } from '@deepidv/core';
import { buildCursorQuery } from './pagination.js';
import {
  CreditTermsCreateInputSchema,
  CreditTermsCreateResultSchema,
  CreditTermsListParamsSchema,
  CreditTermsListWireResultSchema,
  CreditTermsRecordWireSchema,
  type CreditTermsCreateResult,
  type CreditTermsListResult,
  type CreditTermsRecord,
} from './creditTerms.types.js';

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

/** Credit-terms application request management. */
export class CreditTerms {
  constructor(private readonly client: HttpClient) {}

  async create(
    input: z.input<typeof CreditTermsCreateInputSchema>,
  ): Promise<CreditTermsCreateResult> {
    const body = parse(CreditTermsCreateInputSchema, input);
    const raw = await this.client.post<unknown>('/v1/credit-terms', body, { maxRetries: 0 });
    return CreditTermsCreateResultSchema.parse(raw);
  }

  async list(
    params: z.input<typeof CreditTermsListParamsSchema> = {},
  ): Promise<CreditTermsListResult> {
    const parsed = parse(CreditTermsListParamsSchema, params);
    try {
      const raw = await this.client.get<unknown>(`/v1/credit-terms${buildCursorQuery(parsed)}`);
      return CreditTermsListWireResultSchema.parse(raw);
    } catch (error) {
      if (error instanceof NotFoundError) return { creditTerms: [], nextToken: null };
      throw error;
    }
  }

  async retrieve(id: string): Promise<CreditTermsRecord> {
    validateId(id, 'id');
    const raw = await this.client.get<unknown>(`/v1/credit-terms/${encodeURIComponent(id)}`);
    return CreditTermsRecordWireSchema.parse(raw);
  }

  async listByExternalId(
    externalId: string,
    params: z.input<typeof CreditTermsListParamsSchema> = {},
  ): Promise<CreditTermsListResult> {
    validateId(externalId, 'externalId');
    const parsed = parse(CreditTermsListParamsSchema, params);
    try {
      const raw = await this.client.get<unknown>(
        `/v1/credit-terms/externalId/${encodeURIComponent(externalId)}${buildCursorQuery(parsed)}`,
      );
      return CreditTermsListWireResultSchema.parse(raw);
    } catch (error) {
      if (error instanceof NotFoundError) return { creditTerms: [], nextToken: null };
      throw error;
    }
  }
}
