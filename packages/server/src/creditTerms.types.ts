import { z } from 'zod';
import { FinancialRecordSchema, FinancialRecordWireSchema } from './financial.types.js';
import { CursorParamsSchema } from './pagination.js';

/** Input for creating and sending a credit-terms application request. */
export const CreditTermsCreateInputSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  businessName: z.string(),
  businessEmail: z.string(),
  businessAddress: z.string(),
  requestedCreditAmount: z.number().min(0),
  requestedCreditPeriod: z.enum(['30', '60', '90']).optional(),
  externalId: z.string().optional(),
  sendEmailInvite: z.boolean().optional(),
});

/** Result returned after a credit-terms request is created. */
export const CreditTermsCreateResultSchema = z
  .object({
    creditTermsId: z.string(),
    creditTermsUrl: z.string(),
    externalId: z.string().optional(),
    links: z.array(z.unknown()),
  })
  .strip();

/** Credit-terms records share the API's financial-record storage shape. */
export const CreditTermsRecordSchema = FinancialRecordSchema;

/** Cursor parameters accepted by credit-terms list methods. */
export const CreditTermsListParamsSchema = CursorParamsSchema;

/** Cursor page returned by credit-terms list methods. */
export const CreditTermsListResultSchema = z.object({
  creditTerms: z.array(CreditTermsRecordSchema),
  nextToken: z.string().nullable(),
});

export const CreditTermsListWireResultSchema = z
  .object({
    creditTerms: z.array(FinancialRecordWireSchema),
    nextToken: z.string().nullable(),
  })
  .transform((raw) => CreditTermsListResultSchema.parse(raw));

export const CreditTermsRecordWireSchema = FinancialRecordWireSchema;

export type CreditTermsCreateInput = z.infer<typeof CreditTermsCreateInputSchema>;
export type CreditTermsCreateResult = z.infer<typeof CreditTermsCreateResultSchema>;
export type CreditTermsRecord = z.infer<typeof CreditTermsRecordSchema>;
export type CreditTermsListParams = z.infer<typeof CreditTermsListParamsSchema>;
export type CreditTermsListResult = z.infer<typeof CreditTermsListResultSchema>;
