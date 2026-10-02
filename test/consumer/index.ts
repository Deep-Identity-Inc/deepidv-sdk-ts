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
  | AuthVerifyResult;

declare const publicType: PublicTypes;
void namespaces;
void values;
void publicType;
