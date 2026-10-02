import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
  HttpClient,
  RateLimitError,
  TypedEmitter,
  ValidationError,
  resolveConfig,
} from '@deepidv/core';
import { Aml } from '../aml.js';
import {
  AmlQuotaExceededSchema,
  AmlSaveTransactionsInputSchema,
  AmlTransactionInputSchema,
} from '../aml.types.js';
import { server } from './setup.js';

const BASE_URL = 'https://api.deepidv.com';

function createAml(maxRetries = 0) {
  const config = resolveConfig({
    apiKey: 'sk_test',
    baseUrl: BASE_URL,
    maxRetries,
    initialRetryDelay: 1,
  });
  return new Aml(new HttpClient(config, new TypedEmitter()));
}

const transaction = () => ({
  clientTxnId: 'txn-1',
  subjectUserId: 'subject-1',
  timestamp: '2026-08-01T09:00:00Z',
  direction: 'outbound' as const,
  amount: { value: 12500, currency: 'USD' },
  type: 'wire' as const,
});

describe('Aml', () => {
  it('submits a wrapped transaction batch using the snake-case wire contract', async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/v1/aml/transactions`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          accepted: 1,
          warned: 0,
          rejected: 0,
          results: [{ index: 0, client_txn_id: 'txn-1', status: 'accepted' }],
        });
      }),
    );

    const result = await createAml().saveTransactions({
      botId: 'bot-1',
      transactions: [
        {
          ...transaction(),
          normalizedAmount: { value: 9250, currency: 'USD', fxRate: 0.74 },
          fxRate: 0.74,
          counterparty: {
            externalId: 'counterparty-1',
            accountNumber: '1234',
            walletAddress: '0xabc',
          },
          geography: {
            originCountry: 'US',
            destinationCountry: 'GB',
            ipCountry: 'CA',
            ipAddress: '203.0.113.42',
          },
          crypto: {
            assetType: 'BTC',
            txHash: 'hash',
            walletFrom: 'from',
            walletTo: 'to',
            amountAsset: 1.5,
          },
          subject: { firstName: 'Jane', lastName: 'Doe' },
        },
      ],
    });

    expect(body).toEqual({
      bot_id: 'bot-1',
      transactions: [
        {
          client_txn_id: 'txn-1',
          subject_user_id: 'subject-1',
          timestamp: '2026-08-01T09:00:00Z',
          direction: 'outbound',
          amount: { value: 12500, currency: 'USD' },
          type: 'wire',
          normalized_amount: { value: 9250, currency: 'USD', fx_rate: 0.74 },
          fx_rate: 0.74,
          counterparty: {
            external_id: 'counterparty-1',
            account_number: '1234',
            wallet_address: '0xabc',
          },
          geography: {
            origin_country: 'US',
            destination_country: 'GB',
            ip_country: 'CA',
            ip_address: '203.0.113.42',
          },
          crypto: {
            asset_type: 'BTC',
            tx_hash: 'hash',
            wallet_from: 'from',
            wallet_to: 'to',
            amount_asset: 1.5,
          },
          subject: { first_name: 'Jane', last_name: 'Doe' },
        },
      ],
    });
    expect(result).toEqual({
      accepted: 1,
      warned: 0,
      rejected: 0,
      results: [{ index: 0, clientTxnId: 'txn-1', status: 'accepted' }],
    });
  });

  it('accepts a bare array and preserves metadata keys byte-for-byte', async () => {
    let body: unknown;
    const metadata = {
      someKey: 1,
      another_key: 2,
      nestedValue: { innerKey: true, inner_key: false },
    };
    server.use(
      http.post(`${BASE_URL}/v1/aml/transactions`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          accepted: 1,
          warned: 0,
          rejected: 0,
          results: [{ index: 0, client_txn_id: 'txn-1', status: 'accepted' }],
        });
      }),
    );

    await createAml().saveTransactions([{ ...transaction(), metadata }]);

    expect(body).toEqual([
      {
        client_txn_id: 'txn-1',
        subject_user_id: 'subject-1',
        timestamp: '2026-08-01T09:00:00Z',
        direction: 'outbound',
        amount: { value: 12500, currency: 'USD' },
        type: 'wire',
        metadata,
      },
    ]);
    const sentMetadata = (body as Array<{ metadata: unknown }>)[0]?.metadata;
    expect(JSON.stringify(sentMetadata)).toBe(JSON.stringify(metadata));
  });

  it('returns mixed per-record outcomes and normalizes error field paths', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/aml/transactions`, () =>
        HttpResponse.json({
          accepted: 2,
          warned: 1,
          rejected: 1,
          results: [
            { index: 0, client_txn_id: 'txn-1', status: 'accepted' },
            {
              index: 1,
              client_txn_id: 'txn-2',
              status: 'warned',
              warnings: ['NORMALIZED_AMOUNT_MISSING'],
            },
            {
              index: 2,
              client_txn_id: null,
              status: 'rejected',
              errors: [
                {
                  code: 'FIELD_INVALID',
                  field: 'normalized_amount.fx_rate',
                  message: 'Invalid value',
                },
              ],
            },
          ],
        }),
      ),
    );

    const result = await createAml().saveTransactions([
      transaction(),
      { ...transaction(), clientTxnId: 'txn-2' },
      { garbage: true } as never,
    ]);

    expect(result.results[1]).toMatchObject({
      clientTxnId: 'txn-2',
      status: 'warned',
      warnings: ['NORMALIZED_AMOUNT_MISSING'],
    });
    expect(result.results[2]).toMatchObject({
      clientTxnId: null,
      status: 'rejected',
      errors: [{ field: 'normalizedAmount.fxRate' }],
    });
  });

  it('leaves individual record validation to the API', async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/v1/aml/transactions`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          accepted: 0,
          warned: 0,
          rejected: 1,
          results: [
            {
              index: 0,
              client_txn_id: null,
              status: 'rejected',
              errors: [{ code: 'FIELD_INVALID', field: null, message: 'Invalid record' }],
            },
          ],
        });
      }),
    );

    const result = await createAml().saveTransactions([{ garbage: true } as never]);
    expect(body).toEqual([{ garbage: true }]);
    expect(result.rejected).toBe(1);
  });

  it('validates envelope limits while offering explicit full-record validation', async () => {
    const aml = createAml();
    await expect(aml.saveTransactions([])).rejects.toThrow(ValidationError);
    await expect(
      aml.saveTransactions(Array.from({ length: 501 }, () => transaction())),
    ).rejects.toThrow(ValidationError);
    expect(
      AmlSaveTransactionsInputSchema.safeParse(Array.from({ length: 500 }, () => transaction()))
        .success,
    ).toBe(true);
    expect(AmlTransactionInputSchema.safeParse(transaction()).success).toBe(true);
    expect(AmlTransactionInputSchema.safeParse({ garbage: true }).success).toBe(false);
  });

  it('exposes structured quota details from a RateLimitError body', async () => {
    let calls = 0;
    server.use(
      http.post(`${BASE_URL}/v1/aml/transactions`, () => {
        calls += 1;
        return HttpResponse.json(
          {
            error: 'Monthly transaction quota exceeded',
            code: 'QUOTA_EXCEEDED',
            quota: 100000,
            used: 100000,
            remaining: 0,
            month: '2026-08',
            resets_at: '2026-09-01T00:00:00.000Z',
          },
          { status: 429 },
        );
      }),
    );

    let error: unknown;
    try {
      await createAml(3).saveTransactions([transaction()]);
    } catch (caught: unknown) {
      error = caught;
    }
    expect(error).toBeInstanceOf(RateLimitError);
    expect(AmlQuotaExceededSchema.parse((error as RateLimitError).response?.body)).toMatchObject({
      code: 'QUOTA_EXCEEDED',
      resetsAt: '2026-09-01T00:00:00.000Z',
    });
    expect(calls).toBe(1);
  });

  it('enrols a monitored user with an encoded bot id and normalizes the result', async () => {
    let requestUrl = '';
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/v1/aml/bots/bot%2F1/monitored-users`, async ({ request }) => {
        requestUrl = request.url;
        body = await request.json();
        return HttpResponse.json({
          org_id: 'org-1',
          bot_id: 'bot/1',
          subject_user_id: 'subject-1',
          subject_user_name: 'Jane Doe',
          subject_country: 'US',
          status: 'active',
          cadence_days: 30,
          next_check_at: '2026-09-02T09:00:00.000Z',
          last_checked_at: null,
          added_at: '2026-08-03T09:00:00.000Z',
          added_by: 'key-1',
          updated_at: '2026-08-03T09:00:00.000Z',
        });
      }),
    );

    const result = await createAml().addMonitoredUser('bot/1', {
      subjectUserId: 'subject-1',
    });
    expect(requestUrl).toBe(`${BASE_URL}/v1/aml/bots/bot%2F1/monitored-users`);
    expect(body).toEqual({ subject_user_id: 'subject-1' });
    expect(result).toMatchObject({
      orgId: 'org-1',
      botId: 'bot/1',
      subjectUserId: 'subject-1',
      cadenceDays: 30,
      lastCheckedAt: null,
    });
  });

  it('validates monitored-user identifiers locally', async () => {
    const aml = createAml();
    await expect(aml.addMonitoredUser('', { subjectUserId: 'subject-1' })).rejects.toThrow(
      ValidationError,
    );
    await expect(aml.addMonitoredUser('bot-1', { subjectUserId: '' })).rejects.toThrow(
      ValidationError,
    );
  });

  it('does not retry transaction ingestion after a transient failure', async () => {
    let calls = 0;
    server.use(
      http.post(`${BASE_URL}/v1/aml/transactions`, () => {
        calls += 1;
        return HttpResponse.json({ error: 'down' }, { status: 503 });
      }),
    );

    await expect(createAml(2).saveTransactions([transaction()])).rejects.toThrow();
    expect(calls).toBe(1);
  });

  it('retries idempotent monitored-user enrolment', async () => {
    let calls = 0;
    server.use(
      http.post(`${BASE_URL}/v1/aml/bots/bot-1/monitored-users`, () => {
        calls += 1;
        if (calls === 1) return HttpResponse.json({ error: 'down' }, { status: 503 });
        return HttpResponse.json({
          org_id: 'org-1',
          bot_id: 'bot-1',
          subject_user_id: 'subject-1',
          subject_user_name: null,
          subject_country: 'XX',
          status: 'active',
          cadence_days: 30,
          next_check_at: '2026-09-02T09:00:00.000Z',
          last_checked_at: null,
          added_at: '2026-08-03T09:00:00.000Z',
          added_by: null,
          updated_at: '2026-08-03T09:00:00.000Z',
        });
      }),
    );

    await createAml(1).addMonitoredUser('bot-1', { subjectUserId: 'subject-1' });
    expect(calls).toBe(2);
  });
});
