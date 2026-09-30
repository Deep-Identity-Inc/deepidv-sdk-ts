/** Schemas and public types for resumable workflow-session execution. */

import { z } from 'zod';
import {
  DeepfakeActionSchema,
  DeepfakeFrameMetaSchema,
  DeepfakeS3KeysSchema,
} from './deepfake.types.js';
import type { WorkflowStepId } from './workflows.types.js';

export const WorkflowExecutionStepStatusSchema = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'SKIPPED',
]);

export const WorkflowStepRequirementsSchema = z.record(z.string(), z.unknown());

export const WorkflowSessionCreateInputSchema = z.object({
  email: z.string().min(1),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  phone: z.string().regex(/^\+[1-9]\d{9,14}$/u, 'phone must be a valid E.164 number'),
  externalId: z.string().optional(),
  expiresInHours: z.number().int().min(1).max(8760).optional(),
});

export const WorkflowSessionCreateStepSchema = z.object({
  stepId: z.string(),
  status: WorkflowExecutionStepStatusSchema,
  requirements: WorkflowStepRequirementsSchema,
});

export const WorkflowSessionCreateResultSchema = z.object({
  sessionId: z.string(),
  expiresAt: z.string().nullable(),
  steps: z.array(WorkflowSessionCreateStepSchema),
  currentStep: z.number().int().min(0),
});

export const WorkflowSessionCreateWireResultSchema = z
  .object({
    session_id: z.string(),
    expires_at: z.string().nullable(),
    steps: z.array(
      z.object({
        step_id: z.string(),
        status: WorkflowExecutionStepStatusSchema,
        requirements: WorkflowStepRequirementsSchema,
      }),
    ),
    current_step: z.number().int().min(0),
  })
  .transform((raw) => ({
    sessionId: raw.session_id,
    expiresAt: raw.expires_at,
    steps: raw.steps.map((step) => ({
      stepId: step.step_id,
      status: step.status,
      requirements: step.requirements,
    })),
    currentStep: raw.current_step,
  }));

export const WorkflowExecutionStepSchema = WorkflowSessionCreateStepSchema.extend({
  attempts: z.number().int().min(0),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  failureReason: z.string().nullable(),
});

export const WorkflowSessionStateSchema = z.object({
  sessionId: z.string(),
  status: z.string(),
  sessionProgress: z.string(),
  steps: z.array(WorkflowExecutionStepSchema),
  currentStep: z.number().int().min(0).nullable(),
  attemptsRemaining: z.number().int().min(0).nullable(),
});

export const WorkflowSessionStateWireSchema = z
  .object({
    session_id: z.string(),
    status: z.string(),
    session_progress: z.string(),
    steps: z.array(
      z.object({
        step_id: z.string(),
        status: WorkflowExecutionStepStatusSchema,
        attempts: z.number().int().min(0),
        started_at: z.string().nullable(),
        completed_at: z.string().nullable(),
        failure_reason: z.string().nullable(),
        requirements: WorkflowStepRequirementsSchema,
      }),
    ),
    current_step: z.number().int().min(0).nullable(),
    attempts_remaining: z.number().int().min(0).nullable(),
  })
  .transform((raw) => ({
    sessionId: raw.session_id,
    status: raw.status,
    sessionProgress: raw.session_progress,
    steps: raw.steps.map((step) => ({
      stepId: step.step_id,
      status: step.status,
      attempts: step.attempts,
      startedAt: step.started_at,
      completedAt: step.completed_at,
      failureReason: step.failure_reason,
      requirements: step.requirements,
    })),
    currentStep: raw.current_step,
    attemptsRemaining: raw.attempts_remaining,
  }));

const EmptySubmissionSchema = z.object({}).strict();
const HostedActionSchema = z.object({ action: z.enum(['start', 'complete']) }).strict();

const ConsentSubmissionSchema = z
  .union([
    z.object({
      accepted: z.literal(true),
      legalName: z.string().trim().min(1),
      signatureUpload: z.string().min(1).optional(),
    }),
    z.object({ accepted: z.literal(false) }).strict(),
  ])
  .transform((input) =>
    input.accepted
      ? {
          accepted: true as const,
          legal_name: input.legalName,
          ...(input.signatureUpload === undefined
            ? {}
            : { signature_upload: input.signatureUpload }),
        }
      : { accepted: false as const },
  );

