import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
  AuthenticationError,
  HttpClient,
  TypedEmitter,
  ValidationError,
  resolveConfig,
} from '@deepidv/core';
import { Sessions } from '../sessions.js';
import { server } from './setup.js';

const BASE_URL = 'https://api.deepidv.com';

function createSessions() {
  const config = resolveConfig({
    apiKey: 'sk_test_key_1234',
    baseUrl: BASE_URL,
    timeout: 5_000,
    maxRetries: 0,
  });
  return new Sessions(new HttpClient(config, new TypedEmitter()));
}

const RAW_SESSION = {
  id: 'sess_abc123',
  organization_id: 'org_1',
  user_id: 'usr_1',
  sender_user_id: 'usr_2',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  status: 'PENDING',
  type: 'session',
  session_progress: 'STARTED',
  external_id: 'customer-1',
  location: null,
  workflow_id: 'workflow-1',
  meta_data: { applicantSubmissionIp: '203.0.113.1' },
  uploads: { id_front: true },
  analysis_data: { idMatchesSelfie: true },
};

describe('Sessions.create', () => {
  it('normalizes the documented wire response', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/sessions`, () =>
        HttpResponse.json({
          id: 'sess_abc123',
          session_url: 'https://verify.deepidv.com/sess_abc123',
          externalId: 'customer-1',
          expires_at: '2026-01-02T00:00:00Z',
          links: [{ rel: 'verification', href: 'https://verify.deepidv.com/sess_abc123' }],
        }),
      ),
    );

    const result = await createSessions().create({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      phone: '+15192223333',
    });

    expect(result).toMatchObject({
      id: 'sess_abc123',
      sessionUrl: 'https://verify.deepidv.com/sess_abc123',
      expiresAt: '2026-01-02T00:00:00Z',
    });
    expect(result.links[0]).toEqual({
      rel: 'verification',
      href: 'https://verify.deepidv.com/sess_abc123',
    });
  });

  it('sends every supported create field', async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/v1/sessions`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 'sess_1', session_url: 'https://verify.test', links: [] });
      }),
    );

    await createSessions().create({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      phone: '+15192223333',
      externalId: 'customer-1',
      workflowId: 'workflow-1',
      redirectUrl: 'https://example.com/complete',
      sendEmailInvite: false,
      sendPhoneInvite: true,
      expiresInHours: 48,
    });

    expect(body).toMatchObject({
      externalId: 'customer-1',
      workflowId: 'workflow-1',
      redirectUrl: 'https://example.com/complete',
      expiresInHours: 48,
    });
  });

  it.each([
    { phone: '12345' },
    { redirectUrl: 'http://example.com' },
    { expiresInHours: 0 },
    { expiresInHours: 8761 },
  ])('rejects invalid contract input %#', async (override) => {
    await expect(
      createSessions().create({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: '+15192223333',
        ...override,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('maps authentication failures', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/sessions`, () =>
        HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      ),
    );
    await expect(
      createSessions().create({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: '+15192223333',
      }),
    ).rejects.toThrow(AuthenticationError);
  });
});

describe('Sessions.retrieve', () => {
  it('normalizes snake_case session and resource fields', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/sessions/sess_abc123`, () =>
        HttpResponse.json({
          session_record: RAW_SESSION,
          resource_links: { id_front: 'https://s3.example/id-front' },
          user: { id: 'usr_1' },
          sender_user: { id: 'usr_2' },
        }),
      ),
    );

    const result = await createSessions().retrieve('sess_abc123');
    expect(result.sessionRecord.organizationId).toBe('org_1');
    expect(result.sessionRecord.analysisData).toEqual({ idMatchesSelfie: true });
    expect(result.resourceLinks.id_front).toContain('s3.example');
    expect(result.senderUser).toEqual({ id: 'usr_2' });
  });

  it('URL-encodes the session id', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/sessions/session%2Fwith%20space`, () =>
        HttpResponse.json({ session_record: RAW_SESSION, resource_links: {} }),
      ),
    );
    await expect(createSessions().retrieve('session/with space')).resolves.toBeDefined();
  });

  it('rejects an empty session id', async () => {
    await expect(createSessions().retrieve(' ')).rejects.toThrow(ValidationError);
  });
});

describe('Sessions.list', () => {
  it('serializes every documented query parameter and normalizes the page', async () => {
    let query: URLSearchParams | undefined;
    server.use(
      http.get(`${BASE_URL}/v1/sessions`, ({ request }) => {
        query = new URL(request.url).searchParams;
        return HttpResponse.json({ sessions: [RAW_SESSION], next_token: 'next-page' });
      }),
    );

    const result = await createSessions().list({
      limit: 50,
      nextToken: 'current-page',
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2026-02-01T00:00:00Z',
      byOrganization: true,
      externalId: 'customer-1',
      workflowId: 'workflow-1',
    });

    expect(Object.fromEntries(query ?? [])).toEqual({
      limit: '50',
      next_token: 'current-page',
      start_date: '2026-01-01T00:00:00Z',
      end_date: '2026-02-01T00:00:00Z',
      by_organization: 'true',
      external_id: 'customer-1',
      workflow_id: 'workflow-1',
    });
    expect(result.nextToken).toBe('next-page');
    expect(result.sessions[0]?.externalId).toBe('customer-1');
  });

  it('accepts an empty page', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/sessions`, () =>
        HttpResponse.json({ sessions: [], next_token: null }),
      ),
    );
    await expect(createSessions().list()).resolves.toEqual({ sessions: [], nextToken: null });
  });

  it('enforces the OpenAPI limit bounds', async () => {
    await expect(createSessions().list({ limit: 501 })).rejects.toThrow(ValidationError);
  });
});

describe('Sessions.updateStatus', () => {
  it('uses the documented route and request body', async () => {
    let body: unknown;
    server.use(
      http.patch(`${BASE_URL}/v1/sessions/sess_abc123/update-status`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ session_record: { ...RAW_SESSION, status: 'VERIFIED' } });
      }),
    );

    const result = await createSessions().updateStatus('sess_abc123', 'VERIFIED');
    expect(body).toEqual({ new_status: 'VERIFIED' });
    expect(result.sessionRecord.status).toBe('VERIFIED');
  });

  it('rejects statuses outside the documented enum', async () => {
    await expect(createSessions().updateStatus('sess_abc123', 'VOIDED' as never)).rejects.toThrow(
      ValidationError,
    );
  });
});
