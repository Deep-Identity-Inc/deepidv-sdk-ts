import { z } from 'zod';

const NonEmptyStringSchema = z.string().min(1);

export const IGamingCheckVerdictSchema = z.enum(['HIT', 'CLEAR', 'UNAVAILABLE']);

export const InjectionSignalSchema = z.object({
  pass: z.boolean(),
  score: z.number().min(0).max(100),
  signals: z.array(z.string()).default([]),
});

export const AnalyzeInjectionInputSchema = z.object({
  sessionId: NonEmptyStringSchema,
  deviceIntegrity: InjectionSignalSchema.optional(),
  mediaSource: InjectionSignalSchema.optional(),
  frameTiming: InjectionSignalSchema.optional(),
});

export const AnalyzeInjectionResultSchema = z.object({
  verdict: IGamingCheckVerdictSchema,
  action: z.string(),
  confidence: z.number().nullable(),
  escalation: z
    .object({
      type: z.string(),
      check: z.literal('injection-detection'),
    })
    .nullable(),
});

const IpAddressSchema = NonEmptyStringSchema.refine(
  (value) => z.ipv4().safeParse(value).success || z.ipv6().safeParse(value).success,
  { message: 'ipAddress must be a valid IPv4 or IPv6 address' },
);

export const AnalyzeIpCheckInputSchema = z.object({
  sessionId: NonEmptyStringSchema,
  ipAddress: IpAddressSchema,
});

export const IpCheckResultSchema = z.object({
  verdict: IGamingCheckVerdictSchema,
  action: z.string(),
  evidence: z.record(z.string(), z.unknown()),
  escalation: z
    .object({
      decision: z.literal('ESCALATE'),
      type: z.string(),
      reason: z.string(),
    })
    .nullable(),
});

export const AntiCheatVerdictSchema = z.enum([
  'DUPLICATE',
  'UNIQUE',
  'UNAVAILABLE',
  'SELF_EXCLUSION',
]);
export const AntiCheatActionSchema = z.enum(['allow', 'flag', 'manual-review', 'block']);

export const AnalyzeAntiCheatInputSchema = z.object({
  sessionId: NonEmptyStringSchema,
  image: NonEmptyStringSchema,
  deviceFingerprint: z.string().optional(),
});

export const AntiCheatResultSchema = z.object({
  verdict: AntiCheatVerdictSchema,
  action: AntiCheatActionSchema,
});

export const SelfExclusionListParamsSchema = z.object({
  limit: z.number().int().min(1).max(1000).optional(),
});

