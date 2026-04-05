/**
 * @deepidv/core — Shared internals for the deepidv SDK.
 *
 * HTTP client, auth, config, error types, event emitter.
 * This package is not intended to be installed directly by developers.
 */

export const VERSION = '0.0.0';

export type { DeepIDVConfig, ResolvedConfig } from './config.js';
export {
  DEFAULT_BASE_URL,
  DEFAULT_INITIAL_DELAY,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT,
  DEFAULT_UPLOAD_TIMEOUT,
  resolveConfig,
} from './config.js';

export type { RawResponse } from './errors.js';
export {
  AuthenticationError,
  DeepIDVError,
  NetworkError,
  RateLimitError,
  TimeoutError,
  ValidationError,
} from './errors.js';

export type { SDKEventMap } from './events.js';
export { TypedEmitter } from './events.js';

export { buildHeaders, buildUrl } from './auth.js';

export {
  withRetry,
  isRetryable,
  computeDelay,
  extractRetryAfter,
} from './retry.js';

export type { RequestOptions } from './client.js';
export { HttpClient } from './client.js';

export type {
  FileInput,
  SupportedContentType,
  UploadOptions,
  PresignResponse,
} from './uploader.js';
export {
  FileUploader,
  toUint8Array,
  detectContentType,
  mapZodError,
  validateUploadOptions,
} from './uploader.js';
