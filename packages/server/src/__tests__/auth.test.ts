import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { AuthenticationError, HttpClient, TypedEmitter, resolveConfig } from '@deepidv/core';
import { Auth } from '../auth.js';
import { server } from './setup.js';

const BASE_URL = 'https://api.deepidv.com';

function createAuth() {
  const config = resolveConfig({
    apiKey: 'sk_test_key_1234',
    baseUrl: BASE_URL,
    maxRetries: 0,
  });
  return new Auth(new HttpClient(config, new TypedEmitter()));
}

describe('Auth.verify', () => {
  it('returns the organization attached to the configured API key', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/auth/verify`, () =>
        HttpResponse.json({
          valid: true,
          organization: { id: 'org_1', name: 'Acme Inc.', status: 'active' },
        }),
      ),
    );

    await expect(createAuth().verify()).resolves.toEqual({
      valid: true,
      organization: { id: 'org_1', name: 'Acme Inc.', status: 'active' },
    });
  });

  it('maps an invalid API key to AuthenticationError', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/auth/verify`, () =>
        HttpResponse.json({ error: 'Invalid API key' }, { status: 401 }),
      ),
    );

    await expect(createAuth().verify()).rejects.toThrow(AuthenticationError);
  });
});
