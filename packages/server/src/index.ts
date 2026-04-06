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
  RateLimitError,
  ValidationError,
  NetworkError,
  TimeoutError,
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
  Session,
  SessionRetrieveResult,
  SessionListParams,
  SessionStatusUpdate,
  PaginatedResponse,
} from './sessions.types.js';
export {
  SessionCreateInputSchema,
  SessionListParamsSchema,
  SessionStatusUpdateSchema,
  SessionStatusSchema,
} from './sessions.types.js';

// ---------------------------------------------------------------------------
// 6. Document types and schemas
// ---------------------------------------------------------------------------
export type {
  DocumentScanInput,
  DocumentScanResult,
  DocumentType,
} from './document.types.js';
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
} from './face.types.js';
export {
  FaceDetectInputSchema,
  FaceDetectResultSchema,
  FaceCompareInputSchema,
  FaceCompareResultSchema,
  FaceEstimateAgeInputSchema,
  FaceEstimateAgeResultSchema,
  GenderSchema,
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

// NOTE: Sessions, Document, Face, Identity classes are NOT exported.
// Consumers access them exclusively through client.sessions, client.document,
// client.face, and client.identity (per D-01, API-05).
