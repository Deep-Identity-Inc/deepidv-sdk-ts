/**
 * Tests for the Screening module.
 *
 * Uses msw + real HttpClient to intercept native fetch calls.
 * Covers all four methods: pepSanctions, adverseMedia, titleCheck, list.
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
  DeepIDVError,
  InsufficientFundsError,
  ServiceUnavailableError,
} from '@deepidv/core';
import { Screening } from '../screening.js';
import { AsyncJobs } from '../asyncJobs.js';
import type { PepSanctionsResult, TitleCheckResult } from '../screening.types.js';

const BASE_URL = 'https://api.deepidv.com';

/**
 * Builds a fresh Screening instance backed by a real HttpClient + AsyncJobs.
 * Retries disabled so tests are fast and deterministic.
 */
function createScreening() {
  return makeScreening(0);
}

/**
 * Builds a Screening instance whose underlying client has `maxRetries` retries
 * enabled (and zero backoff delay). Used to prove that the screening sync
 * methods opt OUT of retries per-request even when the client default allows
 * them.
 */
function createRetryingScreening(maxRetries = 3) {
  return makeScreening(maxRetries);
}

function makeScreening(maxRetries: number) {
  const config = resolveConfig({
    apiKey: 'sk_test_key_1234',
    baseUrl: BASE_URL,
    timeout: 5_000,
    maxRetries,
    initialRetryDelay: 0,
  });
  const emitter = new TypedEmitter();
  const client = new HttpClient(config, emitter);
  const asyncJobs = new AsyncJobs(client);
  return new Screening(client, asyncJobs);
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const SAMPLE_INPUT = {
  email: 'jane.doe@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  dateOfBirth: '1980-05-12',
};

const TITLE_INPUT = {
  email: 'jane.doe@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  address: '123 Main St',
};

const MOCK_PEP_SANCTIONS_CLEAN = {
  totalMatches: 0,
  peps: [],
  sanctions: [],
  both: [],
  searchedSources: ['us_ofac', 'ca_consolidated', 'open_sanctions'],
};

const MOCK_PEP_SANCTIONS_HIT = {
  totalMatches: 1,
  peps: [],
  sanctions: [
    {
      name: 'Vladimir PUTIN',
      country: 'RU',
      dateOfBirth: '1952-10-07',
      confidence: 0.99,
      datasets: ['Canadian Sanctions List'],
    },
  ],
  both: [],
  searchedSources: ['ca_consolidated'],
};

const ADVERSE_MEDIA_QUEUED = (jobId = 'job_abc123') => ({
  jobId,
  status: 'pending' as const,
  message: 'Queued',
});

// RFC 4122 v4 UUID — 8-4-4-4-12 hex with version=4 nibble and variant=8/9/a/b.
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Screening.pepSanctions
// ---------------------------------------------------------------------------

describe('Screening.pepSanctions', () => {
  it('returns a clean PepSanctionsResult on 200', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/screening/pep-sanctions`, () =>
        HttpResponse.json(MOCK_PEP_SANCTIONS_CLEAN),
      ),
    );
    const result = await createScreening().pepSanctions(SAMPLE_INPUT);
    expect(result.totalMatches).toBe(0);
    expect(result.peps).toEqual([]);
    expect(result.sanctions).toEqual([]);
    expect(result.both).toEqual([]);
    expect(result.searchedSources).toContain('open_sanctions');
  });

  it('parses populated match arrays', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/screening/pep-sanctions`, () =>
        HttpResponse.json(MOCK_PEP_SANCTIONS_HIT),
      ),
    );
    const result = await createScreening().pepSanctions(SAMPLE_INPUT);
    expect(result.totalMatches).toBe(1);
    expect(result.sanctions).toHaveLength(1);
    expect(result.sanctions[0]?.name).toBe('Vladimir PUTIN');
    expect(result.sanctions[0]?.confidence).toBe(0.99);
    expect(result.sanctions[0]?.datasets).toContain('Canadian Sanctions List');
  });

  it('sends the email/name body to the server', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE_URL}/v1/screening/pep-sanctions`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(MOCK_PEP_SANCTIONS_CLEAN);
      }),
    );
    await createScreening().pepSanctions(SAMPLE_INPUT);
    expect(capturedBody).toMatchObject({
      email: 'jane.doe@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: '1980-05-12',
    });
  });

  it('throws ValidationError on missing email', async () => {
    await expect(
      createScreening().pepSanctions({
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1980-05-12',
      } as never),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError on malformed email', async () => {
    await expect(
      createScreening().pepSanctions({ ...SAMPLE_INPUT, email: 'not-an-email' }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError on missing firstName', async () => {
    await expect(
      createScreening().pepSanctions({
        email: 'jane.doe@example.com',
        lastName: 'Doe',
        dateOfBirth: '1980-05-12',
      } as never),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError on invalid date format', async () => {
    await expect(
      createScreening().pepSanctions({ ...SAMPLE_INPUT, dateOfBirth: 'not-a-date' }),
    ).rejects.toThrow(ValidationError);
  });

  it('maps 401 → AuthenticationError', async () => {
    server.use(
      http.post('*/v1/screening/pep-sanctions', () =>
        HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      ),
    );
    await expect(createScreening().pepSanctions(SAMPLE_INPUT)).rejects.toThrow(AuthenticationError);
  });

  it('maps a plain-text 402 → InsufficientFundsError with the readable message', async () => {
    server.use(
      http.post(
        '*/v1/screening/pep-sanctions',
        () => new HttpResponse('Insufficient funds or subscription.', { status: 402 }),
      ),
    );
    try {
      await createScreening().pepSanctions(SAMPLE_INPUT);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(InsufficientFundsError);
      const err = e as InsufficientFundsError;
      expect(err.status).toBe(402);
      expect(err.message).toBe('Insufficient funds or subscription.');
    }
  });

  it('maps 503 → ServiceUnavailableError', async () => {
    server.use(
      http.post('*/v1/screening/pep-sanctions', () =>
        HttpResponse.json({ error: 'Service temporarily unavailable.' }, { status: 503 }),
      ),
    );
    await expect(createScreening().pepSanctions(SAMPLE_INPUT)).rejects.toThrow(
      ServiceUnavailableError,
    );
  });

  it('does NOT retry a 503 even when the client allows retries (fail-fast, D2)', async () => {
    let callCount = 0;
    server.use(
      http.post('*/v1/screening/pep-sanctions', () => {
        callCount++;
        return HttpResponse.json({ error: 'unavailable' }, { status: 503 });
      }),
    );
    await expect(createRetryingScreening(3).pepSanctions(SAMPLE_INPUT)).rejects.toThrow(
      ServiceUnavailableError,
    );
    expect(callCount).toBe(1);
  });

  it('maps 500 → DeepIDVError', async () => {
    server.use(
      http.post('*/v1/screening/pep-sanctions', () =>
        HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 }),
      ),
    );
    await expect(createScreening().pepSanctions(SAMPLE_INPUT)).rejects.toThrow(DeepIDVError);
  });
});

// ---------------------------------------------------------------------------
// Screening.adverseMedia — returns a handle; idempotency-key behavior
// ---------------------------------------------------------------------------

describe('Screening.adverseMedia', () => {
  it('returns an AdverseMediaHandle with the server jobId', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/screening/adverse-media`, () =>
        HttpResponse.json(ADVERSE_MEDIA_QUEUED('job_abc123'), { status: 202 }),
      ),
    );
    const handle = await createScreening().adverseMedia(SAMPLE_INPUT);
    expect(handle.jobId).toBe('job_abc123');
    expect(typeof handle.wait).toBe('function');
    expect(typeof handle.refresh).toBe('function');
  });

  it('strips idempotencyKey from the request body', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE_URL}/v1/screening/adverse-media`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(ADVERSE_MEDIA_QUEUED('job_a'), { status: 202 });
      }),
    );
    await createScreening().adverseMedia({
      ...SAMPLE_INPUT,
      idempotencyKey: 'my-key-123',
    });
    expect(capturedBody).not.toHaveProperty('idempotencyKey');
    expect(capturedBody).toMatchObject({ firstName: 'Jane', lastName: 'Doe' });
  });

  it('forwards explicit idempotencyKey as the Idempotency-Key header', async () => {
    let capturedKey: string | null = null;
    server.use(
      http.post(`${BASE_URL}/v1/screening/adverse-media`, ({ request }) => {
        capturedKey = request.headers.get('Idempotency-Key');
        return HttpResponse.json(ADVERSE_MEDIA_QUEUED('job_b'), { status: 202 });
      }),
    );
    await createScreening().adverseMedia({
      ...SAMPLE_INPUT,
      idempotencyKey: 'my-stable-key',
    });
    expect(capturedKey).toBe('my-stable-key');
  });

  it('auto-generates a UUID v4 Idempotency-Key when caller omits it', async () => {
    let capturedKey: string | null = null;
    server.use(
      http.post(`${BASE_URL}/v1/screening/adverse-media`, ({ request }) => {
        capturedKey = request.headers.get('Idempotency-Key');
        return HttpResponse.json(ADVERSE_MEDIA_QUEUED('job_c'), { status: 202 });
      }),
    );
    await createScreening().adverseMedia(SAMPLE_INPUT);
    expect(capturedKey).toMatch(UUID_V4_REGEX);
  });

  it('generates a different UUID per call', async () => {
    const capturedKeys: string[] = [];
    server.use(
      http.post(`${BASE_URL}/v1/screening/adverse-media`, ({ request }) => {
        const key = request.headers.get('Idempotency-Key');
        if (key) capturedKeys.push(key);
        return HttpResponse.json(ADVERSE_MEDIA_QUEUED('job_x'), { status: 202 });
      }),
    );
    const screening = createScreening();
    await screening.adverseMedia(SAMPLE_INPUT);
    await screening.adverseMedia(SAMPLE_INPUT);
    expect(capturedKeys).toHaveLength(2);
    expect(capturedKeys[0]).not.toBe(capturedKeys[1]);
  });

  it('normalizes country to uppercase before sending', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE_URL}/v1/screening/adverse-media`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(ADVERSE_MEDIA_QUEUED('job_d'), { status: 202 });
      }),
    );
    await createScreening().adverseMedia({ ...SAMPLE_INPUT, country: 'ca' });
    expect(capturedBody?.['country']).toBe('CA');
  });

  it('throws ValidationError on missing firstName', async () => {
    await expect(
      createScreening().adverseMedia({ lastName: 'Doe', dateOfBirth: '1980-05-12' } as never),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError on invalid country code', async () => {
    await expect(
      createScreening().adverseMedia({ ...SAMPLE_INPUT, country: 'Canada' }),
    ).rejects.toThrow(ValidationError);
  });
});

