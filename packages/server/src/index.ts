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
  CarrierAgeGateInput,
  CarrierAgeGateResult,
  PhoneOwnershipInput,
  PhoneOwnershipResult,
  PhoneTrustInput,
  PhoneTrustTripReason,
  PhoneTrustResult,
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
  CarrierAgeGateInputSchema,
  CarrierAgeGateResultSchema,
  PhoneOwnershipInputSchema,
  PhoneOwnershipResultSchema,
  PhoneTrustInputSchema,
  PhoneTrustTripReasonSchema,
  PhoneTrustResultSchema,
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

// ---------------------------------------------------------------------------
// 13. Workflow definition and execution types and schemas
// ---------------------------------------------------------------------------
export type {
  WorkflowStepId,
  WorkflowStepConfig,
  WorkflowCreateStep,
  WorkflowCreateInput,
  WorkflowStep,
  Workflow,
  WorkflowSummary,
  WorkflowListResult,
  WorkflowResult,
} from './workflows.types.js';
export {
  WORKFLOW_STEP_IDS,
  WorkflowStepIdSchema,
  WorkflowStepConfigSchema,
  WorkflowCreateStepSchema,
  WorkflowCreateInputSchema,
  WorkflowStepSchema,
  WorkflowSchema,
  WorkflowSummarySchema,
  WorkflowListResultSchema,
  WorkflowResultSchema,
} from './workflows.types.js';
export type {
  WorkflowExecutionStepStatus,
  WorkflowStepRequirements,
  WorkflowSessionCreateInput,
  WorkflowSessionCreateStep,
  WorkflowSessionCreateResult,
  WorkflowExecutionStep,
  WorkflowSessionState,
  WorkflowStepSubmissionInput,
  WorkflowStepSubmitResult,
} from './workflowSessions.types.js';
export {
  WorkflowExecutionStepStatusSchema,
  WorkflowStepRequirementsSchema,
  WorkflowSessionCreateInputSchema,
  WorkflowSessionCreateStepSchema,
  WorkflowSessionCreateResultSchema,
  WorkflowExecutionStepSchema,
  WorkflowSessionStateSchema,
  WorkflowStepSubmissionSchemas,
  WorkflowStepSubmitResultSchema,
} from './workflowSessions.types.js';

// ---------------------------------------------------------------------------
// 14. Financial, credit terms, and credit checks
// ---------------------------------------------------------------------------
export type {
  FinancialCreateInput,
  FinancialCreateResult,
  FinancialRecord,
  FinancialListParams,
  FinancialListResult,
} from './financial.types.js';
export {
  FinancialCreateInputSchema,
  FinancialCreateResultSchema,
  FinancialRecordSchema,
  FinancialListParamsSchema,
  FinancialListResultSchema,
} from './financial.types.js';
export type {
  CreditTermsCreateInput,
  CreditTermsCreateResult,
  CreditTermsRecord,
  CreditTermsListParams,
  CreditTermsListResult,
} from './creditTerms.types.js';
export {
  CreditTermsCreateInputSchema,
  CreditTermsCreateResultSchema,
  CreditTermsRecordSchema,
  CreditTermsListParamsSchema,
  CreditTermsListResultSchema,
} from './creditTerms.types.js';
export type {
  CreditCheckCreateInput,
  CreditCheckType,
  CreditCheckLink,
  CreditCheckCreateResult,
} from './creditChecks.types.js';
export {
  CreditCheckCreateInputSchema,
  CreditCheckTypeSchema,
  CreditCheckLinkSchema,
  CreditCheckCreateResultSchema,
} from './creditChecks.types.js';

// ---------------------------------------------------------------------------
// 15. Organization branding profiles
// ---------------------------------------------------------------------------
export type {
  ProfileLogoContentType,
  ProfileLogoUploadUrlInput,
  ProfileLogoUploadUrlResult,
  ProfileLogoUploadInput,
  ProfileCreateInput,
  Profile,
  ProfileListResult,
} from './profiles.types.js';
export {
  ProfileLogoContentTypeSchema,
  ProfileLogoUploadUrlInputSchema,
  ProfileLogoUploadUrlResultSchema,
  ProfileLogoUploadInputSchema,
  ProfileCreateInputSchema,
  ProfileSchema,
  ProfileListResultSchema,
} from './profiles.types.js';

// ---------------------------------------------------------------------------
// 16. iGaming checks and self-exclusion
// ---------------------------------------------------------------------------
export type {
  IGamingCheckVerdict,
  InjectionSignal,
  AnalyzeInjectionInput,
  AnalyzeInjectionResult,
  AnalyzeIpCheckInput,
  IpCheckResult,
  AntiCheatVerdict,
  AntiCheatAction,
  AnalyzeAntiCheatInput,
  AntiCheatResult,
  SelfExclusionListParams,
  SelfExclusionIdentityEntry,
  SelfExclusionFaceEntry,
  SelfExclusionEntry,
  SelfExclusionListResult,
  SelfExclusionIdentityAddInput,
  SelfExclusionIdentityStatus,
  SelfExclusionIdentityAddResult,
  SelfExclusionIdentityRemoveResult,
  SelfExclusionFaceInput,
  SelfExclusionFaceResult,
  SelfExclusionFaceRemoveResult,
  AntiCheatPurgeResult,
  SelfExclusionApplicantInput,
  SelfExclusionApplicantResult,
} from './igaming.types.js';

