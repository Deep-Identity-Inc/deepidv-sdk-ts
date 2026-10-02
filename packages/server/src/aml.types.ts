import { z } from 'zod';

const NonEmptyStringSchema = z.string().trim().min(1);

export const AmlTransactionDirectionSchema = z.enum(['inbound', 'outbound', 'internal']);
export const AmlTransactionTypeSchema = z.enum([
  'card',
  'wire',
  'eft',
  'ach',
  'crypto',
  'cash',
  'internal_transfer',
  'other',
]);
export const AmlTransactionStatusSchema = z.enum(['pending', 'completed', 'failed', 'reversed']);
export const AmlTransactionChannelSchema = z.enum(['web', 'mobile', 'api', 'branch', 'atm', 'pos']);

export const AmlAmountSchema = z.object({
  value: z.number(),
  currency: NonEmptyStringSchema,
});

export const AmlNormalizedAmountSchema = AmlAmountSchema.extend({
  fxRate: z.number().optional(),
});

export const AmlCounterpartySchema = z.object({
  name: z.string().optional(),
  externalId: z.string().optional(),
  accountNumber: z.string().optional(),
  institution: z.string().optional(),
  country: z.string().optional(),
  walletAddress: z.string().optional(),
});

const IpAddressSchema = z
  .string()
  .refine((value) => z.ipv4().safeParse(value).success || z.ipv6().safeParse(value).success, {
    message: 'ipAddress must be a valid IPv4 or IPv6 address',
  });

export const AmlGeographySchema = z.object({
  originCountry: z.string().optional(),
  destinationCountry: z.string().optional(),
  ipCountry: z.string().optional(),
  ipAddress: IpAddressSchema.optional(),
});

export const AmlCryptoSchema = z.object({
  assetType: z.string().optional(),
  txHash: z.string().optional(),
  walletFrom: z.string().optional(),
  walletTo: z.string().optional(),
  amountAsset: z.number().optional(),
});

export const AmlSubjectSchema = z.object({
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  email: z.email().nullish(),
  phone: z.string().nullish(),
});

const IsoTimestampSchema = z
  .string()
  .refine(
    (value) => /^\d{4}-\d{2}-\d{2}([T ].*)?$/u.test(value) && !Number.isNaN(Date.parse(value)),
    { message: 'timestamp must be an ISO-8601 date or date-time' },
  );

/** A fully typed AML transaction. The API performs authoritative per-record validation. */
export const AmlTransactionInputSchema = z.object({
  clientTxnId: NonEmptyStringSchema.max(128),
  subjectUserId: NonEmptyStringSchema,
  timestamp: IsoTimestampSchema,
  direction: AmlTransactionDirectionSchema,
  amount: AmlAmountSchema,
  type: AmlTransactionTypeSchema,
  normalizedAmount: AmlNormalizedAmountSchema.optional(),
  fxRate: z.number().optional(),
  status: AmlTransactionStatusSchema.optional(),
  channel: AmlTransactionChannelSchema.optional(),
  counterparty: AmlCounterpartySchema.optional(),
  geography: AmlGeographySchema.optional(),
  crypto: AmlCryptoSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  subject: AmlSubjectSchema.optional(),
});

const TransactionPassthroughSchema = z.custom<z.input<typeof AmlTransactionInputSchema>>(
  () => true,
);
const TransactionBatchSchema = z.array(TransactionPassthroughSchema).min(1).max(500);

/**
 * Input accepted by `client.aml.saveTransactions()`.
 *
 * Only the envelope is validated at runtime. Individual records intentionally
 * remain server-validated so mixed batches can return per-record outcomes.
 */
export const AmlSaveTransactionsInputSchema = z.union([
  TransactionBatchSchema,
  z.object({
    botId: NonEmptyStringSchema.optional(),
    transactions: TransactionBatchSchema,
  }),
]);

export const AmlRecordStatusSchema = z.enum(['accepted', 'warned', 'rejected']);

export const AmlRecordErrorSchema = z.object({
  code: z.string(),
  field: z.string().nullable(),
  message: z.string(),
});

export const AmlRecordResultSchema = z.object({
  index: z.number().int(),
  clientTxnId: z.string().nullable(),
  status: AmlRecordStatusSchema,
  warnings: z.array(z.string()).optional(),
  errors: z.array(AmlRecordErrorSchema).optional(),
});

export const AmlSaveTransactionsResultSchema = z.object({
  accepted: z.number().int(),
  warned: z.number().int(),
  rejected: z.number().int(),
  results: z.array(AmlRecordResultSchema),
});

const camelizePath = (path: string): string =>
  path.replace(/_([a-z])/gu, (_match, character: string) => character.toUpperCase());

