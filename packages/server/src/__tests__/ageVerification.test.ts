import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
  DeepIDVError,
  HttpClient,
  TypedEmitter,
  ValidationError,
  resolveConfig,
} from '@deepidv/core';
import { AgeVerification } from '../ageVerification.js';
import { server } from './setup.js';

const BASE_URL = 'https://api.deepidv.com';

function createAgeVerification(maxRetries = 0) {
  const config = resolveConfig({
    apiKey: 'sk_test_key_1234',
    baseUrl: BASE_URL,
    maxRetries,
    initialRetryDelay: 1,
  });
  return new AgeVerification(new HttpClient(config, new TypedEmitter()));
}

const PARENT_CONNECT_WIRE = {
  id: 'pc_123',
  child_session_id: 'session_child',
  parent_session_id: null,
  status: 'PARENT_INVITED',
  age_band: '13-17',
  contact_method: 'email',
  platform_restrictions: [{ key: 'chat', label: 'Allow chat', type: 'toggle', required: true }],
  boundaries: null,
  eula_url: 'https://example.com/eula',
  eula_accepted: false,
  child_attestation_id: null,
  parent_attestation_id: null,
  boundaries_revision: null,
  consent_given_at: null,
  consent_expires_at: null,
  reconsent_due_at: null,
  invite_expires_at: '2026-10-02T10:00:00.000Z',
  declined_at: null,
  created_at: '2026-10-01T10:00:00.000Z',
  updated_at: '2026-10-01T10:00:00.000Z',
};

describe('AgeVerification', () => {
  it('creates an age-verification session and normalizes the response', async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/v1/age-verification`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          id: 'age_123',
          session_url: 'https://verify.deepidv.com/deep-age/age_123',
          method: 'intel-quiz',
          external_id: 'customer-123',
          expires_at: '2026-10-02T10:00:00.000Z',
          links: [
            {
              rel: 'session_details',
              href: 'https://api.deepidv.com/v1/sessions/age_123',
              description: 'Fetch the session',
            },
          ],
        });
      }),
    );

    const result = await createAgeVerification().create({
      email: 'child@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '+15192223333',
      method: 'quiz',
      externalId: 'customer-123',
      redirectUrl: 'https://example.com/complete',
      expiresInHours: 24,
    });

    expect(body).toEqual({
      email: 'child@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '+15192223333',
      method: 'quiz',
      externalId: 'customer-123',
      redirectUrl: 'https://example.com/complete',
      expiresInHours: 24,
    });
    expect(result).toMatchObject({
      id: 'age_123',
      sessionUrl: 'https://verify.deepidv.com/deep-age/age_123',
      method: 'intel-quiz',
      externalId: 'customer-123',
    });
  });

  it('validates Parent Connect declarations before sending a request', async () => {
    const ageVerification = createAgeVerification();

    await expect(
      ageVerification.create({
        email: 'child@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        phone: '+15192223333',
        method: 'quiz',
        ageBand: '13-17',
      }),
    ).rejects.toThrow(ValidationError);

    await expect(
      ageVerification.create({
        email: 'child@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        phone: '+15192223333',
        method: 'parent-connect',
        platformRestrictions: [
          { key: 'chat', label: 'Chat', type: 'select' },
          { key: 'chat', label: 'Chat duplicate', type: 'toggle' },
        ],
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('does not retry billable age-verification creation', async () => {
    let attempts = 0;
    server.use(
      http.post(`${BASE_URL}/v1/age-verification`, () => {
        attempts += 1;
        return HttpResponse.json({ error: 'failed' }, { status: 500 });
      }),
    );

    await expect(
      createAgeVerification(2).create({
        email: 'child@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        phone: '+15192223333',
        method: 'credit-card',
      }),
    ).rejects.toThrow(DeepIDVError);
    expect(attempts).toBe(1);
  });

  it('serializes Parent Connect filters and preserves an empty continuing page', async () => {
    let requestUrl = '';
    server.use(
      http.get(`${BASE_URL}/v1/age-verification/parent-connect`, ({ request }) => {
        requestUrl = request.url;
        return HttpResponse.json({
          parent_connect_requests: [],
          next_token: 'next-page-token',
        });
      }),
    );

    const result = await createAgeVerification().listParentConnectRequests({
      limit: 25,
      nextToken: 'current token',
      childSessionId: 'session_child',
      status: 'CONSENT_GIVEN',
    });

    const url = new URL(requestUrl);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      limit: '25',
      next_token: 'current token',
      child_session_id: 'session_child',
      status: 'CONSENT_GIVEN',
    });
    expect(result).toEqual({ parentConnectRequests: [], nextToken: 'next-page-token' });
  });

  it('retrieves and normalizes a Parent Connect request', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/age-verification/parent-connect/pc_123`, () =>
        HttpResponse.json(PARENT_CONNECT_WIRE),
      ),
    );

    const result = await createAgeVerification().retrieveParentConnectRequest('pc_123');
    expect(result).toMatchObject({
      id: 'pc_123',
      childSessionId: 'session_child',
      parentSessionId: null,
      status: 'PARENT_INVITED',
      eulaAccepted: false,
      childAttestationId: null,
    });
  });

  it('reads current boundaries and exposes the attestation-match flag', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/age-verification/boundaries/attestation%2Fchild`, () =>
        HttpResponse.json({
          child_attestation_id: 'attestation/child',
          parent_attestation_id: 'attestation/parent',
          parent_connect_id: 'pc_123',
          age_band: '13-17',
          parental_consent: true,
          eula_accepted: true,
          boundaries: { chat: false, dailyMinutes: 60 },
          boundaries_revision: 2,
          boundaries_match_attestation: false,
          consent_expires_at: '2027-10-01T10:00:00.000Z',
          updated_at: '2026-10-01T11:00:00.000Z',
        }),
      ),
    );

    const result = await createAgeVerification().getBoundaries('attestation/child');
    expect(result.boundariesRevision).toBe(2);
    expect(result.boundariesMatchAttestation).toBe(false);
    expect(result.boundaries).toEqual({ chat: false, dailyMinutes: 60 });
  });

  it('rejects invalid list parameters and blank resource identifiers', async () => {
    const ageVerification = createAgeVerification();
    await expect(ageVerification.listParentConnectRequests({ limit: 101 })).rejects.toThrow(
      ValidationError,
    );
    await expect(ageVerification.retrieveParentConnectRequest('')).rejects.toThrow(ValidationError);
    await expect(ageVerification.getBoundaries('')).rejects.toThrow(ValidationError);
  });
});
