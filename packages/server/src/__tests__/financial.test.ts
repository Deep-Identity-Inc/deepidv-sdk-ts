import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { HttpClient, TypedEmitter, ValidationError, resolveConfig } from '@deepidv/core';
import { Financial } from '../financial.js';
import { server } from './setup.js';

const BASE_URL = 'https://api.deepidv.com';

function createFinancial(maxRetries = 0) {
  const config = resolveConfig({ apiKey: 'sk_test', baseUrl: BASE_URL, maxRetries });
  return new Financial(new HttpClient(config, new TypedEmitter()));
}

const record = {
  id: 'fin_1',
  organizationId: 'org_1',
  userId: 'user_1',
  senderUserId: 'sender_1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  status: 'pending',
  type: 'bank-statement',
  Config: { period: '3' },
};

describe('Financial', () => {
  it('creates a request with the documented camel-case body', async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/v1/financial`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          bankStatementId: 'fin_1',
          bankStatementUrl: 'https://verify/1',
          links: [],
        });
      }),
    );
    await expect(
      createFinancial().create({
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '+15192223333',
        period: '3',
      }),
    ).resolves.toMatchObject({ bankStatementId: 'fin_1' });
    expect(body).toEqual({
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '+15192223333',
      period: '3',
    });
  });

  it('serializes cursors and normalizes record Config', async () => {
    let token: string | null = null;
    server.use(
      http.get(`${BASE_URL}/v1/financial`, ({ request }) => {
        token = new URL(request.url).searchParams.get('nextToken');
        return HttpResponse.json({ bankStatements: [record], nextToken: null });
      }),
    );
    const result = await createFinancial().list({ nextToken: 'a+b/c=' });
    expect(token).toBe('a+b/c=');
    expect(result.bankStatements[0]?.config).toEqual({ period: '3' });
    expect(result.nextToken).toBeNull();
  });

  it('encodes record and external IDs', async () => {
    const paths: string[] = [];
    server.use(
      http.get(`${BASE_URL}/v1/financial/:id`, ({ request, params }) => {
        paths.push(new URL(request.url).pathname);
        return params.id === 'externalId'
          ? HttpResponse.json({ bankStatements: [], nextToken: null })
          : HttpResponse.json(record);
      }),
      http.get(`${BASE_URL}/v1/financial/externalId/:externalId`, ({ request }) => {
        paths.push(new URL(request.url).pathname);
        return HttpResponse.json({ bankStatements: [], nextToken: null });
      }),
    );
    await createFinancial().retrieve('fin/1');
    await createFinancial().listByExternalId('customer/1');
    expect(paths).toContain('/v1/financial/fin%2F1');
    expect(paths).toContain('/v1/financial/externalId/customer%2F1');
  });

  it('rejects invalid inputs before transmission', async () => {
    await expect(
      createFinancial().create({ email: 'x', firstName: 'J', lastName: 'D', phone: '123' }),
    ).rejects.toThrow(ValidationError);
    await expect(createFinancial().retrieve('')).rejects.toThrow(ValidationError);
  });

  it('does not retry a create request', async () => {
    let calls = 0;
    server.use(
      http.post(`${BASE_URL}/v1/financial`, () => {
        calls += 1;
        return HttpResponse.json({ error: 'down' }, { status: 503 });
      }),
    );
    await expect(
      createFinancial(2).create({
        email: 'x',
        firstName: 'J',
        lastName: 'D',
        phone: '+15192223333',
      }),
    ).rejects.toThrow();
    expect(calls).toBe(1);
  });
});
