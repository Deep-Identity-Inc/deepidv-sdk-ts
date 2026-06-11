/**
 * Async-jobs service module.
 *
 * Wraps `GET /v1/async-jobs/{jobId}` so callers can poll long-running
 * server-side operations. The wire response is parsed directly through
 * `AsyncJobSnapshotSchema` — the server already emits the public lowercase
 * shape, so no normalization layer is needed.
 *
 * Most callers should use the typed handle returned by the originating
 * method (e.g. `screening.adverseMedia(...)`). Direct access via
 * `client.asyncJobs.get(jobId)` is provided for callers who persisted
 * a `jobId` and want to resume polling later.
 *
 * @module asyncJobs
 */

import type { HttpClient } from '@deepidv/core';
import { ValidationError } from '@deepidv/core';
import { AsyncJobSnapshotSchema, type AsyncJobSnapshot } from './asyncJobs.types.js';

/**
 * Provides access to async-job state for long-running server-side operations.
 *
 * Instantiated by the main SDK client and receives `HttpClient` via
 * constructor injection (D-04). The injected client handles authentication,
 * retry logic, and error mapping.
 *
 * @example
 * ```typescript
 * const snapshot = await client.asyncJobs.get('job_abc123');
 * if (snapshot.status === 'ready') {
 *   console.log(snapshot.result);
 * } else if (snapshot.status === 'failed') {
 *   console.error(snapshot.error);
 * }
 * ```
 */
export class AsyncJobs {
  constructor(private readonly client: HttpClient) {}

  /**
   * Fetch the current state of an async job by ID.
   *
   * Returns a discriminated-union snapshot keyed on `status`. `result` is
   * typed as `unknown` since the async-jobs surface is service-agnostic —
   * service-specific consumers re-parse it through a typed schema (e.g.
   * `AdverseMediaResultSchema`) to narrow it.
   *
   * @param jobId - Server-side job identifier returned by the originating call.
   * @throws {ValidationError} If `jobId` is empty or not a string.
   * @throws {AuthenticationError} If the API key is invalid (401).
   * @throws {AuthorizationError} If the job belongs to a different organization (403).
   * @throws {NotFoundError} If the job ID is unknown or has been pruned by TTL (404).
   * @throws {DeepIDVError} For other API errors.
   */
  async get(jobId: string): Promise<AsyncJobSnapshot> {
    if (typeof jobId !== 'string' || jobId.trim() === '') {
      throw new ValidationError("expected non-empty string at 'jobId'");
    }
    const raw = await this.client.get<unknown>(`/v1/async-jobs/${encodeURIComponent(jobId)}`);
    return AsyncJobSnapshotSchema.parse(raw);
  }
}
