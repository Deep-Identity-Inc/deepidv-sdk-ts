import { z } from 'zod';

const HttpsUrlSchema = z.url().refine((value) => new URL(value).protocol === 'https:', {
  message: 'redirectUrl must use HTTPS',
});

/** Input shared by hard and soft credit-check session creation. */
export const CreditCheckCreateInputSchema = z.object({
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().regex(/^\+[1-9]\d{9,14}$/u, 'phone must be a valid E.164 number'),
  externalId: z.string().optional(),
  sendEmailInvite: z.boolean().optional(),
  sendPhoneInvite: z.boolean().optional(),
  redirectUrl: HttpsUrlSchema.optional(),
  uat: z.boolean().optional(),
  uatType: z.string().optional(),
});

export const CreditCheckTypeSchema = z.enum(['credit-check-hard', 'credit-check-soft']);

export const CreditCheckLinkSchema = z.object({
  rel: z.string(),
  href: z.string(),
  description: z.string().optional(),
});

/** Created credit-check session. */
export const CreditCheckCreateResultSchema = z.object({
  id: z.string(),
  sessionUrl: z.string(),
  type: CreditCheckTypeSchema,
  externalId: z.string().optional(),
  links: z.array(CreditCheckLinkSchema),
});

export const CreditCheckCreateWireResultSchema = z
  .object({
    id: z.string(),
    session_url: z.string(),
    type: CreditCheckTypeSchema,
    externalId: z.string().optional(),
    links: z.array(CreditCheckLinkSchema),
  })
  .transform((raw) =>
    CreditCheckCreateResultSchema.parse({
      id: raw.id,
      sessionUrl: raw.session_url,
      type: raw.type,
      externalId: raw.externalId,
      links: raw.links,
    }),
  );

export type CreditCheckCreateInput = z.infer<typeof CreditCheckCreateInputSchema>;
export type CreditCheckType = z.infer<typeof CreditCheckTypeSchema>;
export type CreditCheckLink = z.infer<typeof CreditCheckLinkSchema>;
export type CreditCheckCreateResult = z.infer<typeof CreditCheckCreateResultSchema>;
