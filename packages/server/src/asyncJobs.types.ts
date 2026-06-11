/**
 * Zod schemas and inferred TypeScript types for the async-jobs module.
 *
 * The server already emits the public lowercase shape, so the SDK parses the
 * `GET /v1/async-jobs/{jobId}` wire response directly through a single
 * discriminated union (`AsyncJobSnapshotSchema`) — no raw→public transform.
 *
 * Server-shape notes (reflected as-is):
 * - `status` is lowercase (`pending|processing|ready|failed`).
 * - there is **no** `type` field.
 * - `createdAt` is epoch **seconds** (a number); `updatedAt` is an ISO string.
 *
 * @module asyncJobs.types
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Public snapshot (direct mirror of the server's async-job view)
// ---------------------------------------------------------------------------

/**
 * Public async job status enum (lowercase, as emitted by the server).
 */
export const AsyncJobStatusSchema = z.enum(['pending', 'processing', 'ready', 'failed']);

/**
 * Discriminated-union snapshot returned by `asyncJobs.get()`, parsed directly
 * from the wire response.
 *
 * `result` is typed as `unknown` because the async-jobs surface is
 * service-agnostic. Service-specific consumers (e.g. `AdverseMediaHandle`)
 * re-parse `result` against a typed schema to narrow it.
 */
export const AsyncJobSnapshotSchema = z.discriminatedUnion('status', [
  z.object({
    jobId: z.string(),
    createdAt: z.number(),
    updatedAt: z.string(),
    status: z.literal('pending'),
  }),
  z.object({
    jobId: z.string(),
    createdAt: z.number(),
    updatedAt: z.string(),
    status: z.literal('processing'),
  }),
  z.object({
    jobId: z.string(),
    createdAt: z.number(),
    updatedAt: z.string(),
    status: z.literal('ready'),
    result: z.unknown(),
  }),
  z.object({
    jobId: z.string(),
    createdAt: z.number(),
    updatedAt: z.string(),
    status: z.literal('failed'),
    error: z.string(),
  }),
]);

// ---------------------------------------------------------------------------
// Exported inferred types (z.infer only — no separate interface declarations)
// ---------------------------------------------------------------------------

/** Public lowercase status values. */
export type AsyncJobStatus = z.infer<typeof AsyncJobStatusSchema>;

/** Public snapshot returned by `asyncJobs.get()`. */
export type AsyncJobSnapshot = z.infer<typeof AsyncJobSnapshotSchema>;
