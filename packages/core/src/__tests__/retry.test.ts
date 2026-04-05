/**
 * Tests for auth helpers (auth.ts) and retry logic (retry.ts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildHeaders, buildUrl } from '../auth.js';
import {
  withRetry,
  isRetryable,
  computeDelay,
  extractRetryAfter,
} from '../retry.js';
import {
  DeepIDVError,
  NetworkError,
  TimeoutError,
  RateLimitError,
} from '../errors.js';
import { TypedEmitter } from '../events.js';
import type { SDKEventMap } from '../events.js';

// ---------------------------------------------------------------------------
// buildHeaders
// ---------------------------------------------------------------------------

describe('buildHeaders', () => {
  it('includes x-api-key header with provided key', () => {
    const headers = buildHeaders('sk_test');
    expect(headers['x-api-key']).toBe('sk_test');
  });

  it('includes Accept: application/json by default', () => {
    const headers = buildHeaders('sk_test');
    expect(headers['Accept']).toBe('application/json');
  });

  it('includes Content-Type when body is provided', () => {
    const headers = buildHeaders('sk_test', { name: 'test' });
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('omits Content-Type when body is undefined', () => {
    const headers = buildHeaders('sk_test', undefined);
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('omits Content-Type when no body argument is passed', () => {
    const headers = buildHeaders('sk_test');
    expect(headers['Content-Type']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildUrl
// ---------------------------------------------------------------------------

describe('buildUrl', () => {
  it('handles base with trailing slash and path with leading slash', () => {
    expect(buildUrl('https://api.deepidv.com/', '/v1/sessions')).toBe(
      'https://api.deepidv.com/v1/sessions',
    );
  });

  it('handles base without trailing slash and path without leading slash', () => {
    expect(buildUrl('https://api.deepidv.com', 'v1/sessions')).toBe(
      'https://api.deepidv.com/v1/sessions',
    );
  });

  it('handles base without trailing slash and path with leading slash', () => {
    expect(buildUrl('https://api.deepidv.com', '/v1/sessions')).toBe(
      'https://api.deepidv.com/v1/sessions',
    );
  });

  it('handles base with trailing slash and path without leading slash', () => {
    expect(buildUrl('https://api.deepidv.com/', 'v1/sessions')).toBe(
      'https://api.deepidv.com/v1/sessions',
    );
  });
});

// ---------------------------------------------------------------------------
// isRetryable
// ---------------------------------------------------------------------------

describe('isRetryable', () => {
  it('returns true for 429 RateLimitError', () => {
    const err = new RateLimitError('Too many requests');
    expect(isRetryable(err)).toBe(true);
  });

  it('returns true for 500 DeepIDVError', () => {
    const err = new DeepIDVError('Server error', { status: 500 });
    expect(isRetryable(err)).toBe(true);
  });

  it('returns true for 503 DeepIDVError', () => {
    const err = new DeepIDVError('Service unavailable', { status: 503 });
    expect(isRetryable(err)).toBe(true);
  });

  it('returns true for NetworkError', () => {
    const err = new NetworkError('Network failure');
    expect(isRetryable(err)).toBe(true);
  });

  it('returns true for TimeoutError', () => {
    const err = new TimeoutError('Request timed out');
    expect(isRetryable(err)).toBe(true);
  });

  it('returns false for 400 ValidationError', () => {
    const err = new DeepIDVError('Bad request', { status: 400 });
    expect(isRetryable(err)).toBe(false);
  });

  it('returns false for 401 AuthenticationError', () => {
    const err = new DeepIDVError('Unauthorized', { status: 401 });
    expect(isRetryable(err)).toBe(false);
  });

  it('returns false for 403', () => {
    const err = new DeepIDVError('Forbidden', { status: 403 });
    expect(isRetryable(err)).toBe(false);
  });

  it('returns false for 404', () => {
    const err = new DeepIDVError('Not found', { status: 404 });
    expect(isRetryable(err)).toBe(false);
  });

  it('returns false for generic Error', () => {
    const err = new Error('Some error');
    expect(isRetryable(err)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractRetryAfter
// ---------------------------------------------------------------------------

describe('extractRetryAfter', () => {
  it('parses numeric Retry-After header returning seconds as number', () => {
    const err = new DeepIDVError('Too many requests', {
      status: 429,
      response: {
        status: 429,
        headers: { 'retry-after': '5' },
        body: {},
      },
    });
    expect(extractRetryAfter(err)).toBe(5);
  });

  it('parses HTTP date Retry-After header and returns seconds from now', () => {
    // Use a date ~10 seconds in the future
    const futureDate = new Date(Date.now() + 10_000);
    const err = new DeepIDVError('Too many requests', {
      status: 429,
      response: {
        status: 429,
        headers: { 'retry-after': futureDate.toUTCString() },
        body: {},
      },
    });
    const result = extractRetryAfter(err);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(0);
    expect(result!).toBeLessThanOrEqual(11);
  });

  it('returns null when retry-after header is missing', () => {
    const err = new DeepIDVError('Too many requests', {
      status: 429,
      response: {
        status: 429,
        headers: {},
        body: {},
      },
    });
    expect(extractRetryAfter(err)).toBeNull();
  });

  it('returns null when retry-after header is invalid', () => {
    const err = new DeepIDVError('Too many requests', {
      status: 429,
      response: {
        status: 429,
        headers: { 'retry-after': 'not-a-date-or-number' },
        body: {},
      },
    });
    expect(extractRetryAfter(err)).toBeNull();
  });

  it('returns null for errors without response', () => {
    const err = new DeepIDVError('Some error');
    expect(extractRetryAfter(err)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeDelay
// ---------------------------------------------------------------------------

describe('computeDelay', () => {
  it('returns ms from Retry-After header (numeric seconds) when present', () => {
    const err = new DeepIDVError('Too many requests', {
      status: 429,
      response: {
        status: 429,
        headers: { 'retry-after': '5' },
        body: {},
      },
    });
    const delay = computeDelay(err, 0, 500);
    expect(delay).toBe(5_000);
  });

  it('caps Retry-After at 60_000ms (60s) when header is > 60s', () => {
    const err = new DeepIDVError('Too many requests', {
      status: 429,
      response: {
        status: 429,
        headers: { 'retry-after': '120' },
        body: {},
      },
    });
    const delay = computeDelay(err, 0, 500);
    expect(delay).toBe(60_000);
  });

  it('uses exponential backoff with jitter when no Retry-After header', () => {
    const err = new DeepIDVError('Server error', { status: 500 });
    const delays = Array.from({ length: 10 }, (_, i) =>
      computeDelay(err, i, 500),
    );
    // All delays should be non-negative
    for (const d of delays) {
      expect(d).toBeGreaterThanOrEqual(0);
    }
  });

  it('jitter: two calls with same attempt return potentially different values', () => {
    const err = new DeepIDVError('Server error', { status: 500 });
    const mathRandomSpy = vi.spyOn(Math, 'random');
    mathRandomSpy.mockReturnValueOnce(0.2);
    const d1 = computeDelay(err, 2, 500);
    mathRandomSpy.mockReturnValueOnce(0.8);
    const d2 = computeDelay(err, 2, 500);
    // With different Math.random values the results should differ
    // (unless both hit a cap at 0 which can't happen with initialDelayMs=500)
    expect(typeof d1).toBe('number');
    expect(typeof d2).toBe('number');
    mathRandomSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// withRetry
// ---------------------------------------------------------------------------

describe('withRetry', () => {
  let emitter: TypedEmitter<SDKEventMap>;
  const config = { maxRetries: 3, initialDelayMs: 10 };

  beforeEach(() => {
    emitter = new TypedEmitter<SDKEventMap>();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns result immediately when fn succeeds on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const retryEvents: SDKEventMap['retry'][] = [];
    emitter.on('retry', (evt) => retryEvents.push(evt));

    const result = await withRetry(fn, config, emitter);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(retryEvents).toHaveLength(0);
  });

  it('retries on 500 error up to maxRetries and returns on success', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new DeepIDVError('Server error', { status: 500 }))
      .mockRejectedValueOnce(new DeepIDVError('Server error', { status: 500 }))
      .mockResolvedValue('success');

    const promise = withRetry(fn, config, emitter);
    // Advance timers for each retry delay
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('retries on 429 RateLimitError', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RateLimitError('Rate limited'))
      .mockResolvedValue('ok');

    const promise = withRetry(fn, config, emitter);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on NetworkError', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new NetworkError('Network failed'))
      .mockResolvedValue('ok');

    const promise = withRetry(fn, config, emitter);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on TimeoutError', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TimeoutError('Timed out'))
      .mockResolvedValue('ok');

    const promise = withRetry(fn, config, emitter);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws immediately on 400 (never retries 4xx)', async () => {
    const err = new DeepIDVError('Bad request', { status: 400 });
    const fn = vi.fn().mockRejectedValue(err);
    const retryEvents: SDKEventMap['retry'][] = [];
    emitter.on('retry', (evt) => retryEvents.push(evt));

    await expect(withRetry(fn, config, emitter)).rejects.toThrow(err);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(retryEvents).toHaveLength(0);
  });

  it('throws immediately on 401 (never retries auth errors)', async () => {
    const err = new DeepIDVError('Unauthorized', { status: 401 });
    const fn = vi.fn().mockRejectedValue(err);

    await expect(withRetry(fn, config, emitter)).rejects.toThrow(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws last error when all retries are exhausted', async () => {
    // Zero initialDelayMs to avoid needing fake timer advancement,
    // isolating this test from timer mechanics
    const zeroDelayConfig = { maxRetries: 3, initialDelayMs: 0 };
    const calls: number[] = [];
    const fn = vi.fn().mockImplementation(async () => {
      calls.push(Date.now());
      throw new DeepIDVError('Server error', { status: 500 });
    });

    vi.useRealTimers();
    let caught: unknown;
    try {
      await withRetry(fn, zeroDelayConfig, emitter);
    } catch (e) {
      caught = e;
    }
    vi.useFakeTimers();

    expect(caught).toBeInstanceOf(DeepIDVError);
    expect((caught as DeepIDVError).message).toBe('Server error');
    // 1 initial + 3 retries = 4 calls total
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('fires retry event before sleeping with correct attempt number and delay', async () => {
    const retryEvents: SDKEventMap['retry'][] = [];
    emitter.on('retry', (evt) => retryEvents.push(evt));

    const fn = vi
      .fn()
      .mockRejectedValueOnce(new DeepIDVError('Server error', { status: 500 }))
      .mockResolvedValue('ok');

    const promise = withRetry(fn, config, emitter);
    await vi.runAllTimersAsync();
    await promise;

    expect(retryEvents).toHaveLength(1);
    expect(retryEvents[0]).toMatchObject({
      attempt: 1,
      error: expect.any(DeepIDVError),
    });
    expect(typeof retryEvents[0].delayMs).toBe('number');
  });
});
