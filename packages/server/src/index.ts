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
