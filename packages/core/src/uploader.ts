/**
 * File input types, Zod schemas, utility functions, and FileUploader class
 * for the presigned upload handler.
 *
 * Provides:
 * - `FileInput` — normalized input type accepted on all upload APIs
 * - `SupportedContentType` — MIME type literals for JPEG, PNG, WebP
 * - `UploadOptions` — validated options accepted by upload methods
 * - `PresignResponse` — shape of the presign API response
 * - `toUint8Array` — normalizes any FileInput to Uint8Array
 * - `detectContentType` — magic-byte content-type detection
 * - `mapZodError` — maps ZodError to ValidationError with path info
 * - `validateUploadOptions` — validates raw upload options input
 * - `FileUploader` — orchestrates presign + S3 PUT flow for all service modules
 *
 * @module uploader
 */

import { z } from 'zod';
import { DeepIDVError, NetworkError, TimeoutError, ValidationError } from './errors.js';
import { withRetry } from './retry.js';
import type { ResolvedConfig } from './config.js';
import type { HttpClient } from './client.js';
import type { TypedEmitter, SDKEventMap } from './events.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Accepted input types for file upload methods (D-02).
 *
 * - `Uint8Array` — raw bytes (Node Buffers pass `instanceof Uint8Array`)
 * - `ReadableStream<Uint8Array>` — streaming input materialized before upload
 * - `string` — data URL (`data:...;base64,...`), raw base64, or file path
 *
 * No `Buffer` in the union — avoids importing Node-specific type on edge runtimes.
 */
export type FileInput = Uint8Array | ReadableStream<Uint8Array> | string;

/**
 * MIME types supported for identity verification uploads.
 */
export type SupportedContentType = 'image/jpeg' | 'image/png' | 'image/webp';

// ---------------------------------------------------------------------------
// Zod schemas (D-10, D-11)
// ---------------------------------------------------------------------------

const UploadOptionsSchema = z.object({
  /** Optional caller-supplied content type override. Skips auto-detection when provided. */
  contentType: z.string().optional(),
});

/**
 * Options accepted by upload methods. All fields are optional.
 * Schema is the single source of truth (D-11, VAL-03).
 */
export type UploadOptions = z.infer<typeof UploadOptionsSchema>;

// ---------------------------------------------------------------------------
// Public response type
// ---------------------------------------------------------------------------

/**
 * Response from `POST /v1/uploads/presign`. Contains presigned S3 URLs
 * and the file keys to reference after upload.
 */
