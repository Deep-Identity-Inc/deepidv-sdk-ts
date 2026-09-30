/** Consumer declaration-file validation for every @deepidv/server export. */

import {
  DeepIDV,
  DeepIDVConfigSchema,
  DeepIDVError,
  AuthenticationError,
  AuthorizationError,
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
  SessionListParamsSchema,
  SessionListResultSchema,
  SessionRetrieveResultSchema,
  SessionStatusUpdateSchema,
  SessionStatusUpdateResultSchema,
  SessionStatusSchema,
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
  TitleCheckQueuedResponseSchema,
  TitleCheckResultSchema,
  TitleCheckJobSnapshotSchema,
  AsyncJobStatusSchema,
  AsyncJobSnapshotSchema,
} from '@deepidv/server';
import type {
  DeepIDVOptions,
  DeepIDVConfig,
  RawResponse,
  SDKEventMap,
  SessionCreateInput,
  SessionCreateResult,
  Session,
  SessionRetrieveResult,
  SessionListParams,
  SessionListResult,
  SessionStatusUpdate,
  SessionStatusUpdateResult,
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
  TitleCheckQueuedResponse,
  TitleCheckResult,
  TitleCheckJobSnapshot,
  TitleCheckHandle,
  TitleCheckWaitOptions,
  AsyncJobStatus,
  AsyncJobSnapshot,
} from '@deepidv/server';

const client = new DeepIDV({ apiKey: 'test' });
const namespaces = [
  client.sessions,
  client.document,
  client.face,
  client.identity,
  client.screening,
  client.asyncJobs,
];

const values = [
  DeepIDVConfigSchema,
  DeepIDVError,
  AuthenticationError,
  AuthorizationError,
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
  SessionListParamsSchema,
  SessionListResultSchema,
  SessionRetrieveResultSchema,
  SessionStatusUpdateSchema,
  SessionStatusUpdateResultSchema,
  SessionStatusSchema,
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
  TitleCheckQueuedResponseSchema,
  TitleCheckResultSchema,
  TitleCheckJobSnapshotSchema,
  AsyncJobStatusSchema,
  AsyncJobSnapshotSchema,
];

type PublicTypes =
  | DeepIDVOptions
  | DeepIDVConfig
  | RawResponse
  | SDKEventMap
  | SessionCreateInput
  | SessionCreateResult
  | Session
  | SessionRetrieveResult
  | SessionListParams
  | SessionListResult
  | SessionStatusUpdate
  | SessionStatusUpdateResult
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
  | TitleCheckQueuedResponse
  | TitleCheckResult
  | TitleCheckJobSnapshot
  | TitleCheckHandle
  | TitleCheckWaitOptions
  | AsyncJobStatus
  | AsyncJobSnapshot;

declare const publicType: PublicTypes;
void namespaces;
void values;
void publicType;
