/**
 * DeepIDV public entry point class.
 *
 * The single constructor consumers use to initialize the SDK. Config is validated
 * at construction time — invalid configs throw before any network call is made.
 * All module namespaces are eagerly instantiated and available as typed properties.
 *
 * @module deepidv
 */

import { z } from 'zod';
import {
  resolveConfig,
  HttpClient,
  FileUploader,
  TypedEmitter,
  mapZodError,
  type DeepIDVConfig,
  type SDKEventMap,
} from '@deepidv/core';
import { Sessions } from './sessions.js';
import { Document } from './document.js';
import { Face } from './face.js';
import { Identity } from './identity.js';

// ---------------------------------------------------------------------------
// Config schema (exported for consumers per D-02)
// ---------------------------------------------------------------------------

/**
 * Zod schema for DeepIDV client configuration.
 *
 * Validates all user-provided configuration options before the client is
 * constructed. Fails fast — throws `ValidationError` synchronously if any
 * field is invalid (per D-05, API-02).
 */
export const DeepIDVConfigSchema = z.object({
  /** API key used for authentication. Must be a non-empty string. */
  apiKey: z.string().min(1, 'apiKey is required'),
  /** Override the base API URL. Must be a valid URL if provided. */
  baseUrl: z.string().url().optional(),
  /** Per-attempt request timeout in milliseconds. Must be positive if provided. */
  timeout: z.number().positive().optional(),
  /** Maximum number of retry attempts for 429 and 5xx responses. 0 = no retries. */
  maxRetries: z.number().int().nonnegative().optional(),
  /** Initial delay before first retry in milliseconds. Must be positive if provided. */
  initialRetryDelay: z.number().positive().optional(),
  /** Per-attempt timeout for S3 uploads in milliseconds. Must be positive if provided. */
  uploadTimeout: z.number().positive().optional(),
  /** Custom fetch implementation. Useful for testing and Cloudflare Workers bindings. */
  fetch: z.function().optional(),
});

/**
 * Convenience alias for the input type of `DeepIDVConfigSchema`.
 * Equivalent to `DeepIDVConfig` from `@deepidv/core` but derived from the Zod schema.
 */
export type DeepIDVOptions = z.input<typeof DeepIDVConfigSchema>;

// ---------------------------------------------------------------------------
// DeepIDV class
// ---------------------------------------------------------------------------

/**
 * The main client for the deepidv identity verification SDK.
 *
 * Instantiate once per process (or once per request in serverless environments).
 * All four module namespaces are eagerly initialized on construction and share
 * a single HTTP client and event emitter instance.
 *
 * Config validation occurs synchronously in the constructor. An invalid config
 * (missing `apiKey`, invalid URL, etc.) throws a `ValidationError` before any
 * network call is made.
 *
 * @example
 * ```typescript
 * import { DeepIDV } from '@deepidv/server';
 *
 * const client = new DeepIDV({ apiKey: process.env.DEEPIDV_API_KEY! });
 *
 * // Create a verification session
 * const session = await client.sessions.create({
 *   firstName: 'Jane',
 *   lastName: 'Doe',
 *   email: 'jane@example.com',
 *   phone: '+15192223333',
 * });
 *
 * // Scan a document
 * const docResult = await client.document.scan({ image: passportBuffer });
 *
 * // Full identity verification
 * const result = await client.identity.verify({
 *   documentImage: passportBuffer,
 *   faceImage: selfieBuffer,
 * });
 * if (result.verified) {
 *   console.log('Identity verified:', result.document.fullName);
 * }
 * ```
 */
export class DeepIDV {
  /**
   * Session management namespace. Provides CRUD operations for hosted
   * verification sessions (`create`, `retrieve`, `list`, `updateStatus`).
   *
   * @remarks Access via `client.sessions.create(...)`, `client.sessions.retrieve(...)`, etc.
   */
  readonly sessions: Sessions;

  /**
   * Document scanning namespace. Provides OCR extraction from identity documents.
   *
   * @remarks Access via `client.document.scan(...)`.
   */
  readonly document: Document;

  /**
   * Face analysis namespace. Provides face detection, comparison, and age estimation.
   *
   * @remarks Access via `client.face.detect(...)`, `client.face.compare(...)`, `client.face.estimateAge(...)`.
   */
  readonly face: Face;

  /**
   * Identity verification namespace. Provides orchestrated identity verification
   * combining document scan, face detection, and face comparison in one call.
   *
   * @remarks Access via `client.identity.verify(...)`.
   */
  readonly identity: Identity;

  /** Internal emitter — not exposed directly to consumers. */
  private readonly emitter: TypedEmitter<SDKEventMap>;

  /**
   * Create a new DeepIDV client.
   *
   * Validates the provided configuration synchronously. Throws `ValidationError`
   * if `apiKey` is missing or empty, or if any optional field has an invalid value.
   *
   * @param config - Client configuration options. `apiKey` is required.
   * @throws {ValidationError} If the config fails schema validation.
   */
  constructor(config: DeepIDVConfig) {
    // Validate config with Zod — maps ZodError to ValidationError (D-05, API-02)
    try {
      DeepIDVConfigSchema.parse(config);
    } catch (err) {
      if (err instanceof z.ZodError) throw mapZodError(err);
      throw err;
    }

    // Resolve config (applies defaults)
    const resolved = resolveConfig(config);

    // Single emitter, single HTTP client, single uploader (shared across all modules)
    this.emitter = new TypedEmitter<SDKEventMap>();
    const httpClient = new HttpClient(resolved, this.emitter);
    const uploader = new FileUploader(resolved, httpClient, this.emitter);

    // Eagerly instantiate all module namespaces (D-06, D-07)
    this.sessions = new Sessions(httpClient);
    this.document = new Document(httpClient, uploader);
    this.face = new Face(httpClient, uploader);
    this.identity = new Identity(httpClient, uploader);
  }

  /**
   * Subscribe to an SDK lifecycle event.
   *
   * Exposes the internal event emitter for consumer logging, APM integration,
   * and observability tooling — without exposing the emitter instance directly.
   *
   * Available events: `request`, `response`, `retry`, `error`, `warning`,
   * `upload:start`, `upload:complete`.
   *
   * @param event - The event name to subscribe to.
   * @param listener - Callback invoked when the event fires.
   * @returns Unsubscribe function — call it to remove this listener.
   *
   * @example
   * ```typescript
   * const unsub = client.on('request', ({ method, url }) => {
   *   console.log(`${method} ${url}`);
   * });
   *
   * // Later, to stop listening:
   * unsub();
   * ```
   */
  on<K extends keyof SDKEventMap>(
    event: K,
    listener: (payload: SDKEventMap[K]) => void,
  ): () => void {
    return this.emitter.on(event, listener);
  }
}
