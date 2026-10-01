import { z } from 'zod';

const HttpsUrlSchema = z.url().refine((value) => value.startsWith('https://'), {
  message: 'URL must use HTTPS',
});

export const AgeVerificationMethodSchema = z.enum(['quiz', 'credit-card', 'parent-connect']);

export const PlatformRestrictionSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    type: z.enum(['toggle', 'number', 'select', 'minutes']),
    category: z.enum(['feature', 'content']).optional(),
    default: z.unknown().optional(),
    required: z.boolean().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    options: z.array(z.string()).optional(),
  })
  .superRefine((restriction, context) => {
    if (restriction.type === 'select' && !restriction.options?.length) {
      context.addIssue({
        code: 'custom',
        path: ['options'],
        message: `restriction "${restriction.key}" is a select and must offer at least one option`,
      });
    }
    if (
      restriction.min !== undefined &&
      restriction.max !== undefined &&
      restriction.min > restriction.max
    ) {
      context.addIssue({
        code: 'custom',
        path: ['min'],
        message: `restriction "${restriction.key}" has min greater than max`,
      });
    }
  });

export const AgeVerificationCreateInputSchema = z
  .object({
    email: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    phone: z.string().regex(/^\+[1-9]\d{9,14}$/u, 'phone must be a valid E.164 number'),
    method: AgeVerificationMethodSchema,
    externalId: z.string().optional(),
    sendEmailInvite: z.boolean().optional(),
    sendPhoneInvite: z.boolean().optional(),
    redirectUrl: HttpsUrlSchema.optional(),
    expiresInHours: z.number().int().min(1).max(8760).optional(),
    ageBand: z.string().min(1).optional(),
    platformRestrictions: z.array(PlatformRestrictionSchema).optional(),
    eulaUrl: HttpsUrlSchema.optional(),
  })
  .superRefine((input, context) => {
    if (input.method !== 'parent-connect') {
      for (const field of ['ageBand', 'platformRestrictions', 'eulaUrl'] as const) {
        if (input[field] !== undefined) {
          context.addIssue({
            code: 'custom',
            path: [field],
            message: `${field} is only valid when method is "parent-connect"`,
          });
        }
      }
    }

    const seen = new Set<string>();
    input.platformRestrictions?.forEach((restriction, index) => {
      if (seen.has(restriction.key)) {
        context.addIssue({
          code: 'custom',
          path: ['platformRestrictions', index, 'key'],
          message: `duplicate restriction key "${restriction.key}"`,
        });
      }
      seen.add(restriction.key);
    });
  });

export const AgeVerificationLinkSchema = z.object({
  rel: z.string(),
  href: z.string(),
  description: z.string(),
});

export const AgeVerificationCreateResultSchema = z.object({
  id: z.string(),
  sessionUrl: z.string(),
  method: z.string(),
  externalId: z.string().optional(),
  expiresAt: z.string().nullable().optional(),
  links: z.array(AgeVerificationLinkSchema),
});

export const AgeVerificationCreateWireResultSchema = z
  .object({
    id: z.string(),
    session_url: z.string(),
    method: z.string(),
    external_id: z.string().optional(),
    expires_at: z.string().nullable().optional(),
    links: z.array(AgeVerificationLinkSchema),
  })
  .transform((raw) =>
    AgeVerificationCreateResultSchema.parse({
      id: raw.id,
      sessionUrl: raw.session_url,
      method: raw.method,
      externalId: raw.external_id,
      expiresAt: raw.expires_at,
      links: raw.links,
    }),
  );

export const ParentConnectStatusSchema = z.enum([
  'PENDING',
  'PARENT_INVITED',
  'PARENT_VERIFIED',
  'CONSENT_GIVEN',
  'EXPIRED',
  'DECLINED',
]);

export const ParentConnectListParamsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  nextToken: z.string().optional(),
  childSessionId: z.string().min(1).optional(),
  status: ParentConnectStatusSchema.optional(),
});

