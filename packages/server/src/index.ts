/**
 * @deepidv/server — Identity verification SDK for Node.js, Deno, Bun, and edge runtimes.
 *
 * @example
 * ```typescript
 * import { DeepIDV } from '@deepidv/server';
 *
 * const client = new DeepIDV({ apiKey: process.env.DEEPIDV_API_KEY! });
 *
 * const result = await client.identity.verify({
 *   documentImage: passportBuffer,
 *   faceImage: selfieBuffer,
 * });
 * ```
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// 1. DeepIDV class and config schema (primary entry point)
// ---------------------------------------------------------------------------
export { DeepIDV, DeepIDVConfigSchema } from './deepidv.js';
export type { DeepIDVOptions } from './deepidv.js';

// ---------------------------------------------------------------------------
// 2. Config type from core (re-exported for consumers who need the interface)
// ---------------------------------------------------------------------------
export type { DeepIDVConfig } from '@deepidv/core';

// ---------------------------------------------------------------------------
// 3. Error classes from core
// ---------------------------------------------------------------------------
export {
  DeepIDVError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  RateLimitError,
  ValidationError,
  NotFoundError,
  NetworkError,
  TimeoutError,
  InsufficientFundsError,
  ServiceUnavailableError,
  AdverseMediaFailedError,
  TitleCheckFailedError,
  PollTimeoutError,
} from '@deepidv/core';
export type { RawResponse } from '@deepidv/core';

// ---------------------------------------------------------------------------
// 4. Event types from core (needed for the client.on() method)
// ---------------------------------------------------------------------------
export type { SDKEventMap } from '@deepidv/core';

// ---------------------------------------------------------------------------
// 5. Session types and schemas
// ---------------------------------------------------------------------------
export type {
  SessionCreateInput,
  SessionCreateResult,
  SessionLocation,
  SessionAutoDecisionState,
  SessionAutoDecision,
  SessionDecisionSource,
  Session,
  SessionRetrieveResult,
  SessionListParams,
  SessionListResult,
  SessionStatusUpdate,
  SessionStatusUpdateResult,
  SessionUploadType,
  LegacySessionUploadFile,
  DynamicSessionUploadFile,
  SessionUploadFile,
  SessionUploadUrlsInput,
  SessionSignedUrl,
  SessionUploadUrlsResult,
} from './sessions.types.js';
export {
  SessionCreateInputSchema,
  SessionCreateResultSchema,
  SessionLocationSchema,
  SessionAutoDecisionStateSchema,
  SessionAutoDecisionSchema,
  SessionDecisionSourceSchema,
  SessionListParamsSchema,
  SessionListResultSchema,
  SessionRetrieveResultSchema,
  SessionStatusUpdateSchema,
  SessionStatusUpdateResultSchema,
  SessionStatusSchema,
  SessionUploadTypeSchema,
  LegacySessionUploadFileSchema,
  DynamicSessionUploadFileSchema,
  SessionUploadFileSchema,
  SessionUploadUrlsInputSchema,
  SessionSignedUrlSchema,
  SessionUploadUrlsResultSchema,
} from './sessions.types.js';

// ---------------------------------------------------------------------------
// 6. Document types and schemas
// ---------------------------------------------------------------------------
export type { DocumentScanInput, DocumentScanResult, DocumentType } from './document.types.js';
export {
  DocumentScanInputSchema,
  DocumentScanResultSchema,
  DocumentTypeSchema,
} from './document.types.js';

// ---------------------------------------------------------------------------
// 7. Face types and schemas
// ---------------------------------------------------------------------------
export type {
  FaceDetectInput,
  FaceDetectResult,
  FaceCompareInput,
  FaceCompareResult,
  FaceEstimateAgeInput,
  FaceEstimateAgeResult,
  Gender,
  FaceLivenessChallengeType,
  FaceLivenessSessionInput,
  FaceLivenessCredentials,
  FaceLivenessSessionResult,
  FaceLivenessResultParams,
  FaceLivenessResult,
} from './face.types.js';
export {
  FaceDetectInputSchema,
  FaceDetectResultSchema,
  FaceCompareInputSchema,
  FaceCompareResultSchema,
  FaceEstimateAgeInputSchema,
  FaceEstimateAgeResultSchema,
  GenderSchema,
  FaceLivenessChallengeTypeSchema,
  FaceLivenessSessionInputSchema,
  FaceLivenessCredentialsSchema,
  FaceLivenessSessionResultSchema,
  FaceLivenessResultParamsSchema,
  FaceLivenessResultSchema,
} from './face.types.js';

// ---------------------------------------------------------------------------
// 8. Identity types and schemas
// ---------------------------------------------------------------------------
export type {
  IdentityVerifyInput,
  IdentityVerificationResult,
  IdentityDocumentResult,
  IdentityFaceDetectionResult,
  IdentityFaceMatchResult,
} from './identity.types.js';
export {
  IdentityVerifyInputSchema,
  IdentityVerificationResultSchema,
  IdentityDocumentResultSchema,
  IdentityFaceDetectionResultSchema,
  IdentityFaceMatchResultSchema,
} from './identity.types.js';

// ---------------------------------------------------------------------------
// 9. Screening types and schemas
// ---------------------------------------------------------------------------
export type {
  PepSanctionsInput,
  PepSanctionsResult,
  AdverseMediaInput,
  AdverseMediaQueuedResponse,
  AdverseMediaResult,
  AdverseMediaJobSnapshot,
  TitleCheckInput,
  TitleCheckResult,
} from './screening.types.js';
export {
  PepSanctionsInputSchema,
  PepSanctionsResultSchema,
  AdverseMediaInputSchema,
  AdverseMediaQueuedResponseSchema,
  AdverseMediaResultSchema,
  AdverseMediaJobSnapshotSchema,
  TitleCheckInputSchema,
  TitleCheckResultSchema,
} from './screening.types.js';
export type { AdverseMediaHandle, AdverseMediaWaitOptions } from './asyncJobHandle.js';

// ---------------------------------------------------------------------------
// 10. Async-jobs types and schemas
// ---------------------------------------------------------------------------
export type { AsyncJobStatus, AsyncJobSnapshot } from './asyncJobs.types.js';
export { AsyncJobStatusSchema, AsyncJobSnapshotSchema } from './asyncJobs.types.js';

// ---------------------------------------------------------------------------
// 11. Deepfake types and schemas
// ---------------------------------------------------------------------------
export type {
  DeepfakeChallengeResult,
  DeepfakeUploadUrlsInput,
  DeepfakeUploadUrlsResult,
  DeepfakeAction,
  DeepfakeFrameMeta,
  DeepfakeS3Keys,
  DeepfakeAnalyzeInput,
  DeepfakeVerdict,
  DeepfakeTrustVerdict,
  DeepfakeAnalyzeDetails,
  DeepfakeAnalyzeResult,
} from './deepfake.types.js';
export {
  DeepfakeChallengeResultSchema,
  DeepfakeUploadUrlsInputSchema,
  DeepfakeUploadUrlsResultSchema,
  DeepfakeActionSchema,
  DeepfakeFrameMetaSchema,
  DeepfakeS3KeysSchema,
  DeepfakeAnalyzeInputSchema,
  DeepfakeVerdictSchema,
  DeepfakeTrustVerdictSchema,
  DeepfakeAnalyzeDetailsSchema,
  DeepfakeAnalyzeResultSchema,
} from './deepfake.types.js';

// ---------------------------------------------------------------------------
// 12. Authentication types and schemas
// ---------------------------------------------------------------------------
export type { AuthOrganization, AuthVerifyResult } from './auth.types.js';
export { AuthOrganizationSchema, AuthVerifyResultSchema } from './auth.types.js';

// NOTE: Namespace classes are
// NOT exported. Consumers access them exclusively through client.sessions,
// client.document, client.face, client.identity, client.screening, and
// client.asyncJobs, client.deepfake, and client.auth (per D-01, API-05).
