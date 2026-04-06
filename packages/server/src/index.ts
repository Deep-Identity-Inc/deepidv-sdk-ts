// @deepidv/server — public SDK package
// Phase 1: re-exports from core. Service modules added in Phases 3-6.

export {
  type DeepIDVConfig,
  type RawResponse,
  DeepIDVError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  NetworkError,
  TimeoutError,
  type SDKEventMap,
} from '@deepidv/core';

// Sessions module — Phase 3
export { Sessions } from './sessions.js';
export type {
  SessionCreateInput,
  SessionCreateResult,
  Session,
  SessionRetrieveResult,
  SessionListParams,
  SessionStatusUpdate,
  PaginatedResponse,
} from './sessions.types.js';

// Sessions Zod schemas — exported for consumer-side custom validation
export {
  SessionCreateInputSchema,
  SessionListParamsSchema,
  SessionStatusUpdateSchema,
  SessionStatusSchema,
} from './sessions.types.js';

// Document module — Phase 4
export { Document } from './document.js';
export type {
  DocumentScanInput,
  DocumentScanResult,
  DocumentType,
} from './document.types.js';

// Document Zod schemas — exported for consumer-side custom validation
export {
  DocumentScanInputSchema,
  DocumentScanResultSchema,
  DocumentTypeSchema,
} from './document.types.js';

// Face module — Phase 4
export { Face } from './face.js';
export type {
  FaceDetectInput,
  FaceDetectResult,
  FaceCompareInput,
  FaceCompareResult,
  FaceEstimateAgeInput,
  FaceEstimateAgeResult,
  Gender,
} from './face.types.js';

// Face Zod schemas — exported for consumer-side custom validation
export {
  FaceDetectInputSchema,
  FaceDetectResultSchema,
  FaceCompareInputSchema,
  FaceCompareResultSchema,
  FaceEstimateAgeInputSchema,
  FaceEstimateAgeResultSchema,
  GenderSchema,
} from './face.types.js';
