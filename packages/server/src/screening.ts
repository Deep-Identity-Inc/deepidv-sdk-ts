/**
 * Screening service module.
 *
 * Provides PEP & Sanctions, Adverse Media, Title Check, and session-history
 * operations. All methods validate developer inputs with Zod before making
 * network calls. HTTP orchestration (auth, retry, error mapping) is
 * delegated to `HttpClient`.
 *
 * Adverse Media is async-from-day-one: `adverseMedia()` returns an
 * `AdverseMediaHandle` immediately; the result is delivered via the
 * handle's `.wait()` (auto-polling) or `.refresh()` (single poll) methods.
 *
 * @module screening
 */

import { z } from 'zod';
import type { HttpClient } from '@deepidv/core';
import { mapZodError } from '@deepidv/core';
import {
  AdverseMediaInputSchema,
  AdverseMediaQueuedResponseSchema,
  PepSanctionsInputSchema,
  PepSanctionsResultSchema,
  ScreeningListInputSchema,
  TitleCheckInputSchema,
  TitleCheckResultSchema,
  type PepSanctionsResult,
  type ScreeningListResult,
  type TitleCheckResult,
} from './screening.types.js';
import type { AsyncJobs } from './asyncJobs.js';
import { createAdverseMediaHandle, type AdverseMediaHandle } from './asyncJobHandle.js';

// ---------------------------------------------------------------------------
// Screening class
// ---------------------------------------------------------------------------

/**
 * Provides silent-screening operations: PEP & Sanctions, Adverse Media,
 * Title Check, and session history.
 *
 * Instantiated by the main SDK client and receives `HttpClient` plus an
 * `AsyncJobs` instance via constructor injection (D-04). The async-jobs
 * dependency is used by `adverseMedia()` to back the polling handle —
 * no separate HTTP plumbing.
 *
 * @example
 * ```typescript
 * const client = new DeepIDV({ apiKey: 'your-key' });
 *
 * // Sync
 * const pep = await client.screening.pepSanctions({
 *   firstName: 'Jane',
 *   lastName: 'Doe',
 *   dateOfBirth: '1980-05-12',
 * });
 *
 * // Async — returns a handle
 * const handle = await client.screening.adverseMedia({
 *   firstName: 'Jane',
 *   lastName: 'Doe',
 *   dateOfBirth: '1980-05-12',
 * });
 * const result = await handle.wait();
 * ```
 */
export class Screening {
  constructor(
    private readonly client: HttpClient,
    private readonly asyncJobs: AsyncJobs,
  ) {}

  /**
   * Run a PEP & Sanctions screening (synchronous).
   *
   * Returns local sanctions matches (US/CA), OpenSanctions hits, and
   * aggregate counts. The server may short-circuit with `data.skip: true`
   * if the subject can be ruled out early.
   *
   * @throws {ValidationError} If input fails schema validation (400).
   * @throws {AuthenticationError} If the API key is invalid (401).
   * @throws {RateLimitError} If the rate limit is exceeded (429).
   * @throws {DeepIDVError} For other API errors.
   */
  async pepSanctions(input: z.input<typeof PepSanctionsInputSchema>): Promise<PepSanctionsResult> {
    const parsed = PepSanctionsInputSchema.safeParse(input);
    if (!parsed.success) {
      throw mapZodError(parsed.error);
    }
    const raw = await this.client.post<Record<string, unknown>>(
      '/v1/screening/pep-sanctions',
      parsed.data,
    );
    return PepSanctionsResultSchema.parse(raw);
  }

  /**
   * Queue an adverse-media screening (async).
   *
   * The POST returns a `jobId` immediately; the SDK wraps it in an
   * `AdverseMediaHandle` so callers can `.wait()` for the result
   * (auto-polling, with configurable interval and timeout) or `.refresh()`
   * for a single non-blocking snapshot.
   *
   * `idempotencyKey` becomes the `Idempotency-Key` header. If omitted, the
   * SDK auto-generates a UUID v4 per call so customer retries (network
   * blips, batch restarts) are safe by default. Server-side dedup TTL is
   * 24 hours.
   *
   * @throws {ValidationError} If input fails schema validation (400).
   * @throws {AuthenticationError} If the API key is invalid (401).
   * @throws {RateLimitError} If the rate limit is exceeded (429).
   * @throws {DeepIDVError} For other API errors.
   */
  async adverseMedia(input: z.input<typeof AdverseMediaInputSchema>): Promise<AdverseMediaHandle> {
    const parsed = AdverseMediaInputSchema.safeParse(input);
    if (!parsed.success) {
      throw mapZodError(parsed.error);
    }
    const { idempotencyKey, ...body } = parsed.data;
    const headerKey = idempotencyKey ?? generateIdempotencyKey();

    const raw = await this.client.post<Record<string, unknown>>(
      '/v1/screening/adverse-media',
      body,
      { headers: { 'Idempotency-Key': headerKey } },
    );

    const queued = AdverseMediaQueuedResponseSchema.parse(raw);
    return createAdverseMediaHandle(queued.jobId, this.asyncJobs);
  }

  /**
   * Run a title/property search by address (synchronous).
   *
   * The server geocodes the address via Google Places and queries the
   * title-search backend. Response is a discriminated union on `status`:
   * `'found' | 'multiple_properties' | 'unsupported_region' | 'not_found'`.
   *
   * `'unsupported_region'` is a typed result variant, not an error — the
   * server returns HTTP 200 with that status when the address falls
   * outside the supported region (currently US only).
   *
   * @throws {ValidationError} If input fails schema validation (400).
   * @throws {AuthenticationError} If the API key is invalid (401).
   * @throws {RateLimitError} If the rate limit is exceeded (429).
   * @throws {DeepIDVError} For other API errors.
   */
  async titleCheck(input: z.input<typeof TitleCheckInputSchema>): Promise<TitleCheckResult> {
    const parsed = TitleCheckInputSchema.safeParse(input);
    if (!parsed.success) {
      throw mapZodError(parsed.error);
    }
    const raw = await this.client.post<unknown>('/v1/screening/title-check', parsed.data);
    return TitleCheckResultSchema.parse(raw);
  }

  /**
   * List historical screening sessions for the authenticated organization.
   *
   * Not yet implemented — the backing endpoint `GET /v1/screening/sessions`
   * does not exist on the server. The schema and method signature are
   * stable so consumer code can be written today; the method body will
   * land when the endpoint ships.
   */
  list(_params?: z.input<typeof ScreeningListInputSchema>): Promise<ScreeningListResult> {
    void _params;
    throw new Error(
      'screening.list() is not yet implemented — pending GET /v1/screening/sessions on the server.',
    );
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Generates a UUID v4 via the Web Crypto API.
 *
 * `globalThis.crypto.randomUUID()` is available on Node 18+, Bun, Deno,
 * and Cloudflare Workers — matches the SDK's runtime-compatibility constraints.
 */
function generateIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}
