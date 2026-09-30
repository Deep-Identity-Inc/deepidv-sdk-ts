import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { HttpClient, TypedEmitter, ValidationError, resolveConfig } from '@deepidv/core';
import { Workflows } from '../workflows.js';
import { server } from './setup.js';

const BASE_URL = 'https://api.deepidv.com';

function createWorkflows() {
  const config = resolveConfig({
    apiKey: 'sk_test_key_1234',
    baseUrl: BASE_URL,
    maxRetries: 2,
    initialRetryDelay: 1,
  });
  return new Workflows(new HttpClient(config, new TypedEmitter()));
}

const workflowWire = {
  id: 'wf_1',
  name: 'Identity flow',
  status: 'active',
  organization_id: 'org_1',
  created_at: '2026-09-01T10:00:00.000Z',
  updated_at: '2026-09-01T10:00:00.000Z',
  steps: [{ id: 'ID_VERIFICATION', config: { minimum_age: 18 } }],
};

describe('Workflows', () => {
  it('lists and normalizes workflow summaries', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/workflows`, () =>
        HttpResponse.json({
          workflows: [
            {
              id: 'wf_1',
              name: 'Identity flow',
              status: 'active',
              steps: ['ID_VERIFICATION', 'LEGACY_STEP'],
              created_at: '2026-09-01T10:00:00.000Z',
            },
          ],
        }),
      ),
    );

    await expect(createWorkflows().list()).resolves.toEqual({
      workflows: [
        {
          id: 'wf_1',
          name: 'Identity flow',
          status: 'active',
          steps: ['ID_VERIFICATION', 'LEGACY_STEP'],
          createdAt: '2026-09-01T10:00:00.000Z',
        },
      ],
    });
  });

  it('creates a workflow without automatically retrying the mutating request', async () => {
    let attempts = 0;
    server.use(
      http.post(`${BASE_URL}/v1/workflows`, async ({ request }) => {
        attempts += 1;
        expect(await request.json()).toEqual({
          name: 'Identity flow',
          steps: [{ id: 'ID_VERIFICATION', config: { minimum_age: 18 } }],
        });
        return HttpResponse.json({ error: 'temporary' }, { status: 500 });
      }),
    );

    await expect(
      createWorkflows().create({
        name: 'Identity flow',
        steps: [{ id: 'ID_VERIFICATION', config: { minimum_age: 18 } }],
      }),
    ).rejects.toThrow();
    expect(attempts).toBe(1);
  });

  it('rejects duplicate steps and invalid prerequisite order before the request', async () => {
    await expect(
      createWorkflows().create({
        name: 'Invalid',
        steps: [{ id: 'BACKGROUND_CHECK' }, { id: 'ID_VERIFICATION' }],
      }),
    ).rejects.toThrow(ValidationError);

    await expect(
      createWorkflows().create({
        name: 'Duplicate',
        steps: [{ id: 'ID_VERIFICATION' }, { id: 'ID_VERIFICATION' }],
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('retrieves and normalizes a workflow', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/workflows/wf_1`, () =>
        HttpResponse.json({ workflow: workflowWire }),
      ),
    );

    const result = await createWorkflows().retrieve('wf_1');
    expect(result.workflow.organizationId).toBe('org_1');
    expect(result.workflow.steps[0]).toEqual({
      id: 'ID_VERIFICATION',
      config: { minimum_age: 18 },
    });
  });

  it('patches the selected step config using the OpenAPI config shape', async () => {
    server.use(
      http.patch(
        `${BASE_URL}/v1/workflows/wf_1/steps/ID_VERIFICATION/config`,
        async ({ request }) => {
          expect(await request.json()).toEqual({ config: { minimum_age: 21 } });
          return HttpResponse.json({ workflow: workflowWire });
        },
      ),
    );

    const result = await createWorkflows().updateStepConfig('wf_1', 'ID_VERIFICATION', {
      minimum_age: 21,
    });
    expect(result.workflow.id).toBe('wf_1');
  });

  it('creates a headless workflow session with snake_case wire fields', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/workflows/wf_1/sessions`, async ({ request }) => {
        expect(await request.json()).toEqual({
          email: 'jane@example.com',
          first_name: 'Jane',
          last_name: 'Doe',
          phone: '+15192223333',
          external_id: 'customer_1',
          expires_in_hours: 24,
        });
        return HttpResponse.json({
          session_id: 'session_1',
          expires_at: '2026-10-01T10:00:00.000Z',
          steps: [
            {
              step_id: 'ID_VERIFICATION',
              status: 'PENDING',
              requirements: { document: { require_front_only: false } },
            },
          ],
          current_step: 0,
        });
      }),
    );

    await expect(
      createWorkflows().createSession('wf_1', {
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '+15192223333',
        externalId: 'customer_1',
        expiresInHours: 24,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        sessionId: 'session_1',
        currentStep: 0,
        steps: [expect.objectContaining({ stepId: 'ID_VERIFICATION' })],
      }),
    );
  });
});
