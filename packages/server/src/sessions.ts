/**
 * Sessions service module.
 *
 * Provides CRUD operations for deepidv hosted verification sessions.
 * All methods validate developer inputs with Zod before making network calls.
 * HTTP orchestration (auth, retry, error mapping) is delegated to HttpClient.
 *
 * @module sessions
 */

import { z } from 'zod';
import type { HttpClient } from '@deepidv/core';
import { mapZodError, ValidationError } from '@deepidv/core';
import {
  SessionCreateInputSchema,
  SessionListParamsSchema,
  SessionStatusUpdateSchema,
  type SessionCreateResult,
  type SessionRetrieveResult,
  type PaginatedResponse,
  type Session,
  type SessionListParams,
} from './sessions.types.js';

// ---------------------------------------------------------------------------
// Private helpers (module-level, not class members — keeps class lean)
// ---------------------------------------------------------------------------

/**
 * Builds a query string from validated list params.
 * Uses native URLSearchParams for universal runtime support.
 */
function buildQueryString(params: SessionListParams): string {
  const qs = new URLSearchParams();
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  if (params.status !== undefined) qs.set('status', params.status);
  const str = qs.toString();
  return str ? `?${str}` : '';
}

/**
 * Normalizes the API list response to a `PaginatedResponse<Session>`.
 *
 * The API may return a raw array or a pre-wrapped pagination object.
 * Decision D-05: the SDK always normalizes to the wrapper shape.
 */
