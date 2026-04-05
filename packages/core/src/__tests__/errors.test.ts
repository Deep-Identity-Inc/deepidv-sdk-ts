import { describe, expect, it } from 'vitest';
import {
  AuthenticationError,
  DeepIDVError,
  NetworkError,
  RateLimitError,
  TimeoutError,
  ValidationError,
} from '../errors.js';
import {
  DEFAULT_BASE_URL,
  DEFAULT_INITIAL_DELAY,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT,
  resolveConfig,
} from '../config.js';

// ── DeepIDVError ────────────────────────────────────────────────────────────

describe('DeepIDVError', () => {
  it('stores status and code from options', () => {
    const err = new DeepIDVError('test message', { status: 500, code: 'server_error' });
    expect(err.status).toBe(500);
    expect(err.code).toBe('server_error');
    expect(err.message).toBe('test message');
  });

  it('instanceof works (Object.setPrototypeOf fix)', () => {
    const err = new DeepIDVError('msg', {});
    expect(err instanceof DeepIDVError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });

  it('toJSON() returns structured object (D-08)', () => {
    const err = new DeepIDVError('oops', { status: 500, code: 'server_error' });
    const json = err.toJSON();
    expect(json).toMatchObject({
      type: 'DeepIDVError',
      message: 'oops',
      status: 500,
      code: 'server_error',
    });
  });

  it('JSON.stringify works via toJSON()', () => {
    const err = new DeepIDVError('msg', { status: 400, code: 'bad_request' });
    const parsed = JSON.parse(JSON.stringify(err)) as Record<string, unknown>;
    expect(parsed.type).toBe('DeepIDVError');
    expect(parsed.message).toBe('msg');
  });

  it('.response stores raw response (D-06)', () => {
    const raw = { status: 500, headers: { 'content-type': 'application/json' }, body: { error: 'oops' } };
    const err = new DeepIDVError('msg', { response: raw });
    expect(err.response).toStrictEqual(raw);
  });

  it('.cause preserves original error (D-07)', () => {
    const inner = new Error('inner cause');
    const err = new DeepIDVError('outer', { cause: inner });
    expect(err.cause).toBe(inner);
  });

  it('no status or code when not provided', () => {
    const err = new DeepIDVError('plain');
    expect(err.status).toBeUndefined();
    expect(err.code).toBeUndefined();
  });
});

// ── AuthenticationError ─────────────────────────────────────────────────────

describe('AuthenticationError', () => {
  it('has status 401 and code authentication_error', () => {
    const err = new AuthenticationError('Unauthorized', 'sk_live_abc123def');
    expect(err.status).toBe(401);
    expect(err.code).toBe('authentication_error');
  });

  it('redacts API key to last 4 chars (D-05)', () => {
    const err = new AuthenticationError('Unauthorized', 'sk_live_abc123def');
    expect(err.redactedKey).toBe('sk_...3def');
  });

  it('redacts short key (<= 4 chars) to ****', () => {
    const err = new AuthenticationError('Unauthorized', 'abcd');
    expect(err.redactedKey).toBe('****');
  });

  it('toJSON includes redactedKey, never the full key', () => {
    const apiKey = 'sk_live_abc123def';
    const err = new AuthenticationError('Unauthorized', apiKey);
    const json = JSON.stringify(err);
    expect(json).toContain('sk_...3def');
    expect(json).not.toContain(apiKey);
  });

  it('instanceof DeepIDVError returns true', () => {
    const err = new AuthenticationError('Unauthorized', 'sk_live_abc123def');
    expect(err instanceof AuthenticationError).toBe(true);
    expect(err instanceof DeepIDVError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });
});

// ── RateLimitError ──────────────────────────────────────────────────────────

describe('RateLimitError', () => {
  it('has status 429 and code rate_limit_error', () => {
    const err = new RateLimitError('Too many requests');
    expect(err.status).toBe(429);
    expect(err.code).toBe('rate_limit_error');
  });

  it('stores retryAfter value', () => {
    const err = new RateLimitError('rate limited', { retryAfter: 5 });
    expect(err.retryAfter).toBe(5);
  });

  it('retryAfter is undefined when not provided', () => {
    const err = new RateLimitError('rate limited');
    expect(err.retryAfter).toBeUndefined();
  });

  it('instanceof DeepIDVError returns true', () => {
    const err = new RateLimitError('rate limited');
    expect(err instanceof RateLimitError).toBe(true);
    expect(err instanceof DeepIDVError).toBe(true);
  });
});

// ── ValidationError ─────────────────────────────────────────────────────────

describe('ValidationError', () => {
  it('has status 400 and code validation_error', () => {
    const err = new ValidationError('Invalid input');
    expect(err.status).toBe(400);
    expect(err.code).toBe('validation_error');
  });

  it('instanceof DeepIDVError returns true', () => {
    const err = new ValidationError('msg');
    expect(err instanceof ValidationError).toBe(true);
    expect(err instanceof DeepIDVError).toBe(true);
  });
});

// ── NetworkError ─────────────────────────────────────────────────────────────

describe('NetworkError', () => {
  it('has code network_error and no status', () => {
    const err = new NetworkError('Connection refused');
    expect(err.code).toBe('network_error');
    expect(err.status).toBeUndefined();
  });

  it('instanceof DeepIDVError returns true', () => {
    const err = new NetworkError('msg');
    expect(err instanceof NetworkError).toBe(true);
    expect(err instanceof DeepIDVError).toBe(true);
  });
});

// ── TimeoutError ─────────────────────────────────────────────────────────────

describe('TimeoutError', () => {
  it('has code timeout_error and no status', () => {
    const err = new TimeoutError('Request timed out');
    expect(err.code).toBe('timeout_error');
    expect(err.status).toBeUndefined();
  });

  it('instanceof DeepIDVError returns true', () => {
    const err = new TimeoutError('msg');
    expect(err instanceof TimeoutError).toBe(true);
    expect(err instanceof DeepIDVError).toBe(true);
  });
});

// ── Error cause chain (ERR-06) ──────────────────────────────────────────────

describe('Error cause chain (ERR-06)', () => {
  it('preserves cause through error hierarchy', () => {
    const inner = new Error('inner');
    const outer = new DeepIDVError('outer', { cause: inner });
    expect((outer.cause as Error).message).toBe('inner');
  });

  it('AuthenticationError preserves cause', () => {
    const inner = new Error('inner');
    const err = new AuthenticationError('outer', 'sk_key', { cause: inner });
    expect((err.cause as Error).message).toBe('inner');
  });
});

// ── Config ──────────────────────────────────────────────────────────────────

describe('resolveConfig', () => {
  it('returns defaults when only apiKey provided', () => {
    const config = resolveConfig({ apiKey: 'sk_test' });
    expect(config.baseUrl).toBe(DEFAULT_BASE_URL);
    expect(config.timeout).toBe(DEFAULT_TIMEOUT);
    expect(config.maxRetries).toBe(DEFAULT_MAX_RETRIES);
    expect(config.initialRetryDelay).toBe(DEFAULT_INITIAL_DELAY);
    expect(config.fetch).toBe(globalThis.fetch);
  });

  it('strips trailing slash from baseUrl', () => {
    const config = resolveConfig({ apiKey: 'sk_test', baseUrl: 'https://api.example.com/' });
    expect(config.baseUrl).toBe('https://api.example.com');
  });

  it('overrides defaults with provided values', () => {
    const customFetch = () => Promise.resolve(new Response());
    const config = resolveConfig({
      apiKey: 'sk_test',
      timeout: 10_000,
      maxRetries: 1,
      initialRetryDelay: 250,
      fetch: customFetch as typeof globalThis.fetch,
    });
    expect(config.timeout).toBe(10_000);
    expect(config.maxRetries).toBe(1);
    expect(config.initialRetryDelay).toBe(250);
    expect(config.fetch).toBe(customFetch);
  });

  it('DEFAULT_BASE_URL is https://api.deepidv.com', () => {
    expect(DEFAULT_BASE_URL).toBe('https://api.deepidv.com');
  });

  it('DEFAULT_TIMEOUT is 30 seconds (30000ms)', () => {
    expect(DEFAULT_TIMEOUT).toBe(30_000);
  });

  it('DEFAULT_MAX_RETRIES is 3', () => {
    expect(DEFAULT_MAX_RETRIES).toBe(3);
  });

  it('DEFAULT_INITIAL_DELAY is 500ms', () => {
    expect(DEFAULT_INITIAL_DELAY).toBe(500);
  });
});
