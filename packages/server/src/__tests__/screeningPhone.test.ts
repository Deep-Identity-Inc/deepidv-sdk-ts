import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { HttpClient, TypedEmitter, ValidationError, resolveConfig } from '@deepidv/core';
import { AsyncJobs } from '../asyncJobs.js';
import { Screening } from '../screening.js';
import { server } from './setup.js';

const BASE_URL = 'https://api.deepidv.com';

function createScreening(maxRetries = 0) {
  const config = resolveConfig({ apiKey: 'sk_test', baseUrl: BASE_URL, maxRetries });
  const client = new HttpClient(config, new TypedEmitter());
  return new Screening(client, new AsyncJobs(client));
}

describe('Screening phone checks', () => {
  it('runs a carrier age gate by phone or existing session', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${BASE_URL}/v1/screening/carrier-age-gate`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({
          outcome: 'PASS',
          ageVerified: 'VERIFIED',
          requiredAge: 18,
          statusMessage: 'Response from one supplier',
          checkedAt: '2026-01-01T00:00:00Z',
        });
      }),
    );
    await expect(
      createScreening().carrierAgeGate({ phone: '+447425604497' }),
    ).resolves.toMatchObject({ outcome: 'PASS' });
    await createScreening().carrierAgeGate({ sessionId: '123e4567-e89b-12d3-a456-426614174000' });
    expect(bodies).toEqual([
      { phone: '+447425604497' },
      { sessionId: '123e4567-e89b-12d3-a456-426614174000' },
    ]);
  });

  it('validates standalone ownership requirements and response score bounds', async () => {
    await expect(createScreening().phoneOwnership({ phone: '+447425604497' })).rejects.toThrow(
      ValidationError,
    );
    server.use(
      http.post(`${BASE_URL}/v1/screening/phone-ownership`, () =>
        HttpResponse.json({
          outcome: 'MATCH',
          nameScore: 98,
          strictness: 'strict',
          threshold: 90,
          statusMessage: 'Response from one supplier',
          checkedAt: '2026-01-01T00:00:00Z',
        }),
      ),
    );
    await expect(
      createScreening().phoneOwnership({
        phone: '+447425604497',
        firstName: 'Jane',
        strictness: 'strict',
      }),
    ).resolves.toMatchObject({ outcome: 'MATCH', nameScore: 98 });
  });

  it('returns typed phone-trust risk signals', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/screening/phone-trust`, () =>
        HttpResponse.json({
          tripped: true,
          tripReasons: ['SIM_SWAP_HIGH_RISK'],
          simSwappedRisk: 'HIGH_RISK',
          forwardingRisk: 'NO_RISK',
          sensitivity: 'medium',
          statusMessage: 'Response from one supplier',
          checkedAt: '2026-01-01T00:00:00Z',
        }),
      ),
    );
    await expect(createScreening().phoneTrust({ phone: '+447425604497' })).resolves.toMatchObject({
      tripped: true,
      simSwappedRisk: 'HIGH_RISK',
    });
  });

  it('rejects missing phone/session and does not retry provider failures', async () => {
    await expect(createScreening().phoneTrust({})).rejects.toThrow(ValidationError);
    let calls = 0;
    server.use(
      http.post(`${BASE_URL}/v1/screening/phone-trust`, () => {
        calls += 1;
        return HttpResponse.json({ error: 'down' }, { status: 503 });
      }),
    );
    await expect(createScreening(2).phoneTrust({ phone: '+447425604497' })).rejects.toThrow();
    expect(calls).toBe(1);
  });
});
