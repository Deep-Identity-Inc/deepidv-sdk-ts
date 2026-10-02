import { z } from 'zod';
import { FaceLivenessChallengeTypeSchema } from './face.types.js';

export const ReVerificationCreateInputSchema = z
  .object({
    workflowId: z.string().min(1).max(128),
    deviceFingerprint: z.string().min(1).max(256).optional(),
  })
  .strict();

export const ReVerificationCreateResultSchema = z.object({
  reVerificationId: z.string(),
  workflowId: z.string(),
  status: z.literal('PENDING'),
  expiresAt: z.string(),
  liveness: z.object({ challengeType: FaceLivenessChallengeTypeSchema }),
});

export const ReVerificationCreateWireResultSchema = z
  .object({
    re_verification_id: z.string(),
    workflow_id: z.string(),
    status: z.literal('PENDING'),
    expires_at: z.string(),
    liveness: z.object({ challenge_type: FaceLivenessChallengeTypeSchema }),
  })
  .transform((raw) =>
    ReVerificationCreateResultSchema.parse({
      reVerificationId: raw.re_verification_id,
      workflowId: raw.workflow_id,
      status: raw.status,
      expiresAt: raw.expires_at,
      liveness: { challengeType: raw.liveness.challenge_type },
    }),
  );

export const LivenessChallengeStepSchema = z.object({
  kind: z.enum(['color', 'move-closer']),
  atMs: z.number().int().min(0),
  color: z.string().optional(),
});

export const LivenessChallengeScriptSchema = z.object({
  challengeType: FaceLivenessChallengeTypeSchema,
  durationMs: z.number().int().positive(),
  steps: z.array(LivenessChallengeStepSchema),
});

export const ReVerificationLivenessStartResultSchema = z.object({
  livenessSessionId: z.string(),
  script: LivenessChallengeScriptSchema,
});

export const ReVerificationLivenessStartWireResultSchema = z
  .object({
    liveness_session_id: z.string(),
    script: LivenessChallengeScriptSchema,
  })
  .transform((raw) =>
    ReVerificationLivenessStartResultSchema.parse({
      livenessSessionId: raw.liveness_session_id,
      script: raw.script,
    }),
  );

export const ReVerificationLivenessUploadUrlInputSchema = z
  .object({
    frameCount: z.number().int().min(3).max(8),
    clipMimeType: z.enum(['video/webm', 'video/mp4']).optional(),
  })
  .strict();

export const ReVerificationLivenessUploadUrlResultSchema = z
  .object({
    frameUploadUrls: z.array(z.string()),
    frameKeys: z.array(z.string()),
    timelineUploadUrl: z.string(),
    timelineKey: z.string(),
    clipUploadUrl: z.string().optional(),
    clipKey: z.string().optional(),
  })
  .superRefine((result, context) => {
    if (result.frameUploadUrls.length !== result.frameKeys.length) {
      context.addIssue({
        code: 'custom',
        path: ['frameKeys'],
        message: 'frameKeys must contain one key for each frameUploadUrl',
      });
    }
    if ((result.clipUploadUrl === undefined) !== (result.clipKey === undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['clipKey'],
        message: 'clipUploadUrl and clipKey must be returned together',
      });
    }
  });

export const ReVerificationLivenessUploadUrlWireResultSchema = z
  .object({
    frame_upload_urls: z.array(z.string()),
    frame_keys: z.array(z.string()),
    timeline_upload_url: z.string(),
    timeline_key: z.string(),
    clip_upload_url: z.string().optional(),
    clip_key: z.string().optional(),
  })
  .transform((raw) =>
    ReVerificationLivenessUploadUrlResultSchema.parse({
      frameUploadUrls: raw.frame_upload_urls,
      frameKeys: raw.frame_keys,
      timelineUploadUrl: raw.timeline_upload_url,
      timelineKey: raw.timeline_key,
      clipUploadUrl: raw.clip_upload_url,
      clipKey: raw.clip_key,
    }),
  );

export const ReVerificationDecisionSchema = z.enum([
  'verified',
  'retry',
  'failed',
  'retry_liveness',
]);

export const ReVerificationDecisionResultSchema = z.object({
  decision: ReVerificationDecisionSchema,
  failedAttempts: z.number().int().min(0),
  maxAttempts: z.number().int().positive(),
  liveness: z.object({
    status: z.enum(['SUCCEEDED', 'FAILED']),
    confidence: z.number().nullable(),
  }),
  userId: z.string().optional(),
  originalSessionId: z.string().optional(),
});

export const ReVerificationDecisionWireResultSchema = z
  .object({
    decision: ReVerificationDecisionSchema,
    failed_attempts: z.number().int().min(0),
    max_attempts: z.number().int().positive(),
    liveness: z.object({
      status: z.enum(['SUCCEEDED', 'FAILED']),
      confidence: z.number().nullable(),
    }),
    user_id: z.string().optional(),
    original_session_id: z.string().optional(),
  })
  .transform((raw) =>
    ReVerificationDecisionResultSchema.parse({
      decision: raw.decision,
      failedAttempts: raw.failed_attempts,
      maxAttempts: raw.max_attempts,
      liveness: raw.liveness,
      userId: raw.user_id,
      originalSessionId: raw.original_session_id,
    }),
  );

export const ReVerificationErrorCodeSchema = z.enum(['not_found', 'reverify_disabled']);

export const ReVerificationLifecycleErrorCodeSchema = z.enum([
  'not_found',
  'already_completed',
  'expired',
  'liveness_not_started',
  'liveness_upload_incomplete',
  'insufficient_balance',
]);

export type ReVerificationCreateInput = z.infer<typeof ReVerificationCreateInputSchema>;
export type ReVerificationCreateResult = z.infer<typeof ReVerificationCreateResultSchema>;
export type LivenessChallengeStep = z.infer<typeof LivenessChallengeStepSchema>;
export type LivenessChallengeScript = z.infer<typeof LivenessChallengeScriptSchema>;
export type ReVerificationLivenessStartResult = z.infer<
  typeof ReVerificationLivenessStartResultSchema
>;
export type ReVerificationLivenessUploadUrlInput = z.infer<
  typeof ReVerificationLivenessUploadUrlInputSchema
>;
export type ReVerificationLivenessUploadUrlResult = z.infer<
  typeof ReVerificationLivenessUploadUrlResultSchema
>;
export type ReVerificationDecision = z.infer<typeof ReVerificationDecisionSchema>;
export type ReVerificationDecisionResult = z.infer<typeof ReVerificationDecisionResultSchema>;
export type ReVerificationErrorCode = z.infer<typeof ReVerificationErrorCodeSchema>;
export type ReVerificationLifecycleErrorCode = z.infer<
  typeof ReVerificationLifecycleErrorCodeSchema
>;
