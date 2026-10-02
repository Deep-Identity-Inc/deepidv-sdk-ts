import { z } from 'zod';
import type { HttpClient } from '@deepidv/core';
import { mapZodError } from '@deepidv/core';
import {
  CreditCheckCreateInputSchema,
  CreditCheckCreateWireResultSchema,
  type CreditCheckCreateResult,
} from './creditChecks.types.js';

/** Hard and soft credit-check session creation. */
export class CreditChecks {
  constructor(private readonly client: HttpClient) {}

  async createHard(
    input: z.input<typeof CreditCheckCreateInputSchema>,
  ): Promise<CreditCheckCreateResult> {
    return this.create('hard', input);
  }

  async createSoft(
    input: z.input<typeof CreditCheckCreateInputSchema>,
  ): Promise<CreditCheckCreateResult> {
    return this.create('soft', input);
  }

  private async create(
    kind: 'hard' | 'soft',
    input: z.input<typeof CreditCheckCreateInputSchema>,
  ): Promise<CreditCheckCreateResult> {
    const parsed = CreditCheckCreateInputSchema.safeParse(input);
    if (!parsed.success) throw mapZodError(parsed.error);
    const raw = await this.client.post<unknown>(`/v1/credit-check/${kind}`, parsed.data, {
      maxRetries: 0,
    });
    return CreditCheckCreateWireResultSchema.parse(raw);
  }
}
