import type { HttpClient } from '@deepidv/core';
import { AuthVerifyResultSchema, type AuthVerifyResult } from './auth.types.js';

/** API-key connection and organization checks. */
export class Auth {
  constructor(private readonly client: HttpClient) {}

  /** Verify the configured API key and return its active organization. */
  async verify(): Promise<AuthVerifyResult> {
    const raw = await this.client.get<unknown>('/v1/auth/verify');
    return AuthVerifyResultSchema.parse(raw);
  }
}
