/**
 * Error class hierarchy for the deepidv SDK.
 *
 * All SDK errors extend DeepIDVError, which extends the native Error class with
 * proper prototype chain restoration for `instanceof` checks across CommonJS
 * module boundaries.
 *
 * @module errors
 */

/**
 * Raw HTTP response captured on errors for debugging (D-06).
 */
export interface RawResponse {
  /** HTTP status code. */
  status: number;
  /** Response headers as a plain object. */
  headers: Record<string, string>;
  /** Parsed response body. */
  body: unknown;
}

/**
 * Options shared by all DeepIDVError subclasses.
 */
interface DeepIDVErrorOptions {
  /** HTTP status code, if applicable. */
  status?: number;
  /** Machine-readable error code. */
  code?: string;
  /** Raw HTTP response for debugging (D-06). */
  response?: RawResponse;
  /** Original error cause for chaining (D-07). */
  cause?: unknown;
}

/**
 * Base error class for all deepidv SDK errors.
 *
 * Implements `toJSON()` for structured logging (D-08):
 * `JSON.stringify(error)` produces `{ type, message, status, code }`.
 *
 * Preserves `Error.cause` chain (D-07) and carries the raw HTTP response
 * on `.response` for debugging (D-06).
 */
export class DeepIDVError extends Error {
  /** HTTP status code, if applicable. */
  readonly status: number | undefined;
  /** Machine-readable error code. */
  readonly code: string | undefined;
  /** Raw HTTP response for debugging (D-06). */
  readonly response: RawResponse | undefined;

  constructor(message: string, options?: DeepIDVErrorOptions) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'DeepIDVError';
    this.status = options?.status;
    this.code = options?.code;
    this.response = options?.response;
    // Restore prototype chain for instanceof checks across CJS/ESM boundaries
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Returns a plain object representation for structured logging (D-08).
   * Safe to `JSON.stringify`.
   */
  toJSON(): Record<string, unknown> {
    return {
      type: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
    };
  }
}

/**
 * Redacts an API key to show only the last 4 characters (D-05).
 * Returns `'****'` for keys with 4 or fewer characters.
 *
 * @param key - The full API key to redact.
 * @returns Redacted key string.
 */
function redactApiKey(key: string): string {
  if (key.length <= 4) return '****';
  return `sk_...${key.slice(-4)}`;
}

/**
 * Thrown when authentication fails (HTTP 401).
 *
 * Redacts the API key in `toJSON()` output (D-05) — the full key is never
 * serialized. Use `.redactedKey` to see the sanitized key reference.
 */
export class AuthenticationError extends DeepIDVError {
  /** Redacted API key (last 4 chars only) for safe logging (D-05). */
  readonly redactedKey: string;

  constructor(
    message: string,
    apiKey: string,
    options?: Pick<DeepIDVErrorOptions, 'response' | 'cause'>,
  ) {
    super(message, { status: 401, code: 'authentication_error', ...options });
    this.name = 'AuthenticationError';
    this.redactedKey = redactApiKey(apiKey);
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Returns structured representation with redacted key (D-05).
   * The full API key is never included.
   */
  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      type: 'AuthenticationError',
      redactedKey: this.redactedKey,
    };
  }
}

/**
 * Options for RateLimitError constructor.
 */
interface RateLimitErrorOptions {
  /** Value of the `Retry-After` response header, in seconds. */
  retryAfter?: number;
  /** Raw HTTP response for debugging (D-06). */
  response?: RawResponse;
  /** Original error cause for chaining (D-07). */
  cause?: unknown;
}

/**
 * Thrown when the API responds with HTTP 429 (Too Many Requests).
 *
 * Stores the `Retry-After` header value on `.retryAfter` so callers
 * and retry logic can honor the server-specified delay (D-02).
 */
export class RateLimitError extends DeepIDVError {
  /**
   * Number of seconds to wait before retrying, parsed from the
   * `Retry-After` response header.
   */
  readonly retryAfter: number | undefined;

  constructor(message: string, options?: RateLimitErrorOptions) {
    super(message, { status: 429, code: 'rate_limit_error', ...options });
    this.name = 'RateLimitError';
    this.retryAfter = options?.retryAfter;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the API responds with HTTP 400 (Bad Request).
 * Indicates a problem with the request data sent by the caller.
 */
export class ValidationError extends DeepIDVError {
  constructor(
    message: string,
    options?: Pick<DeepIDVErrorOptions, 'response' | 'cause'>,
  ) {
    super(message, { status: 400, code: 'validation_error', ...options });
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a network-level failure occurs (e.g., DNS resolution failure,
 * connection refused, socket hang-up).
 */
export class NetworkError extends DeepIDVError {
  constructor(
    message: string,
    options?: Pick<DeepIDVErrorOptions, 'response' | 'cause'>,
  ) {
    super(message, { code: 'network_error', ...options });
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a request exceeds the configured per-attempt timeout (D-01).
 */
export class TimeoutError extends DeepIDVError {
  constructor(
    message: string,
    options?: Pick<DeepIDVErrorOptions, 'response' | 'cause'>,
  ) {
    super(message, { code: 'timeout_error', ...options });
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
