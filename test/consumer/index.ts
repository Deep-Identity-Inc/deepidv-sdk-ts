/** Consumer declaration-file validation for every @deepidv/server export. */

import {
  DeepIDV,
  DeepIDVConfigSchema,
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
  DocumentScanInputSchema,
  DocumentScanResultSchema,
  DocumentTypeSchema,
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
  IdentityVerifyInputSchema,
  IdentityVerificationResultSchema,
  IdentityDocumentResultSchema,
  IdentityFaceDetectionResultSchema,
  IdentityFaceMatchResultSchema,
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
  AsyncJobStatusSchema,
  AsyncJobSnapshotSchema,
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
  AuthOrganizationSchema,
  AuthVerifyResultSchema,
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
  WorkflowExecutionStepStatusSchema,
  WorkflowStepRequirementsSchema,
  WorkflowSessionCreateInputSchema,
  WorkflowSessionCreateStepSchema,
  WorkflowSessionCreateResultSchema,
  WorkflowExecutionStepSchema,
  WorkflowSessionStateSchema,
  WorkflowStepSubmissionSchemas,
  WorkflowStepSubmitResultSchema,
  FinancialCreateInputSchema,
  FinancialCreateResultSchema,
  FinancialRecordSchema,
  FinancialListParamsSchema,
  FinancialListResultSchema,
  CreditTermsCreateInputSchema,
  CreditTermsCreateResultSchema,
  CreditTermsRecordSchema,
  CreditTermsListParamsSchema,
  CreditTermsListResultSchema,
  CreditCheckCreateInputSchema,
  CreditCheckTypeSchema,
  CreditCheckLinkSchema,
  CreditCheckCreateResultSchema,
  ProfileLogoContentTypeSchema,
  ProfileLogoUploadUrlInputSchema,
  ProfileLogoUploadUrlResultSchema,
  ProfileLogoUploadInputSchema,
  ProfileCreateInputSchema,
  ProfileSchema,
  ProfileListResultSchema,
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
} from '@deepidv/server';
import type {
  DeepIDVOptions,
  DeepIDVConfig,
  RawResponse,
  SDKEventMap,
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
  DocumentScanInput,
  DocumentScanResult,
  DocumentType,
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
  IdentityVerifyInput,
  IdentityVerificationResult,
  IdentityDocumentResult,
  IdentityFaceDetectionResult,
  IdentityFaceMatchResult,
  PepSanctionsInput,
  PepSanctionsResult,
  AdverseMediaInput,
  AdverseMediaQueuedResponse,
  AdverseMediaResult,
  AdverseMediaJobSnapshot,
  AdverseMediaHandle,
  AdverseMediaWaitOptions,
  TitleCheckInput,
  TitleCheckResult,
  CarrierAgeGateInput,
  CarrierAgeGateResult,
  PhoneOwnershipInput,
  PhoneOwnershipResult,
  PhoneTrustInput,
  PhoneTrustTripReason,
  PhoneTrustResult,
  AsyncJobStatus,
  AsyncJobSnapshot,
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
  AuthOrganization,
  AuthVerifyResult,
  WorkflowStepId,
  WorkflowStepConfig,
  WorkflowCreateStep,
  WorkflowCreateInput,
  WorkflowStep,
  Workflow,
  WorkflowSummary,
  WorkflowListResult,
  WorkflowResult,
  WorkflowExecutionStepStatus,
  WorkflowStepRequirements,
  WorkflowSessionCreateInput,
  WorkflowSessionCreateStep,
  WorkflowSessionCreateResult,
  WorkflowExecutionStep,
  WorkflowSessionState,
  WorkflowStepSubmissionInput,
  WorkflowStepSubmitResult,
  FinancialCreateInput,
  FinancialCreateResult,
  FinancialRecord,
  FinancialListParams,
  FinancialListResult,
  CreditTermsCreateInput,
  CreditTermsCreateResult,
  CreditTermsRecord,
  CreditTermsListParams,
  CreditTermsListResult,
  CreditCheckCreateInput,
  CreditCheckType,
  CreditCheckLink,
  CreditCheckCreateResult,
  ProfileLogoContentType,
  ProfileLogoUploadUrlInput,
  ProfileLogoUploadUrlResult,
  ProfileLogoUploadInput,
  ProfileCreateInput,
  Profile,
  ProfileListResult,
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
} from '@deepidv/server';