// ---------------------------------------------------------------------------
// Screening.titleCheck — discriminated union
// ---------------------------------------------------------------------------

describe('Screening.titleCheck', () => {
  it('parses the "found" variant', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/screening/title-check`, () =>
        HttpResponse.json({
          status: 'found',
          subjectProperty: null,
          ownerInformation: null,
          locationInformation: null,
          ownerTransferInformation: null,
          lastMarketSaleInformation: null,
        }),
      ),
    );
    const result = await createScreening().titleCheck(TITLE_INPUT);
    expect(result.status).toBe('found');
  });

  it('sends email/firstName/lastName/address to the server', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE_URL}/v1/screening/title-check`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          status: 'found',
          subjectProperty: null,
          ownerInformation: null,
          locationInformation: null,
          ownerTransferInformation: null,
          lastMarketSaleInformation: null,
        });
      }),
    );
    await createScreening().titleCheck(TITLE_INPUT);
    expect(capturedBody).toMatchObject({
      email: 'jane.doe@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      address: '123 Main St',
    });
  });

  it('parses the "multiple_properties" variant', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/screening/title-check`, () =>
        HttpResponse.json({
          status: 'multiple_properties',
          message: 'Multiple matches',
          availableUnits: ['1A', '2B'],
          properties: [
            { owner: 'Owner 1', apartmentOrUnit: '1A' },
            { owner: 'Owner 2', apartmentOrUnit: '2B' },
          ],
        }),
      ),
    );
    const result = await createScreening().titleCheck(TITLE_INPUT);
    expect(result.status).toBe('multiple_properties');
    if (result.status === 'multiple_properties') {
      expect(result.availableUnits).toHaveLength(2);
      expect(result.properties).toHaveLength(2);
    }
  });

  it('parses "unsupported_region" as a typed result, not an error', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/screening/title-check`, () =>
        HttpResponse.json({
          status: 'unsupported_region',
          message: 'Title search is currently available for US addresses only.',
        }),
      ),
    );
    const result = await createScreening().titleCheck({
      ...TITLE_INPUT,
      address: '99 King St, Toronto, ON',
    });
    expect(result.status).toBe('unsupported_region');
  });

  it('parses the "not_found" variant', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/screening/title-check`, () =>
        HttpResponse.json({ status: 'not_found', message: 'No matching property found.' }),
      ),
    );
    const result = await createScreening().titleCheck({ ...TITLE_INPUT, address: '0 Nowhere Ave' });
    expect(result.status).toBe('not_found');
  });

  it('throws ValidationError on empty address', async () => {
    await expect(createScreening().titleCheck({ ...TITLE_INPUT, address: '' })).rejects.toThrow(
      ValidationError,
    );
  });

  it('throws ValidationError on missing email', async () => {
    await expect(
      createScreening().titleCheck({
        firstName: 'Jane',
        lastName: 'Doe',
        address: '123 Main St',
      } as never),
    ).rejects.toThrow(ValidationError);
  });

  it('maps a plain-text 402 → InsufficientFundsError', async () => {
    server.use(
      http.post(
        '*/v1/screening/title-check',
        () => new HttpResponse('Insufficient funds or subscription.', { status: 402 }),
      ),
    );
    await expect(createScreening().titleCheck(TITLE_INPUT)).rejects.toThrow(InsufficientFundsError);
  });

  it('does NOT retry a 503 even when the client allows retries (fail-fast, D2)', async () => {
    let callCount = 0;
    server.use(
      http.post('*/v1/screening/title-check', () => {
        callCount++;
        return HttpResponse.json({ error: 'unavailable' }, { status: 503 });
      }),
    );
    await expect(createRetryingScreening(3).titleCheck(TITLE_INPUT)).rejects.toThrow(
      ServiceUnavailableError,
    );
    expect(callCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Screening.list — stub, throws until server endpoint lands
// ---------------------------------------------------------------------------

describe('Screening.list', () => {
  it('throws a not-implemented error when called with no params', () => {
    expect(() => createScreening().list()).toThrow(/not yet implemented/i);
  });

  it('throws even when params are passed', () => {
    expect(() => createScreening().list({ limit: 10 })).toThrow(/not yet implemented/i);
  });
});

// ---------------------------------------------------------------------------
// Type-level contract (DIDV-505 task 14) — enforced by tsc, no-op at runtime
// ---------------------------------------------------------------------------

describe('TitleCheckResult — type-level contract', () => {
  it('is a discriminated union on status with the four documented members', () => {
    expectTypeOf<TitleCheckResult['status']>().toEqualTypeOf<
      'found' | 'multiple_properties' | 'unsupported_region' | 'not_found'
    >();

    type Found = Extract<TitleCheckResult, { status: 'found' }>;
    expectTypeOf<Found>().toHaveProperty('subjectProperty');
    expectTypeOf<Found>().toHaveProperty('ownerInformation');
    expectTypeOf<Found>().not.toHaveProperty('properties');

    type Multiple = Extract<TitleCheckResult, { status: 'multiple_properties' }>;
    expectTypeOf<Multiple['availableUnits']>().toEqualTypeOf<string[]>();
    expectTypeOf<Multiple>().toHaveProperty('properties');
    expectTypeOf<Multiple>().not.toHaveProperty('subjectProperty');

    type Unsupported = Extract<TitleCheckResult, { status: 'unsupported_region' }>;
    expectTypeOf<Unsupported['message']>().toEqualTypeOf<string>();

    type NotFound = Extract<TitleCheckResult, { status: 'not_found' }>;
    expectTypeOf<NotFound['message']>().toEqualTypeOf<string>();
  });
});

describe('PepSanctionsResult — type-level contract', () => {
  it('mirrors the normalized contract (totalMatches/peps/sanctions/both/searchedSources)', () => {
    expectTypeOf<PepSanctionsResult['totalMatches']>().toEqualTypeOf<number>();
    expectTypeOf<PepSanctionsResult['searchedSources']>().toEqualTypeOf<string[]>();

    // The three match buckets share the same element shape.
    type Match = PepSanctionsResult['peps'][number];
    expectTypeOf<PepSanctionsResult['sanctions'][number]>().toEqualTypeOf<Match>();
    expectTypeOf<PepSanctionsResult['both'][number]>().toEqualTypeOf<Match>();

    expectTypeOf<Match['name']>().toEqualTypeOf<string>();
    expectTypeOf<Match['country']>().toEqualTypeOf<string | null>();
    expectTypeOf<Match['dateOfBirth']>().toEqualTypeOf<string | null>();
    expectTypeOf<Match['confidence']>().toEqualTypeOf<number>();
    expectTypeOf<Match['datasets']>().toEqualTypeOf<string[]>();

    // Old contract fields are gone.
    expectTypeOf<PepSanctionsResult>().not.toHaveProperty('message');
    expectTypeOf<PepSanctionsResult>().not.toHaveProperty('data');
  });
});