function wrapPaginated(
  raw: Session[] | PaginatedResponse<Session>,
  params: SessionListParams,
): PaginatedResponse<Session> {
  if (Array.isArray(raw)) {
    return {
      data: raw,
      limit: params.limit ?? raw.length,
      offset: params.offset ?? 0,
    };
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Sessions class
// ---------------------------------------------------------------------------

/**
 * Provides CRUD operations for deepidv hosted verification sessions.
 *
 * Instantiated by the main SDK client and receives `HttpClient` via
 * constructor injection (D-01). The injected client handles authentication,
 * retry logic, and error mapping — this class only contains session-specific
 * business logic.
 *
 * @example
 * ```typescript
 * const client = new DeepIDVClient({ apiKey: 'your-key' });
 * const session = await client.sessions.create({
 *   firstName: 'Jane',
 *   lastName: 'Doe',
 *   email: 'jane@example.com',
 *   phone: '+15192223333',
 * });
 * ```
 */
export class Sessions {
  constructor(private readonly client: HttpClient) {}

  /**
   * Create a hosted verification session. Optionally sends email/SMS invitations.
   *
   * Validates all input fields before making the network call. The returned
   * `sessionUrl` should be sent to your applicant to complete verification.
   *
   * @param input - Session creation parameters including applicant name, email, and phone.
   * @returns Created session with ID, URL, and associated links.
   * @throws {ValidationError} If input fails schema validation.
   * @throws {AuthenticationError} If the API key is invalid (401).
   * @throws {RateLimitError} If the rate limit is exceeded (429).
   * @throws {DeepIDVError} For other API errors.
   * @example
   * ```typescript
   * const session = await client.sessions.create({
   *   firstName: 'Jane',
   *   lastName: 'Doe',
   *   email: 'jane@example.com',
   *   phone: '+15192223333',
   *   redirectUrl: 'https://app.com/callback',
   * });
   * console.log(session.sessionUrl); // send to applicant
   * ```
   */
  async create(input: z.input<typeof SessionCreateInputSchema>): Promise<SessionCreateResult> {
    let validated: z.infer<typeof SessionCreateInputSchema>;
    try {
      validated = SessionCreateInputSchema.parse(input);
    } catch (err) {
      if (err instanceof z.ZodError) throw mapZodError(err);
      throw err;
    }
    return this.client.post<SessionCreateResult>('/v1/sessions', validated);
  }

  /**
   * Retrieve full session details including analysis results and presigned resource URLs.
   *
   * @param sessionId - The unique session identifier returned by `create()`.
   * @returns Full session envelope including nested analysis data.
   * @throws {ValidationError} If `sessionId` is empty or not a string.
   * @throws {AuthenticationError} If the API key is invalid (401).
   * @throws {RateLimitError} If the rate limit is exceeded (429).
   * @throws {DeepIDVError} If the session is not found (404) or other API errors.
   * @example
   * ```typescript
   * const session = await client.sessions.retrieve('sess_abc123');
   * console.log(session.sessionRecord.status); // 'VERIFIED'
   * ```
   */
  async retrieve(sessionId: string): Promise<SessionRetrieveResult> {
    if (typeof sessionId !== 'string' || sessionId.trim() === '') {
      throw new ValidationError("expected non-empty string at 'sessionId'");
    }
    return this.client.get<SessionRetrieveResult>(
      `/v1/sessions/${encodeURIComponent(sessionId)}`,
    );
  }

  /**
   * List sessions with optional pagination and status filter.
   *
   * If the API returns a raw array, the SDK wraps it in a `PaginatedResponse`
   * envelope with `limit` and `offset` fields (D-05).
   *
   * @param params - Optional filtering and pagination parameters (status, limit, offset).
   * @returns Paginated list of sessions.
   * @throws {ValidationError} If params fail schema validation.
   * @throws {AuthenticationError} If the API key is invalid (401).
   * @throws {RateLimitError} If the rate limit is exceeded (429).
   * @example
   * ```typescript
   * const { data, hasMore } = await client.sessions.list({ status: 'VERIFIED', limit: 10 });
   * data.forEach(session => console.log(session.id, session.status));
   * ```
   */
  async list(
    params?: z.input<typeof SessionListParamsSchema>,
  ): Promise<PaginatedResponse<Session>> {
    let validated: z.infer<typeof SessionListParamsSchema>;
    try {
      validated = SessionListParamsSchema.parse(params ?? {});
    } catch (err) {
      if (err instanceof z.ZodError) throw mapZodError(err);
      throw err;
    }
    const queryString = buildQueryString(validated);
    const raw = await this.client.get<Session[] | PaginatedResponse<Session>>(
      `/v1/sessions${queryString}`,
    );
    return wrapPaginated(raw, validated);
  }

  /**
   * Update session status. Only VERIFIED, REJECTED, and VOIDED are valid targets.
   *
   * PENDING and SUBMITTED cannot be set manually — they reflect applicant progress
   * and are set by the API. Passing an invalid status value throws at runtime
   * even if TypeScript types were bypassed (SESS-04).
   *
   * @param sessionId - The unique session identifier.
   * @param status - The target status update payload: 'VERIFIED', 'REJECTED', or 'VOIDED'.
   * @returns Updated session details.
   * @throws {ValidationError} If `sessionId` is empty or `status` is not a valid update target.
   * @throws {AuthenticationError} If the API key is invalid (401).
   * @throws {RateLimitError} If the rate limit is exceeded (429).
   * @throws {DeepIDVError} If the session is not found (404) or other API errors.
   * @example
   * ```typescript
   * const updated = await client.sessions.updateStatus('sess_abc123', 'VERIFIED');
   * console.log(updated.sessionRecord.status); // 'VERIFIED'
   * ```
   */
  async updateStatus(
    sessionId: string,
    status: z.infer<typeof SessionStatusUpdateSchema>,
  ): Promise<SessionRetrieveResult> {
    if (typeof sessionId !== 'string' || sessionId.trim() === '') {
      throw new ValidationError("expected non-empty string at 'sessionId'");
    }
    let validatedStatus: z.infer<typeof SessionStatusUpdateSchema>;
    try {
      validatedStatus = SessionStatusUpdateSchema.parse(status);
    } catch (err) {
      if (err instanceof z.ZodError) throw mapZodError(err);
      throw err;
    }
    return this.client.patch<SessionRetrieveResult>(
      `/v1/sessions/${encodeURIComponent(sessionId)}`,
      { status: validatedStatus },
    );
  }
}
