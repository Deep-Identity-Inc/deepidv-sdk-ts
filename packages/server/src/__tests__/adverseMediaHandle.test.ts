/**
 * Tests for the AdverseMediaHandle factory (`createAdverseMediaHandle`).
 *
 * Uses msw + real HttpClient to intercept native fetch calls. The polling
 * loop in `wait()` sleeps via `setTimeout` and measures its deadline with
 * `Date.now()`, so the polling suite fakes only those two globals and drives
 * the loop with `vi.advanceTimersByTimeAsync()`. msw/fetch internals run on
 * real microtasks, untouched by the fake clock.
 *
 * Also pins the type-level contract of `AdverseMediaJobSnapshot` (DIDV-505
 * task 14) via `expectTypeOf` — enforced at typecheck time.
 */

import { describe, it, expect, expectTypeOf, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './setup.js';
import {
  resolveConfig,
  TypedEmitter,
  HttpClient,
  AdverseMediaFailedError,
  PollTimeoutError,
  DeepIDVError,
} from '@deepidv/core';
import { AsyncJobs } from '../asyncJobs.js';
import { createAdverseMediaHandle } from '../asyncJobHandle.js';
import type { AdverseMediaJobSnapshot, AdverseMediaResult } from '../screening.types.js';

const BASE_URL = 'https://api.deepidv.com';
const JOB_ID = 'job_am_1';
const JOB_URL = `${BASE_URL}/v1/async-jobs/${JOB_ID}`;

/**
 * Builds an AdverseMediaHandle backed by a real HttpClient + AsyncJobs.
 * Retries disabled so error tests fail fast and deterministically.
 */
function createHandle(jobId: string = JOB_ID) {
  const config = resolveConfig({
    apiKey: 'sk_test_key_1234',
    baseUrl: BASE_URL,
    timeout: 5_000,
    maxRetries: 0,
  });
  const emitter = new TypedEmitter();
  const client = new HttpClient(config, emitter);
  const asyncJobs = new AsyncJobs(client);
  return createAdverseMediaHandle(jobId, asyncJobs);
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

type RawJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

interface RawJobOverrides {
  status?: RawJobStatus;
  result?: unknown;
  error?: string | null;
}

/** Builds a raw `GET /v1/async-jobs/{jobId}` response (server uppercase shape). */
function rawJob(over: RawJobOverrides = {}) {
  return {
    jobId: JOB_ID,
    type: 'adverse-media',
    status: 'PENDING' as RawJobStatus,
    result: null as unknown,
    error: null as string | null,
    createdAt: '2026-05-28T12:00:00Z',
    updatedAt: '2026-05-28T12:01:00Z',
    ...over,
  };
}

/** A fully-valid AdverseMediaResult — required for the `ready` re-parse to pass. */
const MOCK_ADVERSE_RESULT = {
  totalHits: 3,
  riskLevel: 'HIGH' as const,
  riskScore: 82,
  summary: 'Multiple adverse findings across financial-crime sources.',
  findings: [
    {
      findingId: 'finding_1',
      severity: 'HIGH' as const,
      category: 'financial_crime',
      title: 'Alleged fraud scheme',
      detail: 'Subject named in a 2021 fraud investigation.',
      sourceUrl: 'https://news.example.com/article',
      sourceName: 'Example News',
      articleDate: '2021-06-01',
      confidence: 0.87,
      confirmedBy: ['news', 'court-records'],
    },
  ],
  // The server seeds a bucket for every exposure category (zero-filled when
  // empty), so the SDK schema requires all nine keys — mirror that here.
  exposuresByCategory: {
    financial_crime: {
      hits: 2,
      articles: [
        {
          timestamp: '2021-06-01T00:00:00Z',
          headline: 'Fraud probe widens',
          sourceLink: 'https://news.example.com/article',
          source: 'news' as const,
        },
      ],
    },
    terrorism: { hits: 0, articles: [] },
    regulatory: { hits: 0, articles: [] },
    political: { hits: 0, articles: [] },
    organized_crime: { hits: 0, articles: [] },
    violent_crime: { hits: 0, articles: [] },
    criminal_legal: { hits: 0, articles: [] },
    reputational: { hits: 0, articles: [] },
    court_records: { hits: 0, articles: [] },
  },
};

// ---------------------------------------------------------------------------
// refresh() — single-shot, no polling (real timers)
// ---------------------------------------------------------------------------

describe('AdverseMediaHandle.refresh', () => {
  it('returns a pending snapshot', async () => {
    server.use(http.get(JOB_URL, () => HttpResponse.json(rawJob({ status: 'PENDING' }))));
    const snap = await createHandle().refresh();
    expect(snap.status).toBe('pending');
  });

  it('returns a processing snapshot', async () => {
    server.use(http.get(JOB_URL, () => HttpResponse.json(rawJob({ status: 'PROCESSING' }))));
    const snap = await createHandle().refresh();
    expect(snap.status).toBe('processing');
  });

  it('returns a ready snapshot with the typed result', async () => {
    server.use(
      http.get(JOB_URL, () =>
        HttpResponse.json(rawJob({ status: 'COMPLETED', result: MOCK_ADVERSE_RESULT })),
      ),
    );
    const snap = await createHandle().refresh();
    expect(snap.status).toBe('ready');
    if (snap.status === 'ready') {
      expect(snap.result.riskLevel).toBe('HIGH');
      expect(snap.result.findings).toHaveLength(1);
    }
  });

  it('returns a failed snapshot with the error string', async () => {
    server.use(
      http.get(JOB_URL, () =>
        HttpResponse.json(rawJob({ status: 'FAILED', error: 'source unavailable' })),
      ),
    );
    const snap = await createHandle().refresh();
    expect(snap.status).toBe('failed');
    if (snap.status === 'failed') {
      expect(snap.error).toBe('source unavailable');
    }
  });

  it('does not loop — performs exactly one GET', async () => {
    let calls = 0;
    server.use(
      http.get(JOB_URL, () => {
        calls++;
        return HttpResponse.json(rawJob({ status: 'PENDING' }));
      }),
    );
    await createHandle().refresh();
    expect(calls).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// wait() — polling lifecycle (fake setTimeout + Date)
// ---------------------------------------------------------------------------

describe('AdverseMediaHandle.wait — polling', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls until COMPLETED and returns the typed result', async () => {
    let calls = 0;
    server.use(
      http.get(JOB_URL, () => {
        calls++;
        const status: RawJobStatus =
          calls === 1 ? 'PENDING' : calls === 2 ? 'PROCESSING' : 'COMPLETED';
        return HttpResponse.json(
          rawJob({ status, result: status === 'COMPLETED' ? MOCK_ADVERSE_RESULT : null }),
        );
      }),
    );
    const handle = createHandle();
    const p = handle.wait({ pollIntervalMs: 2_000, timeoutMs: 60_000 });
    // poll #1 @0 (PENDING), poll #2 @2000 (PROCESSING), poll #3 @4000 (COMPLETED)
    await vi.advanceTimersByTimeAsync(4_000);
    const result = await p;
    expect(calls).toBe(3);
    expect(result.riskLevel).toBe('HIGH');
    expect(result.totalHits).toBe(3);
  });

  it('throws AdverseMediaFailedError when the job terminates in failed', async () => {
    server.use(
      http.get(JOB_URL, () =>
        HttpResponse.json(rawJob({ status: 'FAILED', error: 'source unavailable' })),
      ),
    );
    let caught: unknown;
    // Terminal on the first (immediate) poll — no timer is scheduled.
    await createHandle()
      .wait({ pollIntervalMs: 2_000 })
      .catch((e: unknown) => {
        caught = e;
      });
    expect(caught).toBeInstanceOf(AdverseMediaFailedError);
    if (caught instanceof AdverseMediaFailedError) {
      expect(caught.message).toBe('source unavailable');
      expect(caught.jobId).toBe(JOB_ID);
    }
  });

  it('throws PollTimeoutError after timeoutMs elapses', async () => {
    server.use(http.get(JOB_URL, () => HttpResponse.json(rawJob({ status: 'PENDING' }))));
    let caught: unknown;
    const p = createHandle()
      .wait({ pollIntervalMs: 2_000, timeoutMs: 5_000 })
      .catch((e: unknown) => {
        caught = e;
      });
    await vi.advanceTimersByTimeAsync(5_000);
    await p;
    expect(caught).toBeInstanceOf(PollTimeoutError);
    if (caught instanceof PollTimeoutError) {
      expect(caught.timeoutMs).toBe(5_000);
      expect(caught.jobId).toBe(JOB_ID);
    }
  });

  it('respects a custom pollIntervalMs cadence', async () => {
    let calls = 0;
    server.use(
      http.get(JOB_URL, () => {
        calls++;
        const status: RawJobStatus = calls >= 3 ? 'COMPLETED' : 'PENDING';
        return HttpResponse.json(
          rawJob({ status, result: status === 'COMPLETED' ? MOCK_ADVERSE_RESULT : null }),
        );
      }),
    );
    const p = createHandle().wait({ pollIntervalMs: 5_000, timeoutMs: 60_000 });
    // First poll runs immediately; the second must wait the full 5s interval.
    await vi.advanceTimersByTimeAsync(4_999);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toBe(2);
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await p;
    expect(calls).toBe(3);
    expect(result.totalHits).toBe(3);
  });

  it('defaults to a 2s poll interval when no options are given', async () => {
    let calls = 0;
    server.use(
      http.get(JOB_URL, () => {
        calls++;
        const status: RawJobStatus = calls >= 2 ? 'COMPLETED' : 'PENDING';
        return HttpResponse.json(
          rawJob({ status, result: status === 'COMPLETED' ? MOCK_ADVERSE_RESULT : null }),
        );
      }),
    );
    const p = createHandle().wait();
    await vi.advanceTimersByTimeAsync(1_999);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    const result = await p;
    expect(calls).toBe(2);
    expect(result.riskLevel).toBe('HIGH');
  });

  it('propagates non-terminal request errors out of wait()', async () => {
    server.use(
      http.get(JOB_URL, () =>
        HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 }),
      ),
    );
    // 500 throws on the first poll — no timer is scheduled.
    await expect(createHandle().wait({ pollIntervalMs: 2_000 })).rejects.toThrow(DeepIDVError);
  });
});

// ---------------------------------------------------------------------------
// Type-level contract (DIDV-505 task 14) — enforced by tsc, no-op at runtime
// ---------------------------------------------------------------------------

describe('AdverseMediaJobSnapshot — type-level contract', () => {
  it('is a discriminated union that narrows result/error by status', () => {
    expectTypeOf<AdverseMediaJobSnapshot['status']>().toEqualTypeOf<
      'pending' | 'processing' | 'ready' | 'failed'
    >();

    type Ready = Extract<AdverseMediaJobSnapshot, { status: 'ready' }>;
    expectTypeOf<Ready['result']>().toEqualTypeOf<AdverseMediaResult>();
    expectTypeOf<Ready>().not.toHaveProperty('error');

    type Failed = Extract<AdverseMediaJobSnapshot, { status: 'failed' }>;
    expectTypeOf<Failed['error']>().toEqualTypeOf<string>();
    expectTypeOf<Failed>().not.toHaveProperty('result');

    // Non-terminal members carry only the discriminant.
    type Pending = Extract<AdverseMediaJobSnapshot, { status: 'pending' }>;
    expectTypeOf<keyof Pending>().toEqualTypeOf<'status'>();
    type Processing = Extract<AdverseMediaJobSnapshot, { status: 'processing' }>;
    expectTypeOf<keyof Processing>().toEqualTypeOf<'status'>();
  });
});
