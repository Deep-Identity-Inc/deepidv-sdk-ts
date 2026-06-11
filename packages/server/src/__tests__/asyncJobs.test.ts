/**
 * Tests for the AsyncJobs module.
 *
 * Uses msw + real HttpClient to intercept native fetch calls. The server
 * already emits the public lowercase shape, so `get()` parses the wire
 * response directly through `AsyncJobSnapshotSchema` — there is no raw→public
 * normalization layer to test. Covers direct parse of every status variant
 * (`createdAt` as a number, no `type` field) and HTTP error mapping.
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './setup.js';
import {
  resolveConfig,
  TypedEmitter,
  HttpClient,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
} from '@deepidv/core';
import { AsyncJobs } from '../asyncJobs.js';
import type { AsyncJobSnapshot } from '../asyncJobs.types.js';

const BASE_URL = 'https://api.deepidv.com';

/**
 * Builds a fresh AsyncJobs instance backed by a real HttpClient.
 * Retries disabled so tests are fast and deterministic.
 */
function createAsyncJobs() {
  const config = resolveConfig({
    apiKey: 'sk_test_key_1234',
    baseUrl: BASE_URL,
    timeout: 5_000,
    maxRetries: 0,
  });
  const emitter = new TypedEmitter();
  const client = new HttpClient(config, emitter);
  return new AsyncJobs(client);
}

// ---------------------------------------------------------------------------
// Mock data — public wire shape (lowercase status, numeric createdAt, no type)
// ---------------------------------------------------------------------------

const BASE_WIRE = {
  jobId: 'job_abc123',
  createdAt: 1_716_897_600, // epoch seconds (server quirk: number)
  updatedAt: '2026-05-28T12:01:00Z', // ISO string
};

// ---------------------------------------------------------------------------
// AsyncJobs.get — input validation
// ---------------------------------------------------------------------------

describe('AsyncJobs.get — input validation', () => {
  it('throws ValidationError on empty jobId', async () => {
    await expect(createAsyncJobs().get('')).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError on whitespace-only jobId', async () => {
    await expect(createAsyncJobs().get('   ')).rejects.toThrow(ValidationError);
  });
});

// ---------------------------------------------------------------------------
// AsyncJobs.get — direct parse of the lowercase wire shape
// ---------------------------------------------------------------------------

describe('AsyncJobs.get — direct parse', () => {
  it('parses a pending snapshot', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/async-jobs/job_abc123`, () =>
        HttpResponse.json({ ...BASE_WIRE, status: 'pending' }),
      ),
    );
    const snap = await createAsyncJobs().get('job_abc123');
    expect(snap.status).toBe('pending');
    expect(snap.jobId).toBe('job_abc123');
    // No `type` field on the public snapshot anymore.
    expect(snap).not.toHaveProperty('type');
  });

  it('parses a processing snapshot', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/async-jobs/job_abc123`, () =>
        HttpResponse.json({ ...BASE_WIRE, status: 'processing' }),
      ),
    );
    const snap = await createAsyncJobs().get('job_abc123');
    expect(snap.status).toBe('processing');
  });

  it('parses a ready snapshot and surfaces the result', async () => {
    const result = { totalHits: 5, summary: 'some-data' };
    server.use(
      http.get(`${BASE_URL}/v1/async-jobs/job_abc123`, () =>
        HttpResponse.json({ ...BASE_WIRE, status: 'ready', result }),
      ),
    );
    const snap = await createAsyncJobs().get('job_abc123');
    expect(snap.status).toBe('ready');
    if (snap.status === 'ready') {
      expect(snap.result).toEqual(result);
    }
  });

  it('parses a failed snapshot and surfaces the error string', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/async-jobs/job_abc123`, () =>
        HttpResponse.json({ ...BASE_WIRE, status: 'failed', error: 'upstream timeout' }),
      ),
    );
    const snap = await createAsyncJobs().get('job_abc123');
    expect(snap.status).toBe('failed');
    if (snap.status === 'failed') {
      expect(snap.error).toBe('upstream timeout');
    }
  });

  it('reflects createdAt as a number and updatedAt as a string', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/async-jobs/job_abc123`, () =>
        HttpResponse.json({ ...BASE_WIRE, status: 'pending' }),
      ),
    );
    const snap = await createAsyncJobs().get('job_abc123');
    expect(snap.createdAt).toBe(1_716_897_600);
    expect(typeof snap.createdAt).toBe('number');
    expect(snap.updatedAt).toBe('2026-05-28T12:01:00Z');
  });

  it('rejects a failed snapshot whose error is null (server always sends a string)', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/async-jobs/job_abc123`, () =>
        HttpResponse.json({ ...BASE_WIRE, status: 'failed', error: null }),
      ),
    );
    await expect(createAsyncJobs().get('job_abc123')).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// AsyncJobs.get — HTTP error mapping
// ---------------------------------------------------------------------------

describe('AsyncJobs.get — error mapping', () => {
  it('maps 404 → NotFoundError', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/async-jobs/:id`, () =>
        HttpResponse.json({ error: 'Not Found' }, { status: 404 }),
      ),
    );
    await expect(createAsyncJobs().get('job_missing')).rejects.toThrow(NotFoundError);
  });

  it('maps 403 → AuthorizationError (cross-org access)', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/async-jobs/:id`, () =>
        HttpResponse.json({ error: 'Forbidden' }, { status: 403 }),
      ),
    );
    await expect(createAsyncJobs().get('job_other_org')).rejects.toThrow(AuthorizationError);
  });

  it('maps 401 → AuthenticationError', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/async-jobs/:id`, () =>
        HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      ),
    );
    await expect(createAsyncJobs().get('job_x')).rejects.toThrow(AuthenticationError);
  });
});

// ---------------------------------------------------------------------------
// AsyncJobs.get — URL handling
// ---------------------------------------------------------------------------

describe('AsyncJobs.get — URL handling', () => {
  it('URL-encodes the jobId in the request path', async () => {
    let capturedUrl: string | null = null;
    server.use(
      http.get(`${BASE_URL}/v1/async-jobs/:id`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          ...BASE_WIRE,
          jobId: 'job/with-slash',
          status: 'pending',
        });
      }),
    );
    await createAsyncJobs().get('job/with-slash');
    expect(capturedUrl).toContain('job%2Fwith-slash');
  });
});

// ---------------------------------------------------------------------------
// Type-level contract — no `type`, createdAt is number
// ---------------------------------------------------------------------------

describe('AsyncJobSnapshot — type-level contract', () => {
  it('has no `type`, a numeric createdAt and a string updatedAt', () => {
    expectTypeOf<AsyncJobSnapshot['status']>().toEqualTypeOf<
      'pending' | 'processing' | 'ready' | 'failed'
    >();
    expectTypeOf<AsyncJobSnapshot['createdAt']>().toEqualTypeOf<number>();
    expectTypeOf<AsyncJobSnapshot['updatedAt']>().toEqualTypeOf<string>();
    expectTypeOf<AsyncJobSnapshot>().not.toHaveProperty('type');

    type Ready = Extract<AsyncJobSnapshot, { status: 'ready' }>;
    expectTypeOf<Ready>().toHaveProperty('result');

    type Failed = Extract<AsyncJobSnapshot, { status: 'failed' }>;
    expectTypeOf<Failed['error']>().toEqualTypeOf<string>();
  });
});
