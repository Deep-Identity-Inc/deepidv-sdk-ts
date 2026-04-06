/**
 * Tests for the Sessions module.
 *
 * Uses msw + real HttpClient to intercept native fetch calls.
 * Tests all four CRUD methods: create, retrieve, list, updateStatus.
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './setup.js';
import { resolveConfig, TypedEmitter, HttpClient, ValidationError } from '@deepidv/core';
import type { SDKEventMap } from '@deepidv/core';
import { Sessions } from '../sessions.js';

const BASE_URL = 'https://api.deepidv.com';

/**
 * Creates a fresh Sessions instance backed by a real HttpClient.
 * Retries disabled so tests are fast and deterministic.
 */
function createSessions(overrides?: Record<string, unknown>) {
  const config = resolveConfig({
    apiKey: 'sk_test_key_1234',
    baseUrl: BASE_URL,
    timeout: 5_000,
    maxRetries: 0,
    ...overrides,
  });
  const emitter = new TypedEmitter<SDKEventMap>();
  const client = new HttpClient(config, emitter);
  return new Sessions(client);
}

// ---------------------------------------------------------------------------
// Mock data constants
// ---------------------------------------------------------------------------

const MOCK_SESSION_RECORD = {
  id: 'sess_abc123',
  organizationId: 'org_1',
  userId: 'usr_1',
  senderUserId: 'usr_2',
  status: 'SUBMITTED',
  type: 'session',
  sessionProgress: 'COMPLETED',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
  analysisData: {
    createdAt: '2026-01-02T00:00:00Z',
    idMatchesSelfie: true,
    idAnalysisData: {
      detectFaceData: [{ confidence: 0.99 }],
      idExtractedText: [{ type: 'firstName', value: 'Jane', confidence: 0.98 }],
      expiryDatePass: true,
      validStatePass: true,
      ageRestrictionPass: true,
    },
    compareFacesData: {
      faceMatchConfidence: 0.95,
      faceMatchResult: {},
    },
  },
};

const MOCK_SESSION_SUMMARY = {
  id: 'sess_1',
  organizationId: 'org_1',
  userId: 'usr_1',
  senderUserId: 'usr_2',
  status: 'PENDING',
  type: 'session',
  sessionProgress: 'PENDING',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const MOCK_SESSION_SUMMARY_2 = {
  ...MOCK_SESSION_SUMMARY,
  id: 'sess_2',
};

// ---------------------------------------------------------------------------
// Sessions.create — SESS-01
// ---------------------------------------------------------------------------

describe('Sessions.create', () => {
  it('returns SessionCreateResult on 200', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/sessions`, () => {
        return HttpResponse.json({
          id: 'sess_abc123',
          sessionUrl: 'https://verify.deepidv.com/sess_abc123',
          links: [{ url: 'https://verify.deepidv.com/sess_abc123/start', type: 'verification' }],
        });
      }),
    );

    const sessions = createSessions();
    const result = await sessions.create({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      phone: '+15192223333',
    });

    expect(result.id).toBe('sess_abc123');
    expect(result.sessionUrl).toContain('sess_abc123');
    expect(Array.isArray(result.links)).toBe(true);
    expect(result.links).toHaveLength(1);
  });

  it('sends correct request body', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post(`${BASE_URL}/v1/sessions`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          id: 'sess_xyz',
          sessionUrl: 'https://verify.deepidv.com/sess_xyz',
          links: [],
        });
      }),
    );

    const sessions = createSessions();
    await sessions.create({
      firstName: 'John',
      lastName: 'Smith',
      email: 'john@example.com',
      phone: '+14165559999',
    });

    expect(capturedBody).toMatchObject({
      firstName: 'John',
      lastName: 'Smith',
      email: 'john@example.com',
      phone: '+14165559999',
    });
  });

  it('throws ValidationError on missing firstName', async () => {
    const sessions = createSessions();
    await expect(
      sessions.create({ lastName: 'Doe', email: 'j@e.com', phone: '+1' } as never),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError on invalid email', async () => {
    const sessions = createSessions();
    await expect(
      sessions.create({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'not-an-email',
        phone: '+15192223333',
      }),
    ).rejects.toThrow(ValidationError);
  });
});

// ---------------------------------------------------------------------------
// Sessions.retrieve — SESS-02
// ---------------------------------------------------------------------------

describe('Sessions.retrieve', () => {
  it('returns full session with nested analysisData on 200', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/sessions/sess_abc123`, () => {
        return HttpResponse.json({
          sessionRecord: MOCK_SESSION_RECORD,
        });
      }),
    );

    const sessions = createSessions();
    const result = await sessions.retrieve('sess_abc123');

    expect(result.sessionRecord.id).toBe('sess_abc123');
    expect(result.sessionRecord.analysisData).toBeDefined();
    expect(result.sessionRecord.analysisData?.idAnalysisData?.expiryDatePass).toBe(true);
  });

  it('throws ValidationError on empty string sessionId', async () => {
    const sessions = createSessions();
    await expect(sessions.retrieve('')).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError on whitespace-only sessionId', async () => {
    const sessions = createSessions();
    await expect(sessions.retrieve('   ')).rejects.toThrow(ValidationError);
  });
});