export const AmlSaveTransactionsWireResultSchema = z
  .object({
    accepted: z.number().int(),
    warned: z.number().int(),
    rejected: z.number().int(),
    results: z.array(
      z.object({
        index: z.number().int(),
        client_txn_id: z.string().nullable(),
        status: AmlRecordStatusSchema,
        warnings: z.array(z.string()).optional(),
        errors: z
          .array(
            z.object({
              code: z.string(),
              field: z.string().nullable(),
              message: z.string(),
            }),
          )
          .optional(),
      }),
    ),
  })
  .transform(({ accepted, warned, rejected, results }) => ({
    accepted,
    warned,
    rejected,
    results: results.map(({ client_txn_id, errors, ...result }) => ({
      ...result,
      clientTxnId: client_txn_id,
      ...(errors === undefined
        ? {}
        : {
            errors: errors.map((error) => ({
              ...error,
              field: error.field === null ? null : camelizePath(error.field),
            })),
          }),
    })),
  }))
  .pipe(AmlSaveTransactionsResultSchema);

/** Parses the structured body carried by a quota-related `RateLimitError`. */
export const AmlQuotaExceededSchema = z
  .object({
    error: z.string(),
    code: z.literal('QUOTA_EXCEEDED'),
    quota: z.number().int(),
    used: z.number().int(),
    remaining: z.number().int(),
    month: z.string(),
    resets_at: z.string(),
  })
  .transform(({ resets_at, ...result }) => ({ ...result, resetsAt: resets_at }));

export const AddMonitoredUserInputSchema = z.object({
  subjectUserId: NonEmptyStringSchema,
});

export const MonitoredUserSchema = z.object({
  orgId: z.string(),
  botId: z.string(),
  subjectUserId: z.string(),
  subjectUserName: z.string().nullable(),
  subjectCountry: z.string(),
  status: z.string(),
  cadenceDays: z.number(),
  nextCheckAt: z.string(),
  lastCheckedAt: z.string().nullable(),
  addedAt: z.string(),
  addedBy: z.string().nullable(),
  updatedAt: z.string(),
});

export const MonitoredUserWireSchema = z
  .object({
    org_id: z.string(),
    bot_id: z.string(),
    subject_user_id: z.string(),
    subject_user_name: z.string().nullable(),
    subject_country: z.string(),
    status: z.string(),
    cadence_days: z.number(),
    next_check_at: z.string(),
    last_checked_at: z.string().nullable(),
    added_at: z.string(),
    added_by: z.string().nullable(),
    updated_at: z.string(),
  })
  .transform((raw) => ({
    orgId: raw.org_id,
    botId: raw.bot_id,
    subjectUserId: raw.subject_user_id,
    subjectUserName: raw.subject_user_name,
    subjectCountry: raw.subject_country,
    status: raw.status,
    cadenceDays: raw.cadence_days,
    nextCheckAt: raw.next_check_at,
    lastCheckedAt: raw.last_checked_at,
    addedAt: raw.added_at,
    addedBy: raw.added_by,
    updatedAt: raw.updated_at,
  }))
  .pipe(MonitoredUserSchema);

export type AmlTransactionDirection = z.infer<typeof AmlTransactionDirectionSchema>;
export type AmlTransactionType = z.infer<typeof AmlTransactionTypeSchema>;
export type AmlTransactionStatus = z.infer<typeof AmlTransactionStatusSchema>;
export type AmlTransactionChannel = z.infer<typeof AmlTransactionChannelSchema>;
export type AmlAmount = z.infer<typeof AmlAmountSchema>;
export type AmlNormalizedAmount = z.infer<typeof AmlNormalizedAmountSchema>;
export type AmlCounterparty = z.infer<typeof AmlCounterpartySchema>;
export type AmlGeography = z.infer<typeof AmlGeographySchema>;
export type AmlCrypto = z.infer<typeof AmlCryptoSchema>;
export type AmlSubject = z.infer<typeof AmlSubjectSchema>;
export type AmlTransactionInput = z.infer<typeof AmlTransactionInputSchema>;
export type AmlSaveTransactionsInput = z.infer<typeof AmlSaveTransactionsInputSchema>;
export type AmlRecordStatus = z.infer<typeof AmlRecordStatusSchema>;
export type AmlRecordError = z.infer<typeof AmlRecordErrorSchema>;
export type AmlRecordResult = z.infer<typeof AmlRecordResultSchema>;
export type AmlSaveTransactionsResult = z.infer<typeof AmlSaveTransactionsResultSchema>;
export type AmlQuotaExceeded = z.infer<typeof AmlQuotaExceededSchema>;
export type AddMonitoredUserInput = z.infer<typeof AddMonitoredUserInputSchema>;
export type MonitoredUser = z.infer<typeof MonitoredUserSchema>;
