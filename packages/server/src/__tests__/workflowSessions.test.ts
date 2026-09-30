import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { HttpClient, TypedEmitter, ValidationError, resolveConfig } from '@deepidv/core';
import { WorkflowSessions } from '../workflowSessions.js';
import { server } from './setup.js';

const BASE_URL = 'https://api.deepidv.com';

function createWorkflowSessions() {
  const config = resolveConfig({
    apiKey: 'sk_test_key_1234',
    baseUrl: BASE_URL,
    maxRetries: 2,
    initialRetryDelay: 1,
  });
  return new WorkflowSessions(new HttpClient(config, new TypedEmitter()));
}

const stateWire = {
  session_id: 'session_1',
  status: 'PENDING',
  session_progress: 'PENDING',
  steps: [
    {
      step_id: 'FACE_LIVENESS',
      status: 'PENDING',
      attempts: 0,
      started_at: null,
      completed_at: null,
      failure_reason: null,
      requirements: { challenge_type: 'FaceMovementChallenge', confidence_threshold: 70 },
    },
  ],
  current_step: 0,
  attempts_remaining: 3,
};

describe('WorkflowSessions', () => {
  it('retrieves and normalizes resumable execution state', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/sessions/session_1/workflow`, () => HttpResponse.json(stateWire)),
    );

    await expect(createWorkflowSessions().retrieve('session_1')).resolves.toEqual({
      sessionId: 'session_1',
      status: 'PENDING',
      sessionProgress: 'PENDING',
      steps: [
        {
          stepId: 'FACE_LIVENESS',
          status: 'PENDING',
          attempts: 0,
          startedAt: null,
          completedAt: null,
          failureReason: null,
          requirements: { challenge_type: 'FaceMovementChallenge', confidence_threshold: 70 },
        },
      ],
      currentStep: 0,
      attemptsRemaining: 3,
    });
  });

  it('starts by session ID and keeps the endpoint retryable', async () => {
    let attempts = 0;
    server.use(
      http.post(`${BASE_URL}/v1/sessions/session_1/workflow/start`, () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.json({ error: 'temporary' }, { status: 500 })
          : HttpResponse.json(stateWire);
      }),
    );

    await expect(createWorkflowSessions().start('session_1')).resolves.toEqual(
      expect.objectContaining({ sessionId: 'session_1' }),
    );
    expect(attempts).toBe(2);
  });

  it('serializes a face-liveness action and retains step-specific payload fields', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/sessions/session_1/steps/FACE_LIVENESS`, async ({ request }) => {
        expect(await request.json()).toEqual({
          action: 'upload-url',
          frame_count: 4,
          clip_mime_type: 'video/webm',
        });
        return HttpResponse.json({
          step_id: 'FACE_LIVENESS',
          step_status: 'IN_PROGRESS',
          failure_reason: null,
          current_step: 0,
          attempts_remaining: 3,
          session_status: 'PENDING',
          session_progress: 'STARTED',
          liveness: { frame_upload_urls: ['https://upload.example/1'] },
        });
      }),
    );

    await expect(
      createWorkflowSessions().submitStep('session_1', 'FACE_LIVENESS', {
        action: 'upload-url',
        frameCount: 4,
        clipMimeType: 'video/webm',
      }),
    ).resolves.toEqual({
      stepId: 'FACE_LIVENESS',
      stepStatus: 'IN_PROGRESS',
      failureReason: null,
      currentStep: 0,
      attemptsRemaining: 3,
      sessionStatus: 'PENDING',
      sessionProgress: 'STARTED',
      payload: { liveness: { frame_upload_urls: ['https://upload.example/1'] } },
    });
  });

  it('disables automatic retries for state-changing step submissions', async () => {
    let attempts = 0;
    server.use(
      http.post(`${BASE_URL}/v1/sessions/session_1/steps/PHONE_TRUST_CHECK`, () => {
        attempts += 1;
        return HttpResponse.json({ error: 'temporary' }, { status: 500 });
      }),
    );

    await expect(
      createWorkflowSessions().submitStep('session_1', 'PHONE_TRUST_CHECK', {}),
    ).rejects.toThrow();
    expect(attempts).toBe(1);
  });

  it('rejects invalid session IDs and step bodies before a request', async () => {
    await expect(createWorkflowSessions().retrieve('')).rejects.toThrow(ValidationError);
    await expect(
      createWorkflowSessions().submitStep('session_1', 'FACE_LIVENESS', {
        action: 'upload-url',
        frameCount: 0,
      }),
    ).rejects.toThrow(ValidationError);
  });
});
