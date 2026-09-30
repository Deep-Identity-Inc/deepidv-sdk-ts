import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { HttpClient, TypedEmitter, ValidationError, resolveConfig } from '@deepidv/core';
import { CreditTerms } from '../creditTerms.js';
import { server } from './setup.js';

const BASE_URL = 'https://api.deepidv.com';

function createCreditTerms() {
  const config = resolveConfig({ apiKey: 'sk_test', baseUrl: BASE_URL, maxRetries: 0 });
  return new CreditTerms(new HttpClient(config, new TypedEmitter()));
}

const record = {
  id: 'ct_1',
  organizationId: 'org_1',
  userId: 'user_1',
  senderUserId: 'sender_1',
  createdAt: 'now',
  updatedAt: 'now',
  status: 'pending',
  type: 'credit-terms',
  Config: { period: '30' },
};

describe('CreditTerms', () => {
  it('creates a credit-terms request', async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/v1/credit-terms`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          creditTermsId: 'ct_1',
          creditTermsUrl: 'https://verify/ct_1',
          links: [],
        });
      }),
    );
    await expect(
      createCreditTerms().create({
        firstName: 'Jane',
        lastName: 'Doe',
        businessName: 'Acme',
        businessEmail: 'ap@acme.test',
        businessAddress: '1 Main St',
        requestedCreditAmount: 25000,
        requestedCreditPeriod: '30',
      }),
    ).resolves.toMatchObject({ creditTermsId: 'ct_1' });
    expect(body).toMatchObject({ businessName: 'Acme', requestedCreditAmount: 25000 });
  });

  it('lists, retrieves, and finds records by encoded external ID', async () => {
    let listToken: string | null = null;
    let externalPath = '';
    server.use(
      http.get(`${BASE_URL}/v1/credit-terms`, ({ request }) => {
        listToken = new URL(request.url).searchParams.get('nextToken');
        return HttpResponse.json({ creditTerms: [record], nextToken: 'next' });
      }),
      http.get(`${BASE_URL}/v1/credit-terms/externalId/:externalId`, ({ request }) => {
        externalPath = new URL(request.url).pathname;
        return HttpResponse.json({ creditTerms: [record], nextToken: null });
      }),
      http.get(`${BASE_URL}/v1/credit-terms/:id`, () => HttpResponse.json(record)),
    );
    const page = await createCreditTerms().list({ nextToken: 'cursor' });
    const retrieved = await createCreditTerms().retrieve('ct/1');
    await createCreditTerms().listByExternalId('customer/1');
    expect(listToken).toBe('cursor');
    expect(page.creditTerms[0]?.config).toEqual({ period: '30' });
    expect(retrieved.id).toBe('ct_1');
    expect(externalPath).toBe('/v1/credit-terms/externalId/customer%2F1');
  });

  it('validates amounts and identifiers locally', async () => {
    await expect(
      createCreditTerms().create({
        firstName: 'J',
        lastName: 'D',
        businessName: 'A',
        businessEmail: 'a',
        businessAddress: 'x',
        requestedCreditAmount: -1,
      }),
    ).rejects.toThrow(ValidationError);
    await expect(createCreditTerms().listByExternalId('')).rejects.toThrow(ValidationError);
  });
});