export const ParentConnectRequestSchema = z.object({
  id: z.string().nullable(),
  childSessionId: z.string().nullable(),
  parentSessionId: z.string().nullable(),
  status: ParentConnectStatusSchema.nullable(),
  ageBand: z.string().nullable(),
  contactMethod: z.string().nullable(),
  platformRestrictions: z.array(PlatformRestrictionSchema),
  boundaries: z.record(z.string(), z.unknown()).nullable(),
  eulaUrl: z.string().nullable(),
  eulaAccepted: z.boolean(),
  childAttestationId: z.string().nullable(),
  parentAttestationId: z.string().nullable(),
  boundariesRevision: z.number().nullable(),
  consentGivenAt: z.string().nullable(),
  consentExpiresAt: z.string().nullable(),
  reconsentDueAt: z.string().nullable(),
  inviteExpiresAt: z.string().nullable(),
  declinedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const ParentConnectRequestWireSchema = z
  .object({
    id: z.string().nullable(),
    child_session_id: z.string().nullable(),
    parent_session_id: z.string().nullable(),
    status: ParentConnectStatusSchema.nullable(),
    age_band: z.string().nullable(),
    contact_method: z.string().nullable(),
    platform_restrictions: z.array(PlatformRestrictionSchema),
    boundaries: z.record(z.string(), z.unknown()).nullable(),
    eula_url: z.string().nullable(),
    eula_accepted: z.boolean(),
    child_attestation_id: z.string().nullable(),
    parent_attestation_id: z.string().nullable(),
    boundaries_revision: z.number().nullable(),
    consent_given_at: z.string().nullable(),
    consent_expires_at: z.string().nullable(),
    reconsent_due_at: z.string().nullable(),
    invite_expires_at: z.string().nullable(),
    declined_at: z.string().nullable(),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(),
  })
  .transform((raw) =>
    ParentConnectRequestSchema.parse({
      id: raw.id,
      childSessionId: raw.child_session_id,
      parentSessionId: raw.parent_session_id,
      status: raw.status,
      ageBand: raw.age_band,
      contactMethod: raw.contact_method,
      platformRestrictions: raw.platform_restrictions,
      boundaries: raw.boundaries,
      eulaUrl: raw.eula_url,
      eulaAccepted: raw.eula_accepted,
      childAttestationId: raw.child_attestation_id,
      parentAttestationId: raw.parent_attestation_id,
      boundariesRevision: raw.boundaries_revision,
      consentGivenAt: raw.consent_given_at,
      consentExpiresAt: raw.consent_expires_at,
      reconsentDueAt: raw.reconsent_due_at,
      inviteExpiresAt: raw.invite_expires_at,
      declinedAt: raw.declined_at,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
    }),
  );

export const ParentConnectListResultSchema = z.object({
  parentConnectRequests: z.array(ParentConnectRequestSchema),
  nextToken: z.string().nullable(),
});

export const ParentConnectListWireResultSchema = z
  .object({
    parent_connect_requests: z.array(ParentConnectRequestWireSchema),
    next_token: z.string().nullable(),
  })
  .transform((raw) =>
    ParentConnectListResultSchema.parse({
      parentConnectRequests: raw.parent_connect_requests,
      nextToken: raw.next_token,
    }),
  );

export const AgeVerificationBoundariesSchema = z.object({
  childAttestationId: z.string().nullable(),
  parentAttestationId: z.string().nullable(),
  parentConnectId: z.string().nullable(),
  ageBand: z.string().nullable(),
  parentalConsent: z.boolean(),
  eulaAccepted: z.boolean(),
  boundaries: z.record(z.string(), z.unknown()),
  boundariesRevision: z.number(),
  boundariesMatchAttestation: z.boolean(),
  consentExpiresAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const AgeVerificationBoundariesWireSchema = z
  .object({
    child_attestation_id: z.string().nullable(),
    parent_attestation_id: z.string().nullable(),
    parent_connect_id: z.string().nullable(),
    age_band: z.string().nullable(),
    parental_consent: z.boolean(),
    eula_accepted: z.boolean(),
    boundaries: z.record(z.string(), z.unknown()),
    boundaries_revision: z.number(),
    boundaries_match_attestation: z.boolean(),
    consent_expires_at: z.string().nullable(),
    updated_at: z.string().nullable(),
  })
  .transform((raw) =>
    AgeVerificationBoundariesSchema.parse({
      childAttestationId: raw.child_attestation_id,
      parentAttestationId: raw.parent_attestation_id,
      parentConnectId: raw.parent_connect_id,
      ageBand: raw.age_band,
      parentalConsent: raw.parental_consent,
      eulaAccepted: raw.eula_accepted,
      boundaries: raw.boundaries,
      boundariesRevision: raw.boundaries_revision,
      boundariesMatchAttestation: raw.boundaries_match_attestation,
      consentExpiresAt: raw.consent_expires_at,
      updatedAt: raw.updated_at,
    }),
  );

export type AgeVerificationMethod = z.infer<typeof AgeVerificationMethodSchema>;
export type PlatformRestriction = z.infer<typeof PlatformRestrictionSchema>;
export type AgeVerificationCreateInput = z.infer<typeof AgeVerificationCreateInputSchema>;
export type AgeVerificationLink = z.infer<typeof AgeVerificationLinkSchema>;
export type AgeVerificationCreateResult = z.infer<typeof AgeVerificationCreateResultSchema>;
export type ParentConnectStatus = z.infer<typeof ParentConnectStatusSchema>;
export type ParentConnectListParams = z.infer<typeof ParentConnectListParamsSchema>;
export type ParentConnectRequest = z.infer<typeof ParentConnectRequestSchema>;
export type ParentConnectListResult = z.infer<typeof ParentConnectListResultSchema>;
export type AgeVerificationBoundaries = z.infer<typeof AgeVerificationBoundariesSchema>;