const IdVerificationSubmissionSchema = z
  .object({
    documentType: z.string().min(1),
    secondaryDocumentType: z.string().min(1).optional(),
    tertiaryDocumentType: z.string().min(1).optional(),
    uploads: z
      .object({
        idFront: z.string().min(1),
        idBack: z.string().min(1).optional(),
        secondaryIdFront: z.string().min(1).optional(),
        secondaryIdBack: z.string().min(1).optional(),
        tertiaryIdFront: z.string().min(1).optional(),
        tertiaryIdBack: z.string().min(1).optional(),
        selfieFront: z.string().min(1),
      })
      .strict(),
  })
  .strict()
  .transform((input) => ({
    document_type: input.documentType,
    ...(input.secondaryDocumentType === undefined
      ? {}
      : { secondary_document_type: input.secondaryDocumentType }),
    ...(input.tertiaryDocumentType === undefined
      ? {}
      : { tertiary_document_type: input.tertiaryDocumentType }),
    uploads: {
      id_front: input.uploads.idFront,
      ...(input.uploads.idBack === undefined ? {} : { id_back: input.uploads.idBack }),
      ...(input.uploads.secondaryIdFront === undefined
        ? {}
        : { secondary_id_front: input.uploads.secondaryIdFront }),
      ...(input.uploads.secondaryIdBack === undefined
        ? {}
        : { secondary_id_back: input.uploads.secondaryIdBack }),
      ...(input.uploads.tertiaryIdFront === undefined
        ? {}
        : { tertiary_id_front: input.uploads.tertiaryIdFront }),
      ...(input.uploads.tertiaryIdBack === undefined
        ? {}
        : { tertiary_id_back: input.uploads.tertiaryIdBack }),
      selfie_front: input.uploads.selfieFront,
    },
  }));

const FaceLivenessSubmissionSchema = z
  .union([
    z.object({ action: z.literal('start') }).strict(),
    z
      .object({
        action: z.literal('upload-url'),
        frameCount: z.number().int().min(1).max(8),
        clipMimeType: z.string().min(1).optional(),
      })
      .strict(),
    z.object({ action: z.literal('complete') }).strict(),
  ])
  .transform((input) =>
    input.action === 'upload-url'
      ? {
          action: input.action,
          frame_count: input.frameCount,
          ...(input.clipMimeType === undefined ? {} : { clip_mime_type: input.clipMimeType }),
        }
      : input,
  );

const DeepfakeSubmissionSchema = z
  .union([
    z.object({ action: z.literal('start'), includeAudio: z.boolean().optional() }).strict(),
    z
      .object({
        action: z.literal('complete'),
        scanDurationMs: z.number().min(0),
        frameMeta: z.array(DeepfakeFrameMetaSchema).length(6),
        s3Keys: DeepfakeS3KeysSchema,
      })
      .strict(),
  ])
  .transform((input) => {
    if (input.action === 'start') {
      return {
        action: input.action,
        ...(input.includeAudio === undefined ? {} : { include_audio: input.includeAudio }),
      };
    }
    return {
      action: input.action,
      scan_duration_ms: input.scanDurationMs,
      frame_meta: input.frameMeta.map((frame) => ({
        action_id: frame.actionId,
        action: DeepfakeActionSchema.parse(frame.action),
        timestamp: frame.timestamp,
        yaw: frame.yaw,
        pitch: frame.pitch,
        roll: frame.roll,
        left_eye_openness: frame.leftEyeOpenness,
        right_eye_openness: frame.rightEyeOpenness,
        face_detected: frame.faceDetected,
      })),
      s3_keys: input.s3Keys,
    };
  });

const ScreeningIdentitySchema = z.object({
  email: z.string().optional(),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  dateOfBirth: z.iso.date(),
});

const PepSanctionsSubmissionSchema = ScreeningIdentitySchema.strict().transform((input) => ({
  email: input.email,
  first_name: input.firstName,
  last_name: input.lastName,
  date_of_birth: input.dateOfBirth,
}));

const AdverseMediaSubmissionSchema = z
  .union([
    ScreeningIdentitySchema.extend({
      action: z.literal('start'),
      country: z
        .string()
        .regex(/^[A-Z]{2}$/iu)
        .transform((value) => value.toUpperCase())
        .optional(),
    }).strict(),
    z.object({ action: z.literal('complete') }).strict(),
  ])
  .transform((input) =>
    input.action === 'complete'
      ? input
      : {
          action: input.action,
          email: input.email,
          first_name: input.firstName,
          last_name: input.lastName,
          date_of_birth: input.dateOfBirth,
          country: input.country,
        },
  );