export interface PresignResponse {
  uploads: Array<{ uploadUrl: string; fileKey: string }>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Decodes a base64 string to a Uint8Array using the global `atob`.
 * No Node-specific APIs — works on all runtimes (D-02).
 *
 * @param b64 - A valid base64-encoded string (no data URL prefix).
 * @returns Decoded bytes.
 */
function base64ToUint8Array(b64: string): Uint8Array {
  const binary = globalThis.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Materializes a ReadableStream into a single Uint8Array by reading all chunks.
 * Releases the reader lock in a finally block to avoid locking the stream.
 *
 * @param stream - Readable stream of Uint8Array chunks.
 * @returns Concatenated bytes from all chunks.
 */
async function materializeStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  // Concatenate all chunks into a single Uint8Array
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/**
 * Reads a file from the filesystem using the platform-native API (D-04).
 * Throws ValidationError immediately on edge runtimes where fs is unavailable.
 *
 * @param path - Absolute or relative file path.
 * @returns File contents as Uint8Array.
 * @throws {ValidationError} On edge runtimes without fs access.
 */
async function readFilePath(path: string): Promise<Uint8Array> {
  // Access runtime globals through globalThis to avoid requiring @types/node, @types/bun,
  // or Deno type definitions in the runtime-agnostic core package.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as Record<string, any>;
  const isNode =
    typeof g['process'] !== 'undefined' &&
    g['process']?.versions?.node !== undefined;
  const isDeno = typeof g['Deno'] !== 'undefined';
  const isBun = typeof g['Bun'] !== 'undefined';

  if (!isNode && !isDeno && !isBun) {
    throw new ValidationError(
      'File path input requires Node.js, Deno, or Bun. Pass Buffer or Uint8Array on edge runtimes.',
    );
  }

  // Dynamic import keeps fs out of edge runtime bundles.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fs = (await import('node:fs/promises' as string)) as any;
  const buffer = (await fs.readFile(path)) as Uint8Array;
  return new Uint8Array(
    (buffer as unknown as { buffer: ArrayBuffer; byteOffset: number; byteLength: number }).buffer,
    (buffer as unknown as { buffer: ArrayBuffer; byteOffset: number; byteLength: number }).byteOffset,
    (buffer as unknown as { buffer: ArrayBuffer; byteOffset: number; byteLength: number }).byteLength,
  );
}

// ---------------------------------------------------------------------------
// Public utility functions
// ---------------------------------------------------------------------------

/**
 * Normalizes any supported input type to a `Uint8Array` (D-01, D-03).
 *
 * - `Uint8Array` passes through unchanged
 * - `ReadableStream` is fully materialized (UPL-06)
 * - `string` starting with `data:` is treated as a data URL → base64-decoded
 * - `string` matching base64 pattern with length > 256 → raw base64-decoded
 * - Any other `string` → treated as a file system path
 *
 * @param input - File input to normalize.
 * @returns Resolved Uint8Array bytes.
 * @throws {ValidationError} If file path is used on an edge runtime.
 */
export async function toUint8Array(input: FileInput): Promise<Uint8Array> {
  if (input instanceof Uint8Array) {
    return input;
  }

  if (input instanceof ReadableStream) {
    return materializeStream(input);
  }

  // string branch
  if (input.startsWith('data:')) {
    // data URL: strip the "data:<mime>;base64," prefix
    const b64 = input.replace(/^data:[^,]+,/, '');
    return base64ToUint8Array(b64);
  }

  // Raw base64: must match base64 character set and be > 256 chars
  if (input.length > 256 && /^[A-Za-z0-9+/]+=*$/.test(input)) {
    return base64ToUint8Array(input);
  }

  // Treat as file path
  return readFilePath(input);
}

/**
 * Detects the MIME type of image bytes from magic bytes (D-05).
 *
 * Supported formats:
 * - JPEG: `FF D8 FF`
 * - PNG: `89 50 4E 47`
 * - WebP: `52 49 46 46 ... 57 45 42 50` (RIFF....WEBP)
 *
 * @param bytes - Image bytes to inspect (minimum 4 bytes required).
 * @returns Detected MIME type.
 * @throws {ValidationError} If bytes are too short or format is unsupported.
 */
export function detectContentType(bytes: Uint8Array): SupportedContentType {
  if (bytes.length < 4) {
    throw new ValidationError(
      'File is too small to detect content type (minimum 4 bytes).',
    );
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }

  // WebP: RIFF....WEBP (bytes 0-3 = RIFF, bytes 8-11 = WEBP)
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  throw new ValidationError(
    'Unsupported image format. Accepted formats: JPEG, PNG, WebP.',
  );
}

/**
 * Maps a `ZodError` to a `ValidationError` with path information (D-12, VAL-02).
 *
 * Extracts the first issue from the ZodError. The message format is:
 * `"{issue.message} at '{path}'"` where path is `issue.path.join('.')` or
 * `'(root)'` if the path is empty. The raw ZodError is attached as `cause`.
 *
 * @param err - ZodError from a failed schema parse.
 * @returns Equivalent ValidationError with path context.
 */
export function mapZodError(err: z.ZodError): ValidationError {
  const issue = err.issues[0];
  if (issue === undefined) {
    return new ValidationError('Validation failed', { cause: err });
  }
  const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
  const message = `${issue.message} at '${path}'`;
  return new ValidationError(message, { cause: err });
}

/**
 * Validates raw upload options input against the UploadOptionsSchema.
 * Maps ZodError to ValidationError on failure (D-12).
 *
 * @param raw - Unknown input to validate.
 * @returns Validated UploadOptions.
 * @throws {ValidationError} If input fails schema validation.
 */
export function validateUploadOptions(raw: unknown): UploadOptions {
  try {
    return UploadOptionsSchema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) throw mapZodError(err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// FileUploader class
// ---------------------------------------------------------------------------

/**
 * Orchestrates the presigned upload flow for all service modules.
 *
 * Flow:
 * 1. Normalize all inputs to `Uint8Array` (stream materialization happens here,
 *    before the retry loop — no double-read bug, UPL-06).
 * 2. Detect or accept caller-provided content type (D-06).
 * 3. Call `POST /v1/uploads/presign` once for all files.
 * 4. PUT each file to its S3 presigned URL in parallel (UPL-04).
 * 5. Return `fileKey` strings in the same order as the inputs.
 *
 * S3 PUTs use raw `config.fetch` (not `HttpClient`) — no `x-api-key` header
 * is sent to S3 (UPL-07). Each PUT uses `config.uploadTimeout` (120s default),
 * not the API request timeout (30s) (UPL-05).
 */
export class FileUploader {
  /**
   * Creates a FileUploader instance.
   *
   * @param config - Resolved configuration with `uploadTimeout` and `fetch`.
   * @param httpClient - HTTP client for calling the deepidv API (presign endpoint).
   * @param emitter - Typed event emitter for `upload:start` / `upload:complete` events.
   */
  constructor(
    private readonly config: ResolvedConfig,
    private readonly httpClient: HttpClient,
    private readonly emitter: TypedEmitter<SDKEventMap>,
  ) {}

  /**
   * Uploads one or more files to S3 via the presigned upload flow.
   *
   * Accepts any `FileInput` (Uint8Array, ReadableStream, base64 string, file path).
   * Batch uploads issue a single presign request and upload in parallel.
   *
   * @param inputs - Single file input or array of file inputs.
   * @param options - Optional upload options (e.g. `contentType` override).
   * @returns Array of `fileKey` strings in the same order as the inputs.
   * @throws {ValidationError} If inputs fail validation.
   * @throws {DeepIDVError} If the presign API call fails.
   * @throws {DeepIDVError} With code `"upload_url_expired"` if S3 returns 403.
   * @throws {TimeoutError} If an S3 PUT times out.
   * @throws {NetworkError} If an S3 PUT fails at the network level.
   */
  async upload(
    inputs: FileInput | FileInput[],
    options?: UploadOptions,
  ): Promise<string[]> {
    const opts = validateUploadOptions(options ?? {});
    const inputArray = Array.isArray(inputs) ? inputs : [inputs];

    // 1. Normalize all inputs to Uint8Array (materialization happens here, before retry loop — UPL-06)
    const byteArrays = await Promise.all(inputArray.map(toUint8Array));

    // 2. Detect or use caller-provided content type
    const contentTypes = byteArrays.map((bytes) =>
      opts.contentType ?? detectContentType(bytes),
    );

    // 3. Request presigned URLs (one API call for all files)
    const presignResponse = await this.httpClient.post<PresignResponse>(
      '/v1/uploads/presign',
      { contentType: contentTypes[0], count: inputArray.length },
    );

    // 4. PUT each file to S3 in parallel (UPL-04)
    await Promise.all(
      presignResponse.uploads.map((upload, i) =>
        this._putToS3(upload.uploadUrl, byteArrays[i]!, contentTypes[i]!),
      ),
    );

    // 5. Return fileKeys in same order as inputs
    return presignResponse.uploads.map((u) => u.fileKey);
  }

  /**
   * Wraps a single S3 PUT in retry logic.
   *
   * Bytes are already a `Uint8Array` at this point — stream materialization
   * happened in `upload()` before this is called (UPL-06).
   *
   * @internal
   */
  private async _putToS3(url: string, bytes: Uint8Array, contentType: string): Promise<void> {
    await withRetry(
      () => this._attemptPut(url, bytes, contentType),
      { maxRetries: this.config.maxRetries, initialDelayMs: this.config.initialRetryDelay },
      this.emitter,
    );
  }

  /**
   * Performs a single S3 PUT attempt.
   *
   * Uses raw `config.fetch` (not `HttpClient`) — no `x-api-key` header is sent
   * to S3 (UPL-07). Uses `config.uploadTimeout` (not `config.timeout`) (UPL-05).
   *
   * - HTTP 403 → throws `DeepIDVError` with code `"upload_url_expired"` immediately (D-08)
   * - HTTP 5xx → throws `DeepIDVError` with `status >= 500` so `isRetryable` returns `true`
   * - Network errors → wraps in `NetworkError` (retryable)
   * - Abort (timeout) → wraps in `TimeoutError` (retryable, but upload timeout is long)
   *
   * @internal
   */
  private async _attemptPut(url: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const controller = new AbortController();
    const timeoutMs = this.config.uploadTimeout;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    this.emitter.emit('upload:start', { url, bytes: bytes.length, contentType });

    try {
      let response: Response;
      try {
        response = await this.config.fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          // Cast to ArrayBuffer for TypeScript 6 DTS compatibility (Uint8Array<ArrayBufferLike>
          // is not directly assignable to BodyInit in strict mode — ArrayBuffer is safe)
          body: bytes.buffer as ArrayBuffer,
          signal: controller.signal,
        });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          throw new TimeoutError(`Upload timed out after ${timeoutMs}ms`, { cause: err });
        }
        throw new NetworkError(
          err instanceof Error ? err.message : 'S3 upload network error',
          { cause: err },
        );
      }

      if (response.ok) {
        this.emitter.emit('upload:complete', { url, contentType });
        return;
      }

      // 403: expired presigned URL — throw immediately, never retry (D-08)
      if (response.status === 403) {
        throw new DeepIDVError('Presigned URL has expired or is invalid.', {
          status: 403,
          code: 'upload_url_expired',
        });
      }

      // 5xx: wrap as DeepIDVError with status so isRetryable returns true
      if (response.status >= 500) {
        throw new DeepIDVError(`S3 upload failed: HTTP ${response.status}`, {
          status: response.status,
          code: 'upload_error',
        });
      }

      // Other 4xx: throw immediately (non-retryable)
      throw new DeepIDVError(`S3 upload failed: HTTP ${response.status}`, {
        status: response.status,
        code: 'upload_error',
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
