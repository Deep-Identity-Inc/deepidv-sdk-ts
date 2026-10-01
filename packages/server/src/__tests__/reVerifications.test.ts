import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
  DeepIDVError,
  HttpClient,
  TypedEmitter,
  ValidationError,
  resolveConfig,
} from '@deepidv/core';
import { ReVerifications } from '../reVerifications.js';
import { server } from './setup.js';

const BASE_URL = 'https://api.deepidv.com';
const RE_VERIFICATION_ID = '11111111-1111-4111-8111-111111111111';

function createReVerifications(maxRetries = 0) {
  const config = resolveConfig({
    apiKey: 'sk_test_key_1234',
    baseUrl: BASE_URL,
    maxRetries,
    initialRetryDelay: 1,
  });
  return new ReVerifications(new HttpClient(config, new TypedEmitter()));
}

describe('ReVerifications', () => {
  it('creates a pending session using the snake-case wire contract', async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/v1/re-verifications`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          {
            re_verification_id: RE_VERIFICATION_ID,
            workflow_id: 'workflow_123',
            status: 'PENDING',
            expires_at: '2026-10-02T10:00:00.000Z',
            liveness: { challenge_type: 'FaceMovementAndLightChallenge' },
          },
          { status: 201 },
        );
      }),
    );

    const result = await createReVerifications().create({
      workflowId: 'workflow_123',
      deviceFingerprint: 'device_123',
    });

    expect(body).toEqual({
      workflow_id: 'workflow_123',
      device_fingerprint: 'device_123',
    });
    expect(result).toEqual({
      reVerificationId: RE_VERIFICATION_ID,
      workflowId: 'workflow_123',
      status: 'PENDING',
      expiresAt: '2026-10-02T10:00:00.000Z',
      liveness: { challengeType: 'FaceMovementAndLightChallenge' },
    });
  });

  it('starts a fresh liveness attempt and preserves challenge-script casing', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/re-verifications/${RE_VERIFICATION_ID}/liveness/start`, () =>
        HttpResponse.json({
          liveness_session_id: 'liveness_123',
          script: {
            challengeType: 'FaceMovementAndLightChallenge',
            durationMs: 4_000,
            steps: [
              { kind: 'color', atMs: 0, color: '#FF0000' },
              { kind: 'move-closer', atMs: 2_000 },
            ],
          },
        }),
      ),
    );

    const result = await createReVerifications().startLiveness(RE_VERIFICATION_ID);
    expect(result.livenessSessionId).toBe('liveness_123');
    expect(result.script.steps[0]).toEqual({ kind: 'color', atMs: 0, color: '#FF0000' });
  });

  it('requests capture upload targets and safely retries URL re-minting', async () => {
    let attempts = 0;
    let body: unknown;
    server.use(
      http.post(
        `${BASE_URL}/v1/re-verifications/${RE_VERIFICATION_ID}/liveness/upload-url`,
        async ({ request }) => {
          attempts += 1;
          body = await request.json();
          if (attempts === 1) {
            return HttpResponse.json({ error: 'temporary' }, { status: 500 });
          }
          return HttpResponse.json({
            frame_upload_urls: ['https://s3.example/frame-0', 'https://s3.example/frame-1'],
            frame_keys: ['capture/frame-0', 'capture/frame-1'],
            timeline_upload_url: 'https://s3.example/timeline',
            timeline_key: 'capture/timeline.json',
            clip_upload_url: 'https://s3.example/clip',
            clip_key: 'capture/clip.mp4',
          });
        },
      ),
    );

    const result = await createReVerifications(2).createLivenessUploadUrl(RE_VERIFICATION_ID, {
      frameCount: 4,
      clipMimeType: 'video/mp4',
    });

    expect(attempts).toBe(2);
    expect(body).toEqual({ frame_count: 4, clip_mime_type: 'video/mp4' });
    expect(result).toMatchObject({
      frameKeys: ['capture/frame-0', 'capture/frame-1'],
      timelineKey: 'capture/timeline.json',
      clipKey: 'capture/clip.mp4',
    });
  });

  it('rejects invalid lifecycle identifiers, frame counts, and extra input fields', async () => {
    const reVerifications = createReVerifications();
    await expect(reVerifications.startLiveness('not-a-uuid')).rejects.toThrow(ValidationError);
    await expect(
      reVerifications.createLivenessUploadUrl(RE_VERIFICATION_ID, { frameCount: 2 }),
    ).rejects.toThrow(ValidationError);
    await expect(
      reVerifications.create({ workflowId: 'workflow_123', extra: true } as never),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects an inconsistent upload-target response', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/re-verifications/${RE_VERIFICATION_ID}/liveness/upload-url`, () =>
        HttpResponse.json({
          frame_upload_urls: ['https://s3.example/frame-0'],
          frame_keys: [],
          timeline_upload_url: 'https://s3.example/timeline',
          timeline_key: 'capture/timeline.json',
        }),
      ),
    );

    await expect(
      createReVerifications().createLivenessUploadUrl(RE_VERIFICATION_ID, { frameCount: 3 }),
    ).rejects.toThrow('frameKeys must contain one key for each frameUploadUrl');
  });

  it('completes liveness and normalizes the synchronous decision', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/re-verifications/${RE_VERIFICATION_ID}/liveness/complete`, () =>
        HttpResponse.json({
          decision: 'verified',
          failed_attempts: 0,
          max_attempts: 3,
          liveness: { status: 'SUCCEEDED', confidence: 97.2 },
          user_id: 'user_123',
          original_session_id: 'session_123',
        }),
      ),
    );

    const result = await createReVerifications().completeLiveness(RE_VERIFICATION_ID);
    expect(result).toEqual({
      decision: 'verified',
      failedAttempts: 0,
      maxAttempts: 3,
      liveness: { status: 'SUCCEEDED', confidence: 97.2 },
      userId: 'user_123',
      originalSessionId: 'session_123',
    });
  });

  it.each([
    ['create', `${BASE_URL}/v1/re-verifications`],
    ['start', `${BASE_URL}/v1/re-verifications/${RE_VERIFICATION_ID}/liveness/start`],
    ['complete', `${BASE_URL}/v1/re-verifications/${RE_VERIFICATION_ID}/liveness/complete`],
  ])('does not retry the state-changing %s request', async (operation, url) => {
    let attempts = 0;
    server.use(
      http.post(url, () => {
        attempts += 1;
        return HttpResponse.json({ error: 'failed' }, { status: 500 });
      }),
    );

    const reVerifications = createReVerifications(2);
    const request =
      operation === 'create'
        ? reVerifications.create({ workflowId: 'workflow_123' })
        : operation === 'start'
          ? reVerifications.startLiveness(RE_VERIFICATION_ID)
          : reVerifications.completeLiveness(RE_VERIFICATION_ID);

    await expect(request).rejects.toThrow(DeepIDVError);
    expect(attempts).toBe(1);
  });
});