export const WorkflowStepSubmissionSchemas = {
  ID_VERIFICATION: IdVerificationSubmissionSchema,
  FACE_LIVENESS: FaceLivenessSubmissionSchema,
  FACE_LIVENESS_CONSENT_SETTINGS: z.union([ConsentSubmissionSchema, EmptySubmissionSchema]),
  AGE_ESTIMATION: z
    .object({ uploads: z.object({ selfieFront: z.string().min(1) }).strict() })
    .strict()
    .transform(({ uploads }) => ({ uploads: { selfie_front: uploads.selfieFront } })),
  DEEPFAKE_DETECTION: DeepfakeSubmissionSchema,
  DEEP_AGE: HostedActionSchema,
  ADDRESS_VERIFICATION: HostedActionSchema,
  BACKGROUND_CHECK: HostedActionSchema,
  TITLE_SEARCH: z.object({ address: z.string().trim().min(1).max(500) }).strict(),
  PEP_SANCTIONS: PepSanctionsSubmissionSchema,
  ADVERSE_MEDIA: AdverseMediaSubmissionSchema,
  CUSTOM_PROMPT: z.object({ uploads: z.record(z.string(), z.string().min(1)) }).strict(),
  CONSENT: ConsentSubmissionSchema,
  BANK_STATEMENT_UPLOAD: HostedActionSchema,
  AI_BANK_STATEMENT_ANALYSIS: EmptySubmissionSchema,
  DOCUMENT_UPLOAD: z.object({ uploads: z.record(z.string(), z.string().min(1)) }).strict(),
  WHITE_LABEL: z.object({ acknowledged: z.literal(true) }).strict(),
  PHONE_TRUST_CHECK: EmptySubmissionSchema,
  CARRIER_AGE_GATE: EmptySubmissionSchema,
  PHONE_OWNERSHIP_MATCH: EmptySubmissionSchema,
  PHONE_VERIFICATION: z.object({ action: z.enum(['start', 'complete']) }).strict(),
} as const satisfies Record<WorkflowStepId, z.ZodType>;

export const WorkflowStepSubmitResultSchema = z.object({
  stepId: z.string(),
  stepStatus: WorkflowExecutionStepStatusSchema,
  failureReason: z.string().nullable(),
  currentStep: z.number().int().min(0).nullable(),
  attemptsRemaining: z.number().int().min(0).nullable(),
  sessionStatus: z.string(),
  sessionProgress: z.string(),
  /** Step-specific OpenAPI fields, retained for forward compatibility. */
  payload: z.record(z.string(), z.unknown()),
});

export const WorkflowStepSubmitWireResultSchema = z
  .object({
    step_id: z.string(),
    step_status: WorkflowExecutionStepStatusSchema,
    failure_reason: z.string().nullable(),
    current_step: z.number().int().min(0).nullable(),
    attempts_remaining: z.number().int().min(0).nullable(),
    session_status: z.string(),
    session_progress: z.string(),
  })
  .loose()
  .transform((raw) => {
    const {
      step_id,
      step_status,
      failure_reason,
      current_step,
      attempts_remaining,
      session_status,
      session_progress,
      ...payload
    } = raw;
    return {
      stepId: step_id,
      stepStatus: step_status,
      failureReason: failure_reason,
      currentStep: current_step,
      attemptsRemaining: attempts_remaining,
      sessionStatus: session_status,
      sessionProgress: session_progress,
      payload,
    };
  });

export type WorkflowExecutionStepStatus = z.infer<typeof WorkflowExecutionStepStatusSchema>;
export type WorkflowStepRequirements = z.infer<typeof WorkflowStepRequirementsSchema>;
export type WorkflowSessionCreateInput = z.infer<typeof WorkflowSessionCreateInputSchema>;
export type WorkflowSessionCreateStep = z.infer<typeof WorkflowSessionCreateStepSchema>;
export type WorkflowSessionCreateResult = z.infer<typeof WorkflowSessionCreateResultSchema>;
export type WorkflowExecutionStep = z.infer<typeof WorkflowExecutionStepSchema>;
export type WorkflowSessionState = z.infer<typeof WorkflowSessionStateSchema>;
export type WorkflowStepSubmissionInput<T extends WorkflowStepId> = z.input<
  (typeof WorkflowStepSubmissionSchemas)[T]
>;
export type WorkflowStepSubmitResult = z.infer<typeof WorkflowStepSubmitResultSchema>;
