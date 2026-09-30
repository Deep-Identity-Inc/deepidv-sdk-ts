import { z } from 'zod';
import type { HttpClient } from '@deepidv/core';
import { mapZodError, ValidationError } from '@deepidv/core';
import { buildCursorQuery } from './pagination.js';
import {
  FinancialCreateInputSchema,
  FinancialCreateResultSchema,
  FinancialListParamsSchema,
  FinancialListWireResultSchema,
  FinancialRecordWireSchema,
  type FinancialCreateResult,
  type FinancialListResult,
  type FinancialRecord,
} from './financial.types.js';

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

/** Bank-statement request management. */
export class Financial {
  constructor(private readonly client: HttpClient) {}

  async create(input: z.input<typeof FinancialCreateInputSchema>): Promise<FinancialCreateResult> {
    const body = parse(FinancialCreateInputSchema, input);
    const raw = await this.client.post<unknown>('/v1/financial', body, { maxRetries: 0 });
    return FinancialCreateResultSchema.parse(raw);
  }

  async list(params: z.input<typeof FinancialListParamsSchema> = {}): Promise<FinancialListResult> {
    const parsed = parse(FinancialListParamsSchema, params);
    const raw = await this.client.get<unknown>(`/v1/financial${buildCursorQuery(parsed)}`);
    return FinancialListWireResultSchema.parse(raw);
  }

  async retrieve(id: string): Promise<FinancialRecord> {
    validateId(id, 'id');
    const raw = await this.client.get<unknown>(`/v1/financial/${encodeURIComponent(id)}`);
    return FinancialRecordWireSchema.parse(raw);
  }

  async listByExternalId(
    externalId: string,
    params: z.input<typeof FinancialListParamsSchema> = {},
  ): Promise<FinancialListResult> {
    validateId(externalId, 'externalId');
    const parsed = parse(FinancialListParamsSchema, params);
    const raw = await this.client.get<unknown>(
      `/v1/financial/externalId/${encodeURIComponent(externalId)}${buildCursorQuery(parsed)}`,
    );
    return FinancialListWireResultSchema.parse(raw);
  }
}
