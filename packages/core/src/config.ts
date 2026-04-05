/**
 * Configuration types and defaults for the deepidv SDK.
 *
 * @module config
 */

/** Default API base URL for deepidv. */
export const DEFAULT_BASE_URL = 'https://api.deepidv.com';

/**
 * Default per-attempt timeout in milliseconds.
 * Each individual request gets this full timeout window (D-01).
 */
export const DEFAULT_TIMEOUT = 30_000;

/** Default maximum number of retry attempts (D-03). */
export const DEFAULT_MAX_RETRIES = 3;

/** Default initial retry delay in milliseconds (D-03). */
export const DEFAULT_INITIAL_DELAY = 500;

/**
 * User-provided configuration for creating a DeepIDV client.
 */
export interface DeepIDVConfig {
  /** API key used for authentication (x-api-key header). */
  apiKey: string;
  /** Override the base API URL. Defaults to https://api.deepidv.com. */
  baseUrl?: string;
  /** Per-attempt request timeout in milliseconds. Defaults to 30_000 (30s). */
  timeout?: number;
  /** Maximum number of retry attempts for 429 and 5xx responses. Defaults to 3. */
  maxRetries?: number;
  /** Initial delay before first retry in milliseconds (D-03). Defaults to 500ms. */
  initialRetryDelay?: number;
  /**
   * Custom fetch implementation. Useful for testing, Cloudflare Workers service
   * bindings, and proxy setups (D-13).
   */
  fetch?: typeof globalThis.fetch;
}

/**
 * Resolved configuration with all defaults applied. Every field is required.
 */
export interface ResolvedConfig {
  /** API key used for authentication. */
  apiKey: string;
  /** Base API URL with no trailing slash. */
  baseUrl: string;
  /** Per-attempt timeout in milliseconds. */
  timeout: number;
  /** Maximum number of retry attempts. */
  maxRetries: number;
  /** Initial retry delay in milliseconds. */
  initialRetryDelay: number;
  /** Fetch implementation to use for HTTP requests. */
  fetch: typeof globalThis.fetch;
}

/**
 * Resolves user configuration by applying defaults for missing fields.
 *
 * @param config - Partial user configuration.
 * @returns Fully resolved configuration.
 */
export function resolveConfig(config: DeepIDVConfig): ResolvedConfig {
  return {
    apiKey: config.apiKey,
    baseUrl: (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, ''),
    timeout: config.timeout ?? DEFAULT_TIMEOUT,
    maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
    initialRetryDelay: config.initialRetryDelay ?? DEFAULT_INITIAL_DELAY,
    fetch: config.fetch ?? globalThis.fetch,
  };
}
