/**
 * Retry logic with exponential backoff and jitter for the deepidv SDK.
 *
 * Retry policy (from PROJECT.md):
 * - Retries on: 429, 5xx, NetworkError, TimeoutError
 * - Never retries: 4xx (except 429), or non-DeepIDV errors
 * - Delay: exponential backoff with jitter; Retry-After header honored with 60s cap (D-02)
 * - Retry event fires before sleeping (D-04)
 *
 * @module retry
 */

import type { TypedEmitter } from './events.js';
import type { SDKEventMap } from './events.js';
import { DeepIDVError, NetworkError, TimeoutError } from './errors.js';

/**
 * Maximum delay enforced even when the `Retry-After` header requests more (D-02).
 * Set to 60 seconds.
 */
const RETRY_AFTER_CAP_MS = 60_000;

/**
 * Maximum value for exponential backoff before jitter is applied.
 */
const MAX_BACKOFF_MS = 30_000;

/**
 * Determines whether a thrown error should trigger a retry attempt.
 *
 * Retryable conditions:
 * - HTTP 429 (RateLimitError or DeepIDVError with status 429)
 * - HTTP 5xx (status >= 500 and <= 599)
 * - {@link NetworkError}
 * - {@link TimeoutError}
 *
 * @param err - The error to evaluate.
 * @returns `true` if the request should be retried, `false` otherwise.
 */
export function isRetryable(err: unknown): boolean {
  if (err instanceof TimeoutError) return true;
  if (err instanceof NetworkError) return true;
  if (err instanceof DeepIDVError) {
    const status = err.status;
    if (status === 429) return true;
    if (status !== undefined && status >= 500 && status <= 599) return true;
    return false;
  }
  return false;
}

/**
 * Extracts the `Retry-After` header value in seconds from an error's raw response.
 *
 * Supports:
 * - Numeric strings: `"5"` → `5`
 * - HTTP-date strings: `"Mon, 07 Apr 2025 00:00:00 GMT"` → seconds from now
 *
 * @param err - A {@link DeepIDVError} that may carry a raw HTTP response.
 * @returns Number of seconds to wait, or `null` if not parseable.
 */
export function extractRetryAfter(err: unknown): number | null {
  if (!(err instanceof DeepIDVError)) return null;
  const raw = err.response?.headers?.['retry-after'];
  if (!raw) return null;

  // Try numeric first
  const numeric = parseInt(raw, 10);
  if (!isNaN(numeric)) {
    return numeric;
  }

  // Try HTTP date
  const dateMs = Date.parse(raw);
  if (!isNaN(dateMs)) {
    const seconds = Math.ceil((dateMs - Date.now()) / 1_000);
    return seconds > 0 ? seconds : 0;
  }

  return null;
}

/**
 * Computes the delay in milliseconds before the next retry attempt.
 *
 * Priority:
 * 1. If the error has a `Retry-After` header, use it (capped at {@link RETRY_AFTER_CAP_MS}).
 * 2. Otherwise, exponential backoff with full jitter:
 *    `Math.random() * min(initialDelayMs * 2^attempt, MAX_BACKOFF_MS)`
 *
 * @param err - The error from the failed attempt.
 * @param attempt - Zero-based attempt index (0 = first retry).
 * @param initialDelayMs - Initial delay for exponential backoff calculation.
 * @returns Delay in milliseconds.
 */
export function computeDelay(
  err: unknown,
  attempt: number,
  initialDelayMs: number,
): number {
  const retryAfterSeconds = extractRetryAfter(err);
  if (retryAfterSeconds !== null) {
    return Math.min(retryAfterSeconds * 1_000, RETRY_AFTER_CAP_MS);
  }

  // Exponential backoff with full jitter
  const cap = Math.min(initialDelayMs * Math.pow(2, attempt), MAX_BACKOFF_MS);
  return Math.floor(Math.random() * cap);
}

/**
 * Wraps an async function with retry logic.
 *
 * - Retries up to `config.maxRetries` times for retryable errors.
 * - Fires the `retry` event on the emitter BEFORE sleeping (D-04).
 * - Throws the last error if all retries are exhausted.
 * - Throws immediately for non-retryable errors.
 *
 * @param fn - Async function to call. Called once per attempt.
 * @param config - Retry configuration.
 * @param config.maxRetries - Maximum number of retry attempts (not counting the initial).
 * @param config.initialDelayMs - Initial delay for exponential backoff.
 * @param emitter - Event emitter for `retry` lifecycle events.
 * @returns The resolved value of `fn` on success.
 * @throws The last error if all retries are exhausted, or immediately if non-retryable.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: { maxRetries: number; initialDelayMs: number },
  emitter: TypedEmitter<SDKEventMap>,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (!isRetryable(err) || attempt === config.maxRetries) {
        throw err;
      }

      const delayMs = computeDelay(err, attempt, config.initialDelayMs);

      // Fire retry event BEFORE sleeping (D-04)
      emitter.emit('retry', { attempt: attempt + 1, delayMs, error: err });

      await sleep(delayMs);
    }
  }

  // This path is unreachable but TypeScript needs the throw
  throw lastError;
}

/**
 * Returns a promise that resolves after the given number of milliseconds.
 *
 * @param ms - Duration in milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
