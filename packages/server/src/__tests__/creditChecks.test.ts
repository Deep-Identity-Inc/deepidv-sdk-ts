import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { HttpClient, TypedEmitter, ValidationError, resolveConfig } from '@deepidv/core';
import { CreditChecks } from '../creditChecks.js';
import { server } from './setup.js';

const BASE_URL = 'https://api.deepidv.com';

function createCreditChecks(maxRetries = 0) {
  const config = resolveConfig({ apiKey: 'sk_test', baseUrl: BASE_URL, maxRetries });
  return new CreditChecks(new HttpClient(config, new TypedEmitter()));
}

const input = {
  email: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  phone: '+15192223333',
};

describe('CreditChecks', () => {
  it.each([
    ['hard', 'credit-check-hard'],
    ['soft', 'credit-check-soft'],
  ] as const)(
    'creates a %s credit-check session and normalizes session_url',
    async (kind, type) => {
      server.use(
        http.post(`${BASE_URL}/v1/credit-check/${kind}`, () =>
          HttpResponse.json({
            id: `${kind}_1`,
            session_url: `https://verify/${kind}_1`,
            type,
            links: [],
          }),
        ),
      );
      const result =
        kind === 'hard'
          ? await createCreditChecks().createHard(input)
          : await createCreditChecks().createSoft(input);
      expect(result).toMatchObject({
        id: `${kind}_1`,
        sessionUrl: `https://verify/${kind}_1`,
        type,
      });
    },
  );

  it('validates phone and HTTPS redirect URLs locally', async () => {
    await expect(createCreditChecks().createHard({ ...input, phone: '123' })).rejects.toThrow(
      ValidationError,
    );
    await expect(
      createCreditChecks().createSoft({ ...input, redirectUrl: 'http://example.com' }),
    ).rejects.toThrow(ValidationError);
  });

  it('does not retry a billable create request', async () => {
    let calls = 0;
    server.use(
      http.post(`${BASE_URL}/v1/credit-check/hard`, () => {
        calls += 1;
        return HttpResponse.json({ error: 'down' }, { status: 503 });
      }),
    );
    await expect(createCreditChecks(2).createHard(input)).rejects.toThrow();
    expect(calls).toBe(1);
  });
});
