/**
 * Zod schemas and inferred TypeScript types for the sessions module.
 *
 * All TypeScript types are derived exclusively from Zod schemas via
 * `z.infer<typeof Schema>` (D-04). No separate `interface` declarations.
 *
 * @module sessions.types
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enum schemas
// ---------------------------------------------------------------------------

/**
 * All valid session status values returned by the API.
 */
export const SessionStatusSchema = z.enum([
  'PENDING',
  'SUBMITTED',
  'VERIFIED',
  'REJECTED',
  'VOIDED',
]);

/**
 * All valid session type values returned by the API.
 */
export const SessionTypeSchema = z.enum([
  'session',
  'verification',
  'credit-application',
  'silent-screening',
  'deep-doc',
]);

/**
 * Session progress values indicating applicant progress through the session.
 */
export const SessionProgressSchema = z.enum(['PENDING', 'STARTED', 'COMPLETED']);

/**
 * Valid status targets for `updateStatus()`. Only VERIFIED, REJECTED, and
 * VOIDED are accepted — PENDING and SUBMITTED cannot be set manually (SESS-04).
 */
export const SessionStatusUpdateSchema = z.enum(['VERIFIED', 'REJECTED', 'VOIDED']);

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

/**
 * Input schema for `sessions.create()`. All required fields must be
 * non-empty strings. Optional invite flags default to true on the API.
 */
export const SessionCreateInputSchema = z.object({
  /** Applicant first name (required). */
  firstName: z.string().min(1),
  /** Applicant last name (required). */
  lastName: z.string().min(1),
  /** Applicant email address (required, must be valid email format). */
  email: z.string().email(),
  /** Applicant phone number in E.164 format, e.g. "+15192223333" (required). */
  phone: z.string().min(1),
  /** Your internal reference ID echoed back in responses. */
  externalId: z.string().optional(),
  /** Workflow to use for this session (omit for standalone session). */
  workflowId: z.string().optional(),
  /** HTTPS URL to redirect the applicant after completing the session. */
  redirectUrl: z.string().url().optional(),
  /** Send email invitation to applicant. Defaults to true on the API. */
  sendEmailInvite: z.boolean().optional(),
  /** Send SMS invitation to applicant. Defaults to true on the API. */
  sendPhoneInvite: z.boolean().optional(),
});

/**
 * Query parameters for `sessions.list()`.
 */
export const SessionListParamsSchema = z.object({
  /** Maximum number of sessions to return. */
  limit: z.number().int().positive().optional(),
  /** Number of sessions to skip for pagination. */
  offset: z.number().int().nonnegative().optional(),
  /** Filter sessions by status. */
  status: SessionStatusSchema.optional(),
});

// ---------------------------------------------------------------------------
// Output schemas — for type inference only (NOT used for runtime response
// parsing per RESEARCH.md Pitfall 1: parsing breaks on new API fields)
// ---------------------------------------------------------------------------

/**
 * Response schema for `sessions.create()`.
 */
export const SessionCreateResultSchema = z.object({
  /** Unique session identifier. */
  id: z.string(),
  /** URL where the applicant completes verification. */
  sessionUrl: z.string(),
  /** Echoed back if provided in the create input. */
  externalId: z.string().optional(),
  /** Associated verification links. */
  links: z.array(
    z.object({
      url: z.string(),
      type: z.string(),
    }),
  ),
});

// ---------------------------------------------------------------------------
// Nested sub-schemas for retrieve() result
// ---------------------------------------------------------------------------

/** Face detection result from ID document analysis. Uses passthrough() for undocumented fields. */
const FaceDetectionSchema = z
  .object({
    /** Detection confidence score (0-1). */
    confidence: z.number().optional(),
    /** Bounding box of detected face. */
    boundingBox: z
      .object({
        top: z.number(),
        left: z.number(),
        width: z.number(),
        height: z.number(),
      })
      .optional(),
  })
  .passthrough();

/** Single extracted text item from an ID document. */
const ExtractedTextItemSchema = z.object({
  type: z.string(),
  value: z.string(),
  confidence: z.number(),
});

/** ID document analysis data including face detection and extracted text fields. */
const IdAnalysisDataSchema = z
  .object({
    detectFaceData: z.array(FaceDetectionSchema),
    idExtractedText: z.array(ExtractedTextItemSchema),
    expiryDatePass: z.boolean(),
    validStatePass: z.boolean(),
    ageRestrictionPass: z.boolean(),
  })
  .optional();

/** Face comparison analysis data. */
const CompareFacesDataSchema = z
  .object({
    faceMatchConfidence: z.number(),
    faceMatchResult: z.record(z.string(), z.unknown()),
  })
  .optional();

/** PEP and sanctions screening data. Individual match shapes use passthrough(). */
const PepSanctionsDataSchema = z
  .object({
    peps: z.array(z.object({}).passthrough()).nullable(),
    sanctions: z.array(z.object({}).passthrough()).nullable(),
    both: z.array(z.object({}).passthrough()).nullable(),
  })
  .optional();

