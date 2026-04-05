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
