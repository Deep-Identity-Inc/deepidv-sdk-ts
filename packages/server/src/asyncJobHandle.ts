/**
 * AdverseMediaHandle factory.
 *
 * Encapsulates the polling lifecycle for an adverse-media async job:
 * - `.wait(opts?)` — auto-polls until terminal state; returns the typed
 *   `AdverseMediaResult` or throws `AdverseMediaFailedError` / `PollTimeoutError`.
 * - `.refresh()` — single non-blocking GET returning the narrowed snapshot.
 *
 * The handle is returned by `screening.adverseMedia(input)` and uses the
 * injected `AsyncJobs` instance under the hood, so polling errors get the
 * same error mapping as any other SDK call.
 *
 * @module asyncJobHandle
 */

import { AdverseMediaFailedError, PollTimeoutError } from '@deepidv/core';
import type { AsyncJobs } from './asyncJobs.js';
import {
  AdverseMediaJobSnapshotSchema,
  type AdverseMediaJobSnapshot,
  type AdverseMediaResult,
} from './screening.types.js';

const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_TIMEOUT_MS = 180_000;

/**
 * Options for `AdverseMediaHandle.wait()`.
 */
export interface AdverseMediaWaitOptions {
  /** Interval between polls in milliseconds. Defaults to `2000`. */
  pollIntervalMs?: number;
  /**
   * Total wait budget in milliseconds. Defaults to `180_000` (3 minutes).
   * When exceeded, `wait()` throws `PollTimeoutError` — the job may still
   * complete server-side; poll again with `client.asyncJobs.get(jobId)`.
   */
  timeoutMs?: number;
}

/**
 * Handle returned by `client.screening.adverseMedia(input)`.
 *
 * The original POST returned `jobId` immediately; result delivery is async.
 * Use `.wait()` to block until completion, or `.refresh()` for a single
 * snapshot without blocking.
 *
 * The handle is safe to destructure — `wait` and `refresh` close over
 * their dependencies rather than relying on `this`.
 */
export interface AdverseMediaHandle {
  /**
   * Server-side job ID. Persist this if the caller wants to resume polling
   * across process restarts (e.g. via `client.asyncJobs.get(jobId)`).
   */
  readonly jobId: string;
  /**
   * Auto-polls until the job reaches `ready` or `failed`, or `timeoutMs`
   * elapses. Returns the typed `AdverseMediaResult` on success.
   *
   * @throws {AdverseMediaFailedError} If the job terminates in `failed`.
   * @throws {PollTimeoutError} If `timeoutMs` elapses before completion. This
   *   does **not** mean the job died — it may still complete server-side.
   *   Resume by polling `client.asyncJobs.get(jobId)`.
   * @throws Other request errors (auth/network/5xx) propagated from the polling GET.
   */
  wait(options?: AdverseMediaWaitOptions): Promise<AdverseMediaResult>;
  /**
   * Performs a single poll and returns the current narrowed snapshot.
   * Non-blocking — does not loop.
   */
  refresh(): Promise<AdverseMediaJobSnapshot>;
}

/**
 * Creates an `AdverseMediaHandle` bound to the given `jobId`.
 *
 * Internal — instantiated by `screening.adverseMedia()`. The handle is
 * returned to the caller via the public namespace; this factory is not
 * exported from the package surface.
 */
export function createAdverseMediaHandle(jobId: string, asyncJobs: AsyncJobs): AdverseMediaHandle {
  const refresh = async (): Promise<AdverseMediaJobSnapshot> => {
    const generic = await asyncJobs.get(jobId);
    // The server emits lowercase statuses directly. Narrow `result` to
    // AdverseMediaResult by re-parsing through the adverse-media schema on `ready`.
    if (generic.status === 'ready') {
      return AdverseMediaJobSnapshotSchema.parse({
        status: 'ready',
        result: generic.result,
      });
    }
    if (generic.status === 'failed') {
      return { status: 'failed', error: generic.error };
    }
    return { status: generic.status };
  };

  const wait = async (options?: AdverseMediaWaitOptions): Promise<AdverseMediaResult> => {
    const pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      const snapshot = await refresh();
      if (snapshot.status === 'ready') return snapshot.result;
      if (snapshot.status === 'failed') {
        throw new AdverseMediaFailedError(snapshot.error, { jobId });
      }

      // pending or processing — sleep, then poll again
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new PollTimeoutError(
          `Adverse-media job ${jobId} did not complete within ${String(timeoutMs)}ms`,
          { timeoutMs, jobId },
        );
      }

      const sleepFor = Math.min(pollIntervalMs, remaining);
      await new Promise<void>((resolve) => setTimeout(resolve, sleepFor));
    }
  };

  return { jobId, refresh, wait };
}