// ---------------------------------------------------------------------------
// Sessions.list — SESS-03
// ---------------------------------------------------------------------------

describe('Sessions.list', () => {
  it('sends query params in URL', async () => {
    let capturedUrl: string | null = null;

    server.use(
      http.get(`${BASE_URL}/v1/sessions`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([MOCK_SESSION_SUMMARY]);
      }),
    );

    const sessions = createSessions();
    await sessions.list({ limit: 10, offset: 20, status: 'VERIFIED' });

    expect(capturedUrl).toContain('limit=10');
    expect(capturedUrl).toContain('offset=20');
    expect(capturedUrl).toContain('status=VERIFIED');
  });

  it('wraps raw array response into PaginatedResponse', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/sessions`, () => {
        return HttpResponse.json([MOCK_SESSION_SUMMARY, MOCK_SESSION_SUMMARY_2]);
      }),
    );

    const sessions = createSessions();
    const result = await sessions.list();

    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(typeof result.limit).toBe('number');
    expect(typeof result.offset).toBe('number');
  });

  it('passes through already-wrapped response', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/sessions`, () => {
        return HttpResponse.json({
          data: [MOCK_SESSION_SUMMARY, MOCK_SESSION_SUMMARY_2],
          total: 5,
          limit: 10,
          offset: 0,
        });
      }),
    );

    const sessions = createSessions();
    const result = await sessions.list({ limit: 10, offset: 0 });

    expect(result.total).toBe(5);
    expect(result.data).toHaveLength(2);
  });

  it('works with no params', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/sessions`, () => {
        return HttpResponse.json([]);
      }),
    );

    const sessions = createSessions();
    const result = await sessions.list();

    expect(result.data).toEqual([]);
    expect(typeof result.limit).toBe('number');
    expect(typeof result.offset).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// Sessions.updateStatus — SESS-04
// ---------------------------------------------------------------------------

describe('Sessions.updateStatus', () => {
  it('sends PATCH with status body', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.patch(`${BASE_URL}/v1/sessions/sess_abc123`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ sessionRecord: MOCK_SESSION_RECORD });
      }),
    );

    const sessions = createSessions();
    await sessions.updateStatus('sess_abc123', 'VERIFIED');

    expect(capturedBody).toEqual({ status: 'VERIFIED' });
  });

  it('throws ValidationError on invalid status like PENDING', async () => {
    const sessions = createSessions();
    await expect(
      sessions.updateStatus('sess_abc123', 'PENDING' as never),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError on empty sessionId', async () => {
    const sessions = createSessions();
    await expect(sessions.updateStatus('', 'VERIFIED')).rejects.toThrow(ValidationError);
  });
});
