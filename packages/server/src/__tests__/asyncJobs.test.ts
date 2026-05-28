/**
 * Tests for the AsyncJobs module.
 *
 * Uses msw + real HttpClient to intercept native fetch calls.
 * Covers `get(jobId)` happy paths, status normalization (server uppercase
 * → public lowercase), and error mapping.
 */

import { describe, it, expect } from 'vitest';
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
// Mock data
// ---------------------------------------------------------------------------

const BASE_RAW = {
  jobId: 'job_abc123',
  type: 'adverse-media',
  createdAt: '2026-05-28T12:00:00Z',
  updatedAt: '2026-05-28T12:01:00Z',
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
// AsyncJobs.get — status normalization
// ---------------------------------------------------------------------------

describe('AsyncJobs.get — status normalization', () => {
  it('normalizes PENDING → pending', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/async-jobs/job_abc123`, () =>
        HttpResponse.json({ ...BASE_RAW, status: 'PENDING', result: null, error: null }),
      ),
    );
    const snap = await createAsyncJobs().get('job_abc123');
    expect(snap.status).toBe('pending');
    expect(snap.jobId).toBe('job_abc123');
    expect(snap.type).toBe('adverse-media');
  });

  it('normalizes PROCESSING → processing', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/async-jobs/job_abc123`, () =>
        HttpResponse.json({ ...BASE_RAW, status: 'PROCESSING', result: null, error: null }),
      ),
    );
    const snap = await createAsyncJobs().get('job_abc123');
    expect(snap.status).toBe('processing');
  });

  it('normalizes COMPLETED → ready and surfaces the result', async () => {
    const result = { totalHits: 5, summary: 'some-data' };
    server.use(
      http.get(`${BASE_URL}/v1/async-jobs/job_abc123`, () =>
        HttpResponse.json({ ...BASE_RAW, status: 'COMPLETED', result, error: null }),
      ),
    );
    const snap = await createAsyncJobs().get('job_abc123');
    expect(snap.status).toBe('ready');
    if (snap.status === 'ready') {
      expect(snap.result).toEqual(result);
    }
  });

  it('normalizes FAILED → failed and surfaces the error string', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/async-jobs/job_abc123`, () =>
        HttpResponse.json({
          ...BASE_RAW,
          status: 'FAILED',
          result: null,
          error: 'upstream timeout',
        }),
      ),
    );
    const snap = await createAsyncJobs().get('job_abc123');
    expect(snap.status).toBe('failed');
    if (snap.status === 'failed') {
      expect(snap.error).toBe('upstream timeout');
    }
  });

  it('synthesizes a fallback message when FAILED has null error', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/async-jobs/job_abc123`, () =>
        HttpResponse.json({ ...BASE_RAW, status: 'FAILED', result: null, error: null }),
      ),
    );
    const snap = await createAsyncJobs().get('job_abc123');
    expect(snap.status).toBe('failed');
    if (snap.status === 'failed') {
      expect(snap.error).toMatch(/failed without error message/i);
    }
  });

  it('passes through createdAt and updatedAt on every variant', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/async-jobs/job_abc123`, () =>
        HttpResponse.json({ ...BASE_RAW, status: 'PENDING', result: null, error: null }),
      ),
    );
    const snap = await createAsyncJobs().get('job_abc123');
    expect(snap.createdAt).toBe('2026-05-28T12:00:00Z');
    expect(snap.updatedAt).toBe('2026-05-28T12:01:00Z');
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
          ...BASE_RAW,
          jobId: 'job/with-slash',
          status: 'PENDING',
          result: null,
          error: null,
        });
      }),
    );
    await createAsyncJobs().get('job/with-slash');
    expect(capturedUrl).toContain('job%2Fwith-slash');
  });
});