/** Adverse media screening data. */
const AdverseMediaDataSchema = z
  .object({
    totalHits: z.number(),
    newsExposures: z.record(z.string(), z.unknown()),
    timestamp: z.string(),
  })
  .optional();

/** Document risk analysis data. Individual document analysis shape uses passthrough(). */
const DocumentRiskDataSchema = z
  .object({
    overallRiskScore: z.number(),
    documentsAnalyzed: z.number(),
    documentsWithSignals: z.number(),
    documentAnalysis: z.array(z.object({}).passthrough()),
  })
  .optional();

/**
 * Full analysis data subtree from `retrieve()`. All sub-objects are optional
 * because not all workflow steps produce all analysis types.
 */
const AnalysisDataSchema = z
  .object({
    createdAt: z.string(),
    idMatchesSelfie: z.boolean().optional(),
    facelivenessScore: z.number().optional(),
    idAnalysisData: IdAnalysisDataSchema,
    secondaryIdAnalysisData: z.unknown().optional(),
    tertiaryIdAnalysisData: z.unknown().optional(),
    compareFacesData: CompareFacesDataSchema,
    pepSanctionsData: PepSanctionsDataSchema,
    adverseMediaData: AdverseMediaDataSchema,
    documentRiskData: DocumentRiskDataSchema,
    titleSearchData: z.unknown().optional(),
    customFormData: z
      .array(
        z.object({
          question: z.string(),
          answer: z.string(),
          type: z.string(),
        }),
      )
      .optional(),
  })
  .optional();

/** Session metadata about the applicant's submission environment. */
const MetaDataSchema = z.object({
  applicantSubmissionIp: z.string().optional(),
  applicantSubmissionDevice: z.string().optional(),
  applicantViewTime: z.string().optional(),
  applicantSubmissionBrowser: z.string().optional(),
});

/** User record (applicant or sender). Optional because not all retrieve responses include it. */
const UserSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    phone: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .optional();

// ---------------------------------------------------------------------------
// Composite schemas
// ---------------------------------------------------------------------------

/**
 * Full session record as returned by the API. Used as the element type for
 * `list()` results and nested inside `retrieve()` results.
 */
export const SessionSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  senderUserId: z.string(),
  externalId: z.string().optional(),
  status: SessionStatusSchema,
  type: SessionTypeSchema,
  sessionProgress: SessionProgressSchema,
  location: z.object({ country: z.string() }).optional(),
  workflowId: z.string().optional(),
  workflowSteps: z.array(z.string()).optional(),
  bankStatementRequestId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  submittedAt: z.string().optional(),
  metaData: MetaDataSchema.optional(),
  uploads: z.record(z.string(), z.boolean()).optional(),
  analysisData: AnalysisDataSchema,
});

/**
 * Full response from `sessions.retrieve()`. Wraps the session record with
 * user details and presigned resource URLs.
 */
export const SessionRetrieveResultSchema = z.object({
  sessionRecord: SessionSchema,
  user: UserSchema,
  senderUser: UserSchema,
  /** Presigned S3 URLs for uploaded documents, keyed by document type. */
  resourceLinks: z.record(z.string(), z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Pagination wrapper (D-05, D-06 — reusable generic across all list methods)
// ---------------------------------------------------------------------------

/**
 * Factory for a paginated response schema. Wraps an array of `itemSchema`
 * with pagination metadata.
 *
 * @param itemSchema - The Zod schema for individual list items.
 * @returns A Zod object schema representing a paginated response.
 */
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    total: z.number().optional(),
    hasMore: z.boolean().optional(),
    limit: z.number(),
    offset: z.number(),
  });

/**
 * Paginated response wrapper returned by all list methods.
 * If the API returns a raw array, the SDK normalizes it to this shape (D-05).
 */
export type PaginatedResponse<T> = {
  data: T[];
  total?: number;
  hasMore?: boolean;
  limit: number;
  offset: number;
};

// ---------------------------------------------------------------------------
// Exported inferred types (z.infer only — no separate interface declarations)
// ---------------------------------------------------------------------------

/** Input for `sessions.create()`. */
export type SessionCreateInput = z.infer<typeof SessionCreateInputSchema>;

/** Response from `sessions.create()`. */
export type SessionCreateResult = z.infer<typeof SessionCreateResultSchema>;

/** Full session record (list item or nested in retrieve result). */
export type Session = z.infer<typeof SessionSchema>;

/** Response from `sessions.retrieve()`. */
export type SessionRetrieveResult = z.infer<typeof SessionRetrieveResultSchema>;

/** Query parameters for `sessions.list()`. */
export type SessionListParams = z.infer<typeof SessionListParamsSchema>;

/** Valid status values for `sessions.updateStatus()`. */
export type SessionStatusUpdate = z.infer<typeof SessionStatusUpdateSchema>;
