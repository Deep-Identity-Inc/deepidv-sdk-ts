/**
 * Zod schemas and inferred TypeScript types for the async-jobs module.
 *
 * Defines two layers:
 * - the raw server response shape (`RawAsyncJobResponseSchema`) with the
 *   server's uppercase status enum, and
 * - the public, normalized snapshot (`AsyncJobSnapshotSchema`) with a
 *   lowercase discriminated-union status and a clean variant payload.
 *
 * The transform `AsyncJobResponseSchema` maps raw → public in a single
 * parse step so consumers of `asyncJobs.get()` never see the server enums.
 *
 * @module asyncJobs.types
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Raw server response (server emits uppercase status names)
// ---------------------------------------------------------------------------

/**
 * Server-emitted async job status enum.
 *
 * Mapped to the public lowercase form (`AsyncJobStatus`) by the transform
 * below — consumers of the SDK never see these values.
 */
export const RawAsyncJobStatusSchema = z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']);

/**
 * Raw response shape returned by `GET /v1/async-jobs/{jobId}`.
 *
 * Internal — the public API surface is `AsyncJobSnapshot`, produced by
 * `AsyncJobResponseSchema` (the transform below).
 */
export const RawAsyncJobResponseSchema = z
  .object({
    jobId: z.string(),
    type: z.string(),
    status: RawAsyncJobStatusSchema,
    result: z.unknown().nullable(),
    error: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strip();

// ---------------------------------------------------------------------------
// Public snapshot (lowercase status, discriminated union payload)
// ---------------------------------------------------------------------------

/**
 * Public async job status enum.
 *
 * Status name mapping (raw → public):
 * - `PENDING` → `'pending'`
 * - `PROCESSING` → `'processing'`
 * - `COMPLETED` → `'ready'`
 * - `FAILED` → `'failed'`
 */
export const AsyncJobStatusSchema = z.enum(['pending', 'processing', 'ready', 'failed']);

/**
 * Public discriminated-union snapshot returned by `asyncJobs.get()`.
 *
 * `result` is typed as `unknown` because the async-jobs surface is
 * service-agnostic. Service-specific consumers (e.g. `AdverseMediaHandle`)
 * re-parse `result` against a typed schema to narrow it.
 */
export const AsyncJobSnapshotSchema = z.discriminatedUnion('status', [
  z.object({
    jobId: z.string(),
    type: z.string(),
    status: z.literal('pending'),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  z.object({
    jobId: z.string(),
    type: z.string(),
    status: z.literal('processing'),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  z.object({
    jobId: z.string(),
    type: z.string(),
    status: z.literal('ready'),
    result: z.unknown(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  z.object({
    jobId: z.string(),
    type: z.string(),
    status: z.literal('failed'),
    error: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
]);

// ---------------------------------------------------------------------------
// Transform: raw → public
// ---------------------------------------------------------------------------

/**
 * Type alias for the public snapshot, used to constrain the transform output.
 */
type AsyncJobSnapshotType = z.infer<typeof AsyncJobSnapshotSchema>;

/**
 * Parses the raw `GET /v1/async-jobs/{jobId}` response and normalizes it to
 * the public `AsyncJobSnapshot` discriminated union.
 *
 * Use this in `asyncJobs.get()` instead of `RawAsyncJobResponseSchema` —
 * callers should never see the server enum names.
 *
 * Edge case: when a job ends in `FAILED` with no error string (theoretically
 * possible if the worker crashes before writing one), the snapshot surfaces
 * a generic message so the public type stays `error: string` (not nullable).
 */
export const AsyncJobResponseSchema = RawAsyncJobResponseSchema.transform(
  (raw): AsyncJobSnapshotType => {
    const base = {
      jobId: raw.jobId,
      type: raw.type,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
    switch (raw.status) {
      case 'PENDING':
        return { ...base, status: 'pending' };
      case 'PROCESSING':
        return { ...base, status: 'processing' };
      case 'COMPLETED':
        return { ...base, status: 'ready', result: raw.result };
      case 'FAILED':
        return {
          ...base,
          status: 'failed',
          error: raw.error ?? 'Job failed without error message',
        };
    }
  },
);

// ---------------------------------------------------------------------------
// Exported inferred types (z.infer only — no separate interface declarations)
// ---------------------------------------------------------------------------

/** Raw server status values (internal — exposed for advanced testing). */
export type RawAsyncJobStatus = z.infer<typeof RawAsyncJobStatusSchema>;

/** Public lowercase status values. */
export type AsyncJobStatus = z.infer<typeof AsyncJobStatusSchema>;

/** Public snapshot returned by `asyncJobs.get()`. */
export type AsyncJobSnapshot = z.infer<typeof AsyncJobSnapshotSchema>;