const client = new DeepIDV({ apiKey: 'test' });
const namespaces = [
  client.sessions,
  client.document,
  client.face,
  client.identity,
  client.screening,
  client.asyncJobs,
  client.deepfake,
  client.auth,
  client.workflows,
  client.workflowSessions,
  client.financial,
  client.creditTerms,
  client.creditChecks,
  client.profiles,
  client.igaming,
  client.igaming.selfExclusion,
  client.aml,
];

const values = [
  DeepIDVConfigSchema,
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
  DocumentScanInputSchema,
  DocumentScanResultSchema,
  DocumentTypeSchema,
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
  IdentityVerifyInputSchema,
  IdentityVerificationResultSchema,
  IdentityDocumentResultSchema,
  IdentityFaceDetectionResultSchema,
  IdentityFaceMatchResultSchema,
  PepSanctionsInputSchema,
  PepSanctionsResultSchema,
  AdverseMediaInputSchema,
  AdverseMediaQueuedResponseSchema,
  AdverseMediaResultSchema,
  AdverseMediaJobSnapshotSchema,
  TitleCheckInputSchema,
  TitleCheckResultSchema,
  AsyncJobStatusSchema,
  AsyncJobSnapshotSchema,
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
  AuthOrganizationSchema,
  AuthVerifyResultSchema,
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
  WorkflowExecutionStepStatusSchema,
  WorkflowStepRequirementsSchema,
  WorkflowSessionCreateInputSchema,
  WorkflowSessionCreateStepSchema,
  WorkflowSessionCreateResultSchema,
  WorkflowExecutionStepSchema,
  WorkflowSessionStateSchema,
  WorkflowStepSubmissionSchemas,
  WorkflowStepSubmitResultSchema,
  CarrierAgeGateInputSchema,
  CarrierAgeGateResultSchema,
  PhoneOwnershipInputSchema,
  PhoneOwnershipResultSchema,
  PhoneTrustInputSchema,
  PhoneTrustTripReasonSchema,
  PhoneTrustResultSchema,
  FinancialCreateInputSchema,
  FinancialCreateResultSchema,
  FinancialRecordSchema,
  FinancialListParamsSchema,
  FinancialListResultSchema,
  CreditTermsCreateInputSchema,
  CreditTermsCreateResultSchema,
  CreditTermsRecordSchema,
  CreditTermsListParamsSchema,
  CreditTermsListResultSchema,
  CreditCheckCreateInputSchema,
  CreditCheckTypeSchema,
  CreditCheckLinkSchema,
  CreditCheckCreateResultSchema,
  ProfileLogoContentTypeSchema,
  ProfileLogoUploadUrlInputSchema,
  ProfileLogoUploadUrlResultSchema,
  ProfileLogoUploadInputSchema,
  ProfileCreateInputSchema,
  ProfileSchema,
  ProfileListResultSchema,
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
];

