import { z } from 'zod';
import { CursorParamsSchema } from './pagination.js';

const E164PhoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{9,14}$/u, 'phone must be a valid E.164 number');

/** Input for creating and sending a bank-statement request. */
export const FinancialCreateInputSchema = z.object({
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: E164PhoneSchema,
  period: z.enum(['3', '6', '9']).optional(),
  externalId: z.string().optional(),
  sendEmailInvite: z.boolean().optional(),
  sendPhoneInvite: z.boolean().optional(),
});

/** Result returned after a bank-statement request is created. */
export const FinancialCreateResultSchema = z
  .object({
    bankStatementId: z.string(),
    bankStatementUrl: z.string(),
    externalId: z.string().optional(),
    links: z.array(z.unknown()),
  })
  .strip();

/** Stored financial request record. */
export const FinancialRecordSchema = z
  .object({
    id: z.string(),
    organizationId: z.string(),
    userId: z.string(),
    senderUserId: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    status: z.string(),
    type: z.string(),
    externalId: z.string().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    statement: z.record(z.string(), z.unknown()).optional(),
  })
  .strip();

const FinancialRecordWireSchema = z
  .object({
    id: z.string(),
    organizationId: z.string(),
    userId: z.string(),
    senderUserId: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    status: z.string(),
    type: z.string(),
    externalId: z.string().optional(),
    Config: z.record(z.string(), z.unknown()).optional(),
    statement: z.record(z.string(), z.unknown()).optional(),
  })
  .transform((raw) =>
    FinancialRecordSchema.parse({
      ...raw,
      config: raw.Config,
      Config: undefined,
    }),
  );

/** Cursor parameters accepted by financial list methods. */
export const FinancialListParamsSchema = CursorParamsSchema;

/** Cursor page returned by financial list methods. */
export const FinancialListResultSchema = z.object({
  bankStatements: z.array(FinancialRecordSchema),
  nextToken: z.string().nullable(),
});

export const FinancialListWireResultSchema = z
  .object({
    bankStatements: z.array(FinancialRecordWireSchema),
    nextToken: z.string().nullable(),
  })
  .transform((raw) => FinancialListResultSchema.parse(raw));

export { FinancialRecordWireSchema };

export type FinancialCreateInput = z.infer<typeof FinancialCreateInputSchema>;
export type FinancialCreateResult = z.infer<typeof FinancialCreateResultSchema>;
export type FinancialRecord = z.infer<typeof FinancialRecordSchema>;
export type FinancialListParams = z.infer<typeof FinancialListParamsSchema>;
export type FinancialListResult = z.infer<typeof FinancialListResultSchema>;