export const SelfExclusionIdentityEntrySchema = z.object({
  type: z.literal('identity'),
  documentNumber: z.string(),
  reason: z.string().nullable(),
  addedBy: z.string().nullable(),
  addedAt: z.string().nullable(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export const SelfExclusionFaceEntrySchema = z.object({
  type: z.literal('face'),
  sessionId: z.string(),
  reason: z.string().nullable(),
  excludedAt: z.string().nullable(),
});

export const SelfExclusionEntrySchema = z.discriminatedUnion('type', [
  SelfExclusionIdentityEntrySchema,
  SelfExclusionFaceEntrySchema,
]);

export const SelfExclusionListResultSchema = z.object({
  entries: z.array(SelfExclusionEntrySchema),
  truncated: z.boolean(),
});

export const SelfExclusionIdentityAddInputSchema = z
  .object({
    documentNumber: NonEmptyStringSchema.optional(),
    documentNumbers: z.array(NonEmptyStringSchema).min(1).optional(),
    reason: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  })
  .refine(
    ({ documentNumber, documentNumbers }) =>
      documentNumber !== undefined || (documentNumbers !== undefined && documentNumbers.length > 0),
    {
      path: ['documentNumber'],
      message: 'Provide documentNumber or a non-empty documentNumbers array',
    },
  );

export const SelfExclusionIdentityStatusSchema = z.enum(['added', 'already_excluded', 'invalid']);

export const SelfExclusionIdentityAddResultSchema = z.object({
  excluded: z.array(
    z.object({
      documentNumber: z.string(),
      status: SelfExclusionIdentityStatusSchema,
    }),
  ),
});

export const SelfExclusionIdentityRemoveResultSchema = z.object({
  removed: z.boolean(),
  faceUnexcluded: z.boolean(),
});

export const SelfExclusionFaceInputSchema = z.object({
  sessionId: NonEmptyStringSchema,
  reason: z.string().optional(),
});

export const SelfExclusionFaceResultSchema = z.object({
  excluded: z.boolean(),
  sessionId: z.string().optional(),
  reason: z.string().optional(),
  matchedSessionId: z.string().optional(),
});

export const SelfExclusionFaceRemoveResultSchema = z.object({
  unexcluded: z.boolean(),
  matchedSessionId: z.string().optional(),
});

export const AntiCheatPurgeResultSchema = z.object({
  deleted: z.boolean(),
  faceId: z.string().nullable(),
});

export const SelfExclusionApplicantInputSchema = z.object({
  sessionId: NonEmptyStringSchema,
  reason: z.string().optional(),
});

export const SelfExclusionApplicantResultSchema = z.object({
  faceAttached: z.boolean(),
  documentNumber: z.string().nullable(),
  identityStatus: z.enum(['added', 'already_excluded']).optional(),
  matchedSessionId: z.string().optional(),
  message: z.string().optional(),
});

const SelfExclusionListWireResultSchema = z
  .object({
    entries: z.array(
      z.discriminatedUnion('type', [
        z.object({
          type: z.literal('identity'),
          document_number: z.string(),
          reason: z.string().nullable(),
          added_by: z.string().nullable(),
          added_at: z.string().nullable(),
          first_name: z.string().optional(),
          last_name: z.string().optional(),
        }),
        z.object({
          type: z.literal('face'),
          session_id: z.string(),
          reason: z.string().nullable(),
          excluded_at: z.string().nullable(),
        }),
      ]),
    ),
    truncated: z.boolean(),
  })
  .transform(({ entries, truncated }) => ({
    entries: entries.map((entry) =>
      entry.type === 'identity'
        ? {
            type: entry.type,
            documentNumber: entry.document_number,
            reason: entry.reason,
            addedBy: entry.added_by,
            addedAt: entry.added_at,
            ...(entry.first_name === undefined ? {} : { firstName: entry.first_name }),
            ...(entry.last_name === undefined ? {} : { lastName: entry.last_name }),
          }
        : {
            type: entry.type,
            sessionId: entry.session_id,
            reason: entry.reason,
            excludedAt: entry.excluded_at,
          },
    ),
    truncated,
  }))
  .pipe(SelfExclusionListResultSchema);

const SelfExclusionIdentityAddWireResultSchema = z
  .object({
    excluded: z.array(
      z.object({
        document_number: z.string(),
        status: SelfExclusionIdentityStatusSchema,
      }),
    ),
  })
  .transform(({ excluded }) => ({
    excluded: excluded.map(({ document_number, status }) => ({
      documentNumber: document_number,
      status,
    })),
  }))
  .pipe(SelfExclusionIdentityAddResultSchema);

const SelfExclusionIdentityRemoveWireResultSchema = z
  .object({ removed: z.boolean(), face_unexcluded: z.boolean() })
  .transform(({ removed, face_unexcluded }) => ({ removed, faceUnexcluded: face_unexcluded }))
  .pipe(SelfExclusionIdentityRemoveResultSchema);

const SelfExclusionFaceWireResultSchema = z
  .object({
    excluded: z.boolean(),
    session_id: z.string().optional(),
    reason: z.string().optional(),
    matched_session_id: z.string().optional(),
  })
  .transform(({ excluded, session_id, reason, matched_session_id }) => ({
    excluded,
    ...(session_id === undefined ? {} : { sessionId: session_id }),
    ...(reason === undefined ? {} : { reason }),
    ...(matched_session_id === undefined ? {} : { matchedSessionId: matched_session_id }),
  }))
  .pipe(SelfExclusionFaceResultSchema);

const SelfExclusionFaceRemoveWireResultSchema = z
  .object({ unexcluded: z.boolean(), matched_session_id: z.string().optional() })
  .transform(({ unexcluded, matched_session_id }) => ({
    unexcluded,
    ...(matched_session_id === undefined ? {} : { matchedSessionId: matched_session_id }),
  }))
  .pipe(SelfExclusionFaceRemoveResultSchema);

const AntiCheatPurgeWireResultSchema = z
  .object({ deleted: z.boolean(), face_id: z.string().nullable() })
  .transform(({ deleted, face_id }) => ({ deleted, faceId: face_id }))
  .pipe(AntiCheatPurgeResultSchema);

const SelfExclusionApplicantWireResultSchema = z
  .object({
    face_attached: z.boolean(),
    document_number: z.string().nullable(),
    identity_status: z.enum(['added', 'already_excluded']).optional(),
    matched_session_id: z.string().optional(),
    message: z.string().optional(),
  })
  .transform(
    ({ face_attached, document_number, identity_status, matched_session_id, message }) => ({
      faceAttached: face_attached,
      documentNumber: document_number,
      ...(identity_status === undefined ? {} : { identityStatus: identity_status }),
      ...(matched_session_id === undefined ? {} : { matchedSessionId: matched_session_id }),
      ...(message === undefined ? {} : { message }),
    }),
  )
  .pipe(SelfExclusionApplicantResultSchema);

export {
  AntiCheatPurgeWireResultSchema,
  SelfExclusionApplicantWireResultSchema,
  SelfExclusionFaceRemoveWireResultSchema,
  SelfExclusionFaceWireResultSchema,
  SelfExclusionIdentityAddWireResultSchema,
  SelfExclusionIdentityRemoveWireResultSchema,
  SelfExclusionListWireResultSchema,
};

export type IGamingCheckVerdict = z.infer<typeof IGamingCheckVerdictSchema>;
export type InjectionSignal = z.infer<typeof InjectionSignalSchema>;
export type AnalyzeInjectionInput = z.infer<typeof AnalyzeInjectionInputSchema>;
export type AnalyzeInjectionResult = z.infer<typeof AnalyzeInjectionResultSchema>;
export type AnalyzeIpCheckInput = z.infer<typeof AnalyzeIpCheckInputSchema>;
export type IpCheckResult = z.infer<typeof IpCheckResultSchema>;
export type AntiCheatVerdict = z.infer<typeof AntiCheatVerdictSchema>;
export type AntiCheatAction = z.infer<typeof AntiCheatActionSchema>;
export type AnalyzeAntiCheatInput = z.infer<typeof AnalyzeAntiCheatInputSchema>;
export type AntiCheatResult = z.infer<typeof AntiCheatResultSchema>;
export type SelfExclusionListParams = z.infer<typeof SelfExclusionListParamsSchema>;
export type SelfExclusionIdentityEntry = z.infer<typeof SelfExclusionIdentityEntrySchema>;
export type SelfExclusionFaceEntry = z.infer<typeof SelfExclusionFaceEntrySchema>;
export type SelfExclusionEntry = z.infer<typeof SelfExclusionEntrySchema>;
export type SelfExclusionListResult = z.infer<typeof SelfExclusionListResultSchema>;
export type SelfExclusionIdentityAddInput = z.infer<typeof SelfExclusionIdentityAddInputSchema>;
export type SelfExclusionIdentityStatus = z.infer<typeof SelfExclusionIdentityStatusSchema>;
export type SelfExclusionIdentityAddResult = z.infer<typeof SelfExclusionIdentityAddResultSchema>;
export type SelfExclusionIdentityRemoveResult = z.infer<
  typeof SelfExclusionIdentityRemoveResultSchema
>;
export type SelfExclusionFaceInput = z.infer<typeof SelfExclusionFaceInputSchema>;
export type SelfExclusionFaceResult = z.infer<typeof SelfExclusionFaceResultSchema>;
export type SelfExclusionFaceRemoveResult = z.infer<typeof SelfExclusionFaceRemoveResultSchema>;
export type AntiCheatPurgeResult = z.infer<typeof AntiCheatPurgeResultSchema>;
export type SelfExclusionApplicantInput = z.infer<typeof SelfExclusionApplicantInputSchema>;
export type SelfExclusionApplicantResult = z.infer<typeof SelfExclusionApplicantResultSchema>;