type PublicTypes =
  | DeepIDVOptions
  | DeepIDVConfig
  | RawResponse
  | SDKEventMap
  | SessionCreateInput
  | SessionCreateResult
  | SessionLocation
  | SessionAutoDecisionState
  | SessionAutoDecision
  | SessionDecisionSource
  | Session
  | SessionRetrieveResult
  | SessionListParams
  | SessionListResult
  | SessionStatusUpdate
  | SessionStatusUpdateResult
  | SessionUploadType
  | LegacySessionUploadFile
  | DynamicSessionUploadFile
  | SessionUploadFile
  | SessionUploadUrlsInput
  | SessionSignedUrl
  | SessionUploadUrlsResult
  | DocumentScanInput
  | DocumentScanResult
  | DocumentType
  | FaceDetectInput
  | FaceDetectResult
  | FaceCompareInput
  | FaceCompareResult
  | FaceEstimateAgeInput
  | FaceEstimateAgeResult
  | Gender
  | FaceLivenessChallengeType
  | FaceLivenessSessionInput
  | FaceLivenessCredentials
  | FaceLivenessSessionResult
  | FaceLivenessResultParams
  | FaceLivenessResult
  | IdentityVerifyInput
  | IdentityVerificationResult
  | IdentityDocumentResult
  | IdentityFaceDetectionResult
  | IdentityFaceMatchResult
  | PepSanctionsInput
  | PepSanctionsResult
  | AdverseMediaInput
  | AdverseMediaQueuedResponse
  | AdverseMediaResult
  | AdverseMediaJobSnapshot
  | AdverseMediaHandle
  | AdverseMediaWaitOptions
  | TitleCheckInput
  | TitleCheckResult
  | AsyncJobStatus
  | AsyncJobSnapshot
  | DeepfakeChallengeResult
  | DeepfakeUploadUrlsInput
  | DeepfakeUploadUrlsResult
  | DeepfakeAction
  | DeepfakeFrameMeta
  | DeepfakeS3Keys
  | DeepfakeAnalyzeInput
  | DeepfakeVerdict
  | DeepfakeTrustVerdict
  | DeepfakeAnalyzeDetails
  | DeepfakeAnalyzeResult
  | AuthOrganization
  | AuthVerifyResult
  | WorkflowStepId
  | WorkflowStepConfig
  | WorkflowCreateStep
  | WorkflowCreateInput
  | WorkflowStep
  | Workflow
  | WorkflowSummary
  | WorkflowListResult
  | WorkflowResult
  | WorkflowExecutionStepStatus
  | WorkflowStepRequirements
  | WorkflowSessionCreateInput
  | WorkflowSessionCreateStep
  | WorkflowSessionCreateResult
  | WorkflowExecutionStep
  | WorkflowSessionState
  | WorkflowStepSubmissionInput<'FACE_LIVENESS'>
  | WorkflowStepSubmitResult
  | CarrierAgeGateInput
  | CarrierAgeGateResult
  | PhoneOwnershipInput
  | PhoneOwnershipResult
  | PhoneTrustInput
  | PhoneTrustTripReason
  | PhoneTrustResult
  | FinancialCreateInput
  | FinancialCreateResult
  | FinancialRecord
  | FinancialListParams
  | FinancialListResult
  | CreditTermsCreateInput
  | CreditTermsCreateResult
  | CreditTermsRecord
  | CreditTermsListParams
  | CreditTermsListResult
  | CreditCheckCreateInput
  | CreditCheckType
  | CreditCheckLink
  | CreditCheckCreateResult
  | ProfileLogoContentType
  | ProfileLogoUploadUrlInput
  | ProfileLogoUploadUrlResult
  | ProfileLogoUploadInput
  | ProfileCreateInput
  | Profile
  | ProfileListResult
  | IGamingCheckVerdict
  | InjectionSignal
  | AnalyzeInjectionInput
  | AnalyzeInjectionResult
  | AnalyzeIpCheckInput
  | IpCheckResult
  | AntiCheatVerdict
  | AntiCheatAction
  | AnalyzeAntiCheatInput
  | AntiCheatResult
  | SelfExclusionListParams
  | SelfExclusionIdentityEntry
  | SelfExclusionFaceEntry
  | SelfExclusionEntry
  | SelfExclusionListResult
  | SelfExclusionIdentityAddInput
  | SelfExclusionIdentityStatus
  | SelfExclusionIdentityAddResult
  | SelfExclusionIdentityRemoveResult
  | SelfExclusionFaceInput
  | SelfExclusionFaceResult
  | SelfExclusionFaceRemoveResult
  | AntiCheatPurgeResult
  | SelfExclusionApplicantInput
  | SelfExclusionApplicantResult
  | AmlTransactionDirection
  | AmlTransactionType
  | AmlTransactionStatus
  | AmlTransactionChannel
  | AmlAmount
  | AmlNormalizedAmount
  | AmlCounterparty
  | AmlGeography
  | AmlCrypto
  | AmlSubject
  | AmlTransactionInput
  | AmlSaveTransactionsInput
  | AmlRecordStatus
  | AmlRecordError
  | AmlRecordResult
  | AmlSaveTransactionsResult
  | AmlQuotaExceeded
  | AddMonitoredUserInput
  | MonitoredUser;

declare const publicType: PublicTypes;
void namespaces;
void values;
void publicType;
