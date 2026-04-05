/**
 * HttpClient — core HTTP client for the deepidv SDK.
 *
 * Composes auth header injection, per-attempt timeout via AbortController,
 * retry logic with exponential backoff, and typed lifecycle events.
 *
 * This is the single point of contact with the deepidv API. All SDK modules
 * use HttpClient internally — auth, retry, and timeout behavior is inherited
 * automatically.
 *
 * @module client
 */

import type { ResolvedConfig } from './config.js';
import { buildHeaders, buildUrl } from './auth.js';
import { withRetry } from './retry.js';
import { TypedEmitter } from './events.js';
import type { SDKEventMap } from './events.js';
import {
  DeepIDVError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  NetworkError,
  TimeoutError,
  type RawResponse,
} from './errors.js';

/**
 * Options for a single HTTP request.
 */
export interface RequestOptions {
  /** Request body to serialize as JSON. */
  body?: unknown;
  /**
   * Per-request timeout override in milliseconds.
   * Falls back to `ResolvedConfig.timeout` when not provided.
   */
  timeout?: number;
}

/**
 * Core HTTP client that sends authenticated requests to the deepidv API.
 *
 * Features:
 * - x-api-key injected on every request (AUTH requirement)
 * - Per-attempt timeout via a fresh `AbortController` (D-01)
 * - Retry with exponential backoff + jitter for 429/5xx (HTTP-04)
 * - Typed lifecycle events via `TypedEmitter` (D-09)
 * - Maps HTTP error codes to typed SDK error classes
 * - Custom `fetch` support for testing and edge runtimes (D-13)
 */
export class HttpClient {
  private readonly config: ResolvedConfig;
  private readonly emitter: TypedEmitter<SDKEventMap>;

  /**
   * Creates an HttpClient instance.
   *
   * @param config - Resolved configuration with all defaults applied.
   * @param emitter - Typed event emitter for lifecycle events.
   */
  constructor(config: ResolvedConfig, emitter: TypedEmitter<SDKEventMap>) {
    this.config = config;
    this.emitter = emitter;
  }

  /**
   * Sends an HTTP request to the deepidv API.
   *
   * Wraps a single-attempt fetch inside `withRetry()`. Each attempt:
   * 1. Builds the full URL via `buildUrl()`
   * 2. Creates a fresh `AbortController` for per-attempt timeout (D-01)
   * 3. Emits the `request` lifecycle event
   * 4. Calls the configured `fetch` implementation
   * 5. On success: parses JSON, emits `response` event
   * 6. On HTTP error: maps status code to typed SDK error class
   * 7. On network/abort error: wraps in `NetworkError` or `TimeoutError`
   *
   * On final failure (all retries exhausted), emits the `error` event.
   *
   * @param method - HTTP method (e.g. `'GET'`, `'POST'`).
   * @param path - API path relative to `config.baseUrl` (e.g. `'/v1/sessions'`).
   * @param options - Optional request body and timeout override.
   * @returns Parsed JSON response body typed as `T`.
   * @throws {AuthenticationError} On 401 responses.
   * @throws {RateLimitError} On 429 responses.
   * @throws {ValidationError} On 400 responses.
   * @throws {DeepIDVError} On other 4xx/5xx responses.
   * @throws {TimeoutError} When the per-attempt timeout fires.
   * @throws {NetworkError} On network-level failures.
   */
  async request<T>(method: string, path: string, options?: RequestOptions): Promise<T> {
    const url = buildUrl(this.config.baseUrl, path);
    const timeoutMs = options?.timeout ?? this.config.timeout;

    let result: T;
    try {
      result = await withRetry(
        () => this._attempt<T>(method, url, options?.body, timeoutMs),
        {
          maxRetries: this.config.maxRetries,
          initialDelayMs: this.config.initialRetryDelay,
        },
        this.emitter,
      );
    } catch (err) {
      this.emitter.emit('error', { error: err });
      throw err;
    }

    return result;
  }

