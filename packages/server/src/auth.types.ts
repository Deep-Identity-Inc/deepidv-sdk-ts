import { z } from 'zod';

/** Organization attached to a valid API key. */
export const AuthOrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
});

/** Successful response from `auth.verify()`. */
export const AuthVerifyResultSchema = z.object({
  valid: z.literal(true),
  organization: AuthOrganizationSchema,
});

export type AuthOrganization = z.infer<typeof AuthOrganizationSchema>;
export type AuthVerifyResult = z.infer<typeof AuthVerifyResultSchema>;
