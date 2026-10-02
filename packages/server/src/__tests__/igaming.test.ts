import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { HttpClient, TypedEmitter, ValidationError, resolveConfig } from '@deepidv/core';
import { IGaming } from '../igaming.js';
import { server } from './setup.js';

const BASE_URL = 'https://api.deepidv.com';

function createIGaming(maxRetries = 2) {
  const config = resolveConfig({ apiKey: 'sk_test', baseUrl: BASE_URL, maxRetries });
  return new IGaming(new HttpClient(config, new TypedEmitter()));
}

describe('IGaming', () => {
  it('analyzes injection signals using the snake-case wire contract', async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/v1/igaming/injection`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          verdict: 'HIT',
          action: 'block',
          confidence: 92,
          escalation: { type: 'address-verification', check: 'injection-detection' },
        });
      }),
    );
    const result = await createIGaming().analyzeInjection({
      sessionId: 'session_1',
      deviceIntegrity: { pass: false, score: 92 },
      mediaSource: { pass: true, score: 3, signals: ['camera'] },
    });
    expect(body).toEqual({
      session_id: 'session_1',
      device_integrity: { pass: false, score: 92, signals: [] },
      media_source: { pass: true, score: 3, signals: ['camera'] },
    });
    expect(result).toMatchObject({ verdict: 'HIT', confidence: 92 });
  });

  it.each([
    ['detectVpn', '/v1/igaming/vpn-detection'],
    ['checkIpJurisdiction', '/v1/igaming/ip-jurisdiction'],
  ] as const)('%s validates and submits the shared IP-check shape', async (method, path) => {
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}${path}`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          verdict: 'CLEAR',
          action: 'allow',
          evidence: { country: 'GB' },
          escalation: null,
        });
      }),
    );
    const result = await createIGaming()[method]({
      sessionId: 'session_1',
      ipAddress: '2001:db8::1',
    });
    expect(body).toEqual({ session_id: 'session_1', ip_address: '2001:db8::1' });
    expect(result.evidence).toEqual({ country: 'GB' });
  });

  it('analyzes anti-cheat with base64 image data and an optional device fingerprint', async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/v1/igaming/anti-cheat`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ verdict: 'DUPLICATE', action: 'manual-review' });
      }),
    );
    const result = await createIGaming().analyzeAntiCheat({
      sessionId: 'session_1',
      image: 'base64-image',
      deviceFingerprint: 'device_1',
    });
    expect(body).toEqual({
      session_id: 'session_1',
      image: 'base64-image',
      device_fingerprint: 'device_1',
    });
    expect(result).toEqual({ verdict: 'DUPLICATE', action: 'manual-review' });
  });

  it('purges an encoded anti-cheat enrollment and normalizes the result', async () => {
    let requestUrl = '';
    server.use(
      http.delete(`${BASE_URL}/v1/igaming/anti-cheat/session%2F1`, ({ request }) => {
        requestUrl = request.url;
        return HttpResponse.json({ deleted: true, face_id: 'face_1' });
      }),
    );
    const result = await createIGaming().purgeAntiCheatEnrollment('session/1');
    expect(requestUrl).toBe(`${BASE_URL}/v1/igaming/anti-cheat/session%2F1`);
    expect(result).toEqual({ deleted: true, faceId: 'face_1' });
  });

  it('lists and normalizes identity and face self-exclusion entries', async () => {
    let requestUrl = '';
    server.use(
      http.get(`${BASE_URL}/v1/igaming/self-exclusion`, ({ request }) => {
        requestUrl = request.url;
        return HttpResponse.json({
          entries: [
            {
              type: 'identity',
              document_number: 'DOC-1',
              reason: 'operator request',
              added_by: 'user_1',
              added_at: '2026-10-01T09:00:00.000Z',
              first_name: 'Jane',
              last_name: 'Doe',
            },
            {
              type: 'face',
              session_id: 'session_2',
              reason: null,
              excluded_at: null,
            },
          ],
          truncated: false,
        });
      }),
    );
    const result = await createIGaming().selfExclusion.list({ limit: 25 });
    expect(requestUrl).toBe(`${BASE_URL}/v1/igaming/self-exclusion?limit=25`);
    expect(result).toEqual({
      entries: [
        {
          type: 'identity',
          documentNumber: 'DOC-1',
          reason: 'operator request',
          addedBy: 'user_1',
          addedAt: '2026-10-01T09:00:00.000Z',
          firstName: 'Jane',
          lastName: 'Doe',
        },
        {
          type: 'face',
          sessionId: 'session_2',
          reason: null,
          excludedAt: null,
        },
      ],
      truncated: false,
    });
  });

  it('adds one or more identities and normalizes per-number statuses', async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/v1/igaming/self-exclusion/identity`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          excluded: [
            { document_number: 'DOC-1', status: 'added' },
            { document_number: 'DOC-2', status: 'already_excluded' },
          ],
        });
      }),
    );
    const result = await createIGaming().selfExclusion.addIdentity({
      documentNumbers: ['DOC-1', 'DOC-2'],
      reason: 'self-excluded',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    expect(body).toEqual({
      document_numbers: ['DOC-1', 'DOC-2'],
      reason: 'self-excluded',
      first_name: 'Jane',
      last_name: 'Doe',
    });
    expect(result.excluded).toEqual([
      { documentNumber: 'DOC-1', status: 'added' },
      { documentNumber: 'DOC-2', status: 'already_excluded' },
    ]);
  });

  it('removes an encoded identity exclusion and reports linked face cleanup', async () => {
    server.use(
      http.delete(`${BASE_URL}/v1/igaming/self-exclusion/identity/DOC%2F1`, () =>
        HttpResponse.json({ removed: true, face_unexcluded: true }),
      ),
    );
    await expect(createIGaming().selfExclusion.removeIdentity('DOC/1')).resolves.toEqual({
      removed: true,
      faceUnexcluded: true,
    });
  });

  it('adds and removes a face exclusion with matched-enrollment fallback fields', async () => {
    let addBody: unknown;
    server.use(
      http.post(`${BASE_URL}/v1/igaming/self-exclusion/face`, async ({ request }) => {
        addBody = await request.json();
        return HttpResponse.json({
          excluded: true,
          session_id: 'session_1',
          matched_session_id: 'session_original',
        });
      }),
      http.delete(`${BASE_URL}/v1/igaming/self-exclusion/face/session_1`, () =>
        HttpResponse.json({ unexcluded: true, matched_session_id: 'session_original' }),
      ),
    );
    const igaming = createIGaming();
    await expect(
      igaming.selfExclusion.addFace({ sessionId: 'session_1', reason: 'applicant request' }),
    ).resolves.toEqual({
      excluded: true,
      sessionId: 'session_1',
      matchedSessionId: 'session_original',
    });
    expect(addBody).toEqual({ session_id: 'session_1', reason: 'applicant request' });
    await expect(igaming.selfExclusion.removeFace('session_1')).resolves.toEqual({
      unexcluded: true,
      matchedSessionId: 'session_original',
    });
  });

  it('preserves a successful response when no enrolled face was excluded', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/igaming/self-exclusion/face`, () =>
        HttpResponse.json({ excluded: false, reason: 'no_enrolled_face' }),
      ),
    );

    await expect(
      createIGaming().selfExclusion.addFace({ sessionId: 'session_without_face' }),
    ).resolves.toEqual({ excluded: false, reason: 'no_enrolled_face' });
  });

  it('excludes an applicant and normalizes compound face and identity results', async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/v1/igaming/self-exclusion/applicant`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          face_attached: true,
          document_number: 'DOC-1',
          identity_status: 'added',
          matched_session_id: 'session_original',
        });
      }),
    );
    const result = await createIGaming().selfExclusion.addApplicant({
      sessionId: 'session_1',
      reason: 'applicant request',
    });
    expect(body).toEqual({ session_id: 'session_1', reason: 'applicant request' });
    expect(result).toEqual({
      faceAttached: true,
      documentNumber: 'DOC-1',
      identityStatus: 'added',
      matchedSessionId: 'session_original',
    });
  });

  it('preserves a successful response when no applicant exclusion was attached', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/igaming/self-exclusion/applicant`, () =>
        HttpResponse.json({
          face_attached: false,
          document_number: null,
          message: 'No enrolled face or document number was available',
        }),
      ),
    );

    await expect(
      createIGaming().selfExclusion.addApplicant({ sessionId: 'session_without_identifiers' }),
    ).resolves.toEqual({
      faceAttached: false,
      documentNumber: null,
      message: 'No enrolled face or document number was available',
    });
  });

  it('validates IPs, list limits, registry inputs, and identifiers locally', async () => {
    const igaming = createIGaming();
    await expect(
      igaming.detectVpn({ sessionId: 'session_1', ipAddress: 'not-an-ip' }),
    ).rejects.toThrow(ValidationError);
    await expect(igaming.selfExclusion.list({ limit: 1001 })).rejects.toThrow(ValidationError);
    await expect(igaming.selfExclusion.addIdentity({ reason: 'missing identity' })).rejects.toThrow(
      ValidationError,
    );
    await expect(
      igaming.selfExclusion.addIdentity({
        documentNumber: 'DOC-1',
        documentNumbers: ['DOC-2'],
      }),
    ).rejects.toThrow(ValidationError);
    await expect(igaming.selfExclusion.removeIdentity('')).rejects.toThrow(ValidationError);
    await expect(igaming.purgeAntiCheatEnrollment('')).rejects.toThrow(ValidationError);
  });

  it('does not retry session-mutating analysis calls', async () => {
    let calls = 0;
    server.use(
      http.post(`${BASE_URL}/v1/igaming/injection`, () => {
        calls += 1;
        return HttpResponse.json({ error: 'down' }, { status: 503 });
      }),
    );
    await expect(createIGaming(2).analyzeInjection({ sessionId: 'session_1' })).rejects.toThrow();
    expect(calls).toBe(1);
  });
});