  /**
   * Performs a single fetch attempt (no retry logic).
   *
   * Creates a fresh `AbortController`, sets the timeout, fires the `request`
   * event, calls fetch, then maps the response or error to SDK types.
   *
   * @internal
   */
  private async _attempt<T>(
    method: string,
    url: string,
    body: unknown,
    timeoutMs: number,
  ): Promise<T> {
    // New AbortController per attempt — never reuse (D-01, HTTP-03)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    this.emitter.emit('request', { method, url });

    const startMs = Date.now();

    try {
      let response: Response;
      try {
        response = await this.config.fetch(url, {
          method,
          headers: buildHeaders(this.config.apiKey, body),
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
      } catch (err) {
        // AbortError means our timeout fired (D-01)
        if (err instanceof Error && err.name === 'AbortError') {
          throw new TimeoutError(
            `Request timed out after ${timeoutMs}ms`,
            { cause: err },
          );
        }
        // All other fetch-level errors are network failures
        throw new NetworkError(
          err instanceof Error ? err.message : 'Network request failed',
          { cause: err },
        );
      }

      if (response.ok) {
        const durationMs = Date.now() - startMs;
        const parsed = (await response.json()) as T;
        this.emitter.emit('response', { status: response.status, url, durationMs });
        return parsed;
      }

      // Build raw response for error context (D-06)
      const rawBody: unknown = await response.json().catch(() => null);
      const rawResponse: RawResponse = {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: rawBody,
      };

      const errorMessage = extractErrorMessage(rawBody, response.status);

      switch (response.status) {
        case 401:
          throw new AuthenticationError(errorMessage, this.config.apiKey, {
            response: rawResponse,
          });

        case 429: {
          const retryAfter = extractRetryAfterSeconds(rawResponse.headers);
          throw new RateLimitError(errorMessage, {
            retryAfter,
            response: rawResponse,
          });
        }

        case 400:
          throw new ValidationError(errorMessage, { response: rawResponse });

        default:
          throw new DeepIDVError(errorMessage, {
            status: response.status,
            code: 'api_error',
            response: rawResponse,
          });
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Sends a GET request.
   *
   * @param path - API path.
   * @param options - Optional timeout override.
   */
  get<T>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  /**
   * Sends a POST request with a JSON body.
   *
   * @param path - API path.
   * @param body - Request body to serialize as JSON.
   * @param options - Optional timeout override.
   */
  post<T>(path: string, body: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return this.request<T>('POST', path, { ...options, body });
  }

  /**
   * Sends a PUT request with a JSON body.
   *
   * @param path - API path.
   * @param body - Request body to serialize as JSON.
   * @param options - Optional timeout override.
   */
  put<T>(path: string, body: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return this.request<T>('PUT', path, { ...options, body });
  }

  /**
   * Sends a PATCH request with a JSON body.
   *
   * @param path - API path.
   * @param body - Request body to serialize as JSON.
   * @param options - Optional timeout override.
   */
  patch<T>(path: string, body: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return this.request<T>('PATCH', path, { ...options, body });
  }

  /**
   * Sends a DELETE request.
   *
   * @param path - API path.
   * @param options - Optional timeout override.
   */
  delete<T>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Extracts a human-readable error message from an API error response body.
 *
 * Supports `{ message: "..." }`, `{ error: "..." }`, or falls back to
 * `"HTTP {status}"`.
 *
 * @param body - Parsed response body (may be null).
 * @param status - HTTP status code.
 * @returns Error message string.
 */
function extractErrorMessage(body: unknown, status: number): string {
  if (body !== null && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (typeof b['message'] === 'string') return b['message'];
    if (typeof b['error'] === 'string') return b['error'];
  }
  return `HTTP ${status}`;
}

/**
 * Parses the `retry-after` header from response headers, returning seconds.
 *
 * @param headers - Headers as a plain string-to-string record.
 * @returns Number of seconds or `undefined` if not present/parseable.
 */
function extractRetryAfterSeconds(
  headers: Record<string, string>,
): number | undefined {
  const raw = headers['retry-after'];
  if (!raw) return undefined;

  const numeric = parseInt(raw, 10);
  if (!isNaN(numeric)) return numeric;

  const dateMs = Date.parse(raw);
  if (!isNaN(dateMs)) {
    const seconds = Math.ceil((dateMs - Date.now()) / 1_000);
    return seconds > 0 ? seconds : 0;
  }

  return undefined;
}