export {
  IGamingCheckVerdictSchema,
  InjectionSignalSchema,
  AnalyzeInjectionInputSchema,
  AnalyzeInjectionResultSchema,
  AnalyzeIpCheckInputSchema,
  IpCheckResultSchema,
  AntiCheatVerdictSchema,
  AntiCheatActionSchema,
  AnalyzeAntiCheatInputSchema,
  AntiCheatResultSchema,
  SelfExclusionListParamsSchema,
  SelfExclusionIdentityEntrySchema,
  SelfExclusionFaceEntrySchema,
  SelfExclusionEntrySchema,
  SelfExclusionListResultSchema,
  SelfExclusionIdentityAddInputSchema,
  SelfExclusionIdentityStatusSchema,
  SelfExclusionIdentityAddResultSchema,
  SelfExclusionIdentityRemoveResultSchema,
  SelfExclusionFaceInputSchema,
  SelfExclusionFaceResultSchema,
  SelfExclusionFaceRemoveResultSchema,
  AntiCheatPurgeResultSchema,
  SelfExclusionApplicantInputSchema,
  SelfExclusionApplicantResultSchema,
} from './igaming.types.js';

// ---------------------------------------------------------------------------
// 17. AML transaction monitoring
// ---------------------------------------------------------------------------
export type {
  AmlTransactionDirection,
  AmlTransactionType,
  AmlTransactionStatus,
  AmlTransactionChannel,
  AmlAmount,
  AmlNormalizedAmount,
  AmlCounterparty,
  AmlGeography,
  AmlCrypto,
  AmlSubject,
  AmlTransactionInput,
  AmlSaveTransactionsInput,
  AmlRecordStatus,
  AmlRecordError,
  AmlRecordResult,
  AmlSaveTransactionsResult,
  AmlQuotaExceeded,
  AddMonitoredUserInput,
  MonitoredUser,
} from './aml.types.js';

export {
  AmlTransactionDirectionSchema,
  AmlTransactionTypeSchema,
  AmlTransactionStatusSchema,
  AmlTransactionChannelSchema,
  AmlAmountSchema,
  AmlNormalizedAmountSchema,
  AmlCounterpartySchema,
  AmlGeographySchema,
  AmlCryptoSchema,
  AmlSubjectSchema,
  AmlTransactionInputSchema,
  AmlSaveTransactionsInputSchema,
  AmlRecordStatusSchema,
  AmlRecordErrorSchema,
  AmlRecordResultSchema,
  AmlSaveTransactionsResultSchema,
  AmlQuotaExceededSchema,
  AddMonitoredUserInputSchema,
  MonitoredUserSchema,
} from './aml.types.js';

// ---------------------------------------------------------------------------
// 18. Age verification and Parent Connect
// ---------------------------------------------------------------------------
export type {
  AgeVerificationMethod,
  PlatformRestriction,
  AgeVerificationCreateInput,
  AgeVerificationLink,
  AgeVerificationCreateResult,
  ParentConnectStatus,
  ParentConnectListParams,
  ParentConnectRequest,
  ParentConnectListResult,
  AgeVerificationBoundaries,
} from './ageVerification.types.js';
export {
  AgeVerificationMethodSchema,
  PlatformRestrictionSchema,
  AgeVerificationCreateInputSchema,
  AgeVerificationLinkSchema,
  AgeVerificationCreateResultSchema,
  ParentConnectStatusSchema,
  ParentConnectListParamsSchema,
  ParentConnectRequestSchema,
  ParentConnectListResultSchema,
  AgeVerificationBoundariesSchema,
} from './ageVerification.types.js';

// ---------------------------------------------------------------------------
// 19. Re-verification lifecycle
// ---------------------------------------------------------------------------
export type {
  ReVerificationCreateInput,
  ReVerificationCreateResult,
  LivenessChallengeStep,
  LivenessChallengeScript,
  ReVerificationLivenessStartResult,
  ReVerificationLivenessUploadUrlInput,
  ReVerificationLivenessUploadUrlResult,
  ReVerificationDecision,
  ReVerificationDecisionResult,
  ReVerificationErrorCode,
  ReVerificationLifecycleErrorCode,
} from './reVerifications.types.js';
export {
  ReVerificationCreateInputSchema,
  ReVerificationCreateResultSchema,
  LivenessChallengeStepSchema,
  LivenessChallengeScriptSchema,
  ReVerificationLivenessStartResultSchema,
  ReVerificationLivenessUploadUrlInputSchema,
  ReVerificationLivenessUploadUrlResultSchema,
  ReVerificationDecisionSchema,
  ReVerificationDecisionResultSchema,
  ReVerificationErrorCodeSchema,
  ReVerificationLifecycleErrorCodeSchema,
} from './reVerifications.types.js';

// NOTE: Namespace classes are
// NOT exported. Consumers access them exclusively through client.sessions,
// client.document, client.face, client.identity, client.screening, and
// client.asyncJobs, client.deepfake, client.auth, client.workflows,
// client.workflowSessions, client.financial, client.creditTerms, and
// client.creditChecks, client.profiles, client.igaming, client.aml,
// client.ageVerification, and client.reVerifications
// (per D-01, API-05).
