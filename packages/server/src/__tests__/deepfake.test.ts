import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
  DeepIDVError,
  HttpClient,
  TypedEmitter,
  ValidationError,
  resolveConfig,
} from '@deepidv/core';
import { Deepfake } from '../deepfake.js';
import type { DeepfakeAnalyzeInput } from '../deepfake.types.js';
import { server } from './setup.js';

const BASE_URL = 'https://api.deepidv.com';
const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const VERIFICATION_ID = '22222222-2222-4222-8222-222222222222';

function createDeepfake(maxRetries = 0) {
  const config = resolveConfig({
    apiKey: 'sk_test_key_1234',
    baseUrl: BASE_URL,
    maxRetries,
    initialRetryDelay: 1,
  });
  return new Deepfake(new HttpClient(config, new TypedEmitter()));
}

function analyzeInput(): DeepfakeAnalyzeInput {
  return {
    scanDurationMs: 4_000,
    challengeWord: 'blue river stone',
    frameMeta: Array.from({ length: 6 }, (_, index) => ({
      actionId: `action-${String(index)}`,
      action: index === 1 ? 'blink' : 'hold-still',
      timestamp: index * 100,
      yaw: 0,
      pitch: 0,
      roll: 0,
      leftEyeOpenness: 1,
      rightEyeOpenness: 1,
      faceDetected: true,
    })),
    s3Keys: {
      frame_0: 'org/session/frame_0',
      frame_1: 'org/session/frame_1',
      frame_2: 'org/session/frame_2',
      frame_3: 'org/session/frame_3',
      frame_4: 'org/session/frame_4',
      frame_5: 'org/session/frame_5',
      audio_clip: 'org/session/audio_clip',
    },
  };
}

const ANALYZE_RESULT = {
  success: true,
  passed: true,
  confidence: 92,
  verdict: 'LIVE',
  riskScore: 8,
  trustVerdict: 'PASS',
  trustScore: 94,
  challengeWord: 'blue river stone',
  failureReasons: [],
  verificationId: VERIFICATION_ID,
  timestamp: '2026-09-30T00:00:00.000Z',
  details: {
    layers: { vision: { passed: true } },
    avgLayerConfidence: 92,
    trustBreakdown: { liveness: 95 },
    degradedModules: [],
  },
};

describe('Deepfake', () => {
  it('fetches a session challenge and validates the session UUID', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/deepfake/challenge/${SESSION_ID}`, () =>
        HttpResponse.json({ sessionId: SESSION_ID, challengeWord: 'blue river stone' }),
      ),
    );

    await expect(createDeepfake().getChallenge(SESSION_ID)).resolves.toEqual({
      sessionId: SESSION_ID,
      challengeWord: 'blue river stone',
    });
    await expect(createDeepfake().getChallenge('not-a-uuid')).rejects.toThrow(ValidationError);
  });

  it('creates the documented upload bundle', async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/v1/deepfake/upload-urls`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          sessionId: SESSION_ID,
          uploadUrls: { frame_0: 'https://s3.example/frame-0' },
          uploadKeys: { frame_0: 'org/session/deepfake/frame_0' },
        });
      }),
    );

    const result = await createDeepfake().createUploadUrls({
      sessionId: SESSION_ID,
      includeAudio: true,
    });
    expect(body).toEqual({ sessionId: SESSION_ID, includeAudio: true });
    expect(result.uploadKeys.frame_0).toContain('deepfake/frame_0');
  });

  it('submits exactly six frames and returns the typed verdict', async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/v1/deepfake/analyze`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(ANALYZE_RESULT);
      }),
    );

    const result = await createDeepfake().analyze(analyzeInput());
    expect((body as DeepfakeAnalyzeInput).frameMeta).toHaveLength(6);
    expect(result.verdict).toBe('LIVE');
    expect(result.details.degradedModules).toEqual([]);
  });

  it('rejects analysis input that does not contain exactly six frames', async () => {
    const input = analyzeInput();
    input.frameMeta.pop();
    await expect(createDeepfake().analyze(input)).rejects.toThrow(ValidationError);
  });

  it('does not retry a billable analysis request', async () => {
    let attempts = 0;
    server.use(
      http.post(`${BASE_URL}/v1/deepfake/analyze`, () => {
        attempts += 1;
        return HttpResponse.json({ error: 'analysis failed' }, { status: 500 });
      }),
    );

    await expect(createDeepfake(2).analyze(analyzeInput())).rejects.toThrow(DeepIDVError);
    expect(attempts).toBe(1);
  });
});
