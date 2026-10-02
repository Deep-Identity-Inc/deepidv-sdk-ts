import { z } from 'zod';
import type { HttpClient } from '@deepidv/core';
import { mapZodError, ValidationError } from '@deepidv/core';
import {
  AddMonitoredUserInputSchema,
  AmlSaveTransactionsInputSchema,
  AmlSaveTransactionsWireResultSchema,
  MonitoredUserWireSchema,
  type AmlSaveTransactionsInput,
  type AmlSaveTransactionsResult,
  type MonitoredUser,
} from './aml.types.js';

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw mapZodError(parsed.error);
  return parsed.data;
}

function validateId(value: string, name: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`expected non-empty string at '${name}'`);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function moveKeys(
  value: unknown,
  mapping: ReadonlyArray<readonly [camel: string, snake: string]>,
): unknown {
  if (!isRecord(value)) return value;
  const result = { ...value };
  for (const [camel, snake] of mapping) {
    if (result[camel] !== undefined) {
      result[snake] = result[camel];
      result[camel] = undefined;
    }
  }
  return result;
}

/** Converts known SDK fields while deliberately leaving `metadata` untouched. */
function toWireTransaction(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const result = moveKeys(value, [
    ['clientTxnId', 'client_txn_id'],
    ['subjectUserId', 'subject_user_id'],
    ['fxRate', 'fx_rate'],
  ]) as Record<string, unknown>;

  if (result.normalizedAmount !== undefined) {
    result.normalized_amount = moveKeys(result.normalizedAmount, [['fxRate', 'fx_rate']]);
    delete result.normalizedAmount;
  }
  if (result.counterparty !== undefined) {
    result.counterparty = moveKeys(result.counterparty, [
      ['externalId', 'external_id'],
      ['accountNumber', 'account_number'],
      ['walletAddress', 'wallet_address'],
    ]);
  }
  if (result.geography !== undefined) {
    result.geography = moveKeys(result.geography, [
      ['originCountry', 'origin_country'],
      ['destinationCountry', 'destination_country'],
      ['ipCountry', 'ip_country'],
      ['ipAddress', 'ip_address'],
    ]);
  }
  if (result.crypto !== undefined) {
    result.crypto = moveKeys(result.crypto, [
      ['assetType', 'asset_type'],
      ['txHash', 'tx_hash'],
      ['walletFrom', 'wallet_from'],
      ['walletTo', 'wallet_to'],
      ['amountAsset', 'amount_asset'],
    ]);
  }
  if (result.subject !== undefined) {
    result.subject = moveKeys(result.subject, [
      ['firstName', 'first_name'],
      ['lastName', 'last_name'],
    ]);
  }

  return result;
}

function toWireBatch(input: AmlSaveTransactionsInput): unknown {
  if (Array.isArray(input)) return input.map(toWireTransaction);
  return {
    ...(input.botId === undefined ? {} : { bot_id: input.botId }),
    transactions: input.transactions.map(toWireTransaction),
  };
}

/** AML transaction ingestion and monitored-user enrolment. */
export class Aml {
  constructor(private readonly client: HttpClient) {}

  /**
   * Saves a transaction batch and returns one outcome per submitted record.
   *
   * Record validation remains server-side so one malformed record does not
   * prevent valid records in the same batch from being stored.
   * Automatic retries are disabled because the server reserves monthly quota
   * before its idempotent transaction upserts. Replaying a timed-out request
   * can therefore consume quota more than once even when stored data is deduplicated.
   */
  async saveTransactions(input: AmlSaveTransactionsInput): Promise<AmlSaveTransactionsResult> {
    const parsed = parse(AmlSaveTransactionsInputSchema, input);
    const raw = await this.client.post('/v1/aml/transactions', toWireBatch(parsed), {
      maxRetries: 0,
    });
    return AmlSaveTransactionsWireResultSchema.parse(raw);
  }

  /** Enrols an existing subject into a monitoring bot idempotently. */
  async addMonitoredUser(
    botId: string,
    input: z.input<typeof AddMonitoredUserInputSchema>,
  ): Promise<MonitoredUser> {
    validateId(botId, 'botId');
    const parsed = parse(AddMonitoredUserInputSchema, input);
    const raw = await this.client.post<unknown>(
      `/v1/aml/bots/${encodeURIComponent(botId)}/monitored-users`,
      { subject_user_id: parsed.subjectUserId },
    );
    return MonitoredUserWireSchema.parse(raw);
  }
}
