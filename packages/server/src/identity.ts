/**
 * Identity verification service module.
 *
 * Provides the SDK's only compound synchronous service: `identity.verify()`
 * uploads a document image and a face image in parallel, then calls
 * `POST /v1/identity/verify` with both file keys. Server-side orchestration
 * handles document scan, face detection, and face comparison internally —
 * the SDK stays thin and returns a single unified result.
 *
 * All inputs are validated with Zod before any network calls. File uploads
 * are handled transparently via `FileUploader`. HTTP orchestration (auth,
 * retry, error mapping) is delegated to `HttpClient`.
 *
 * @module identity
 */

import { z } from 'zod';
import type { HttpClient, FileUploader } from '@deepidv/core';
import { mapZodError } from '@deepidv/core';
import {
  IdentityVerifyInputSchema,
  IdentityVerificationResultSchema,
  type IdentityVerifyInput,
  type IdentityVerificationResult,
} from './identity.types.js';

// ---------------------------------------------------------------------------
// Identity class
// ---------------------------------------------------------------------------

/**
 * Provides orchestrated identity verification combining document scan,
 * face detection, and face comparison in a single API call.
 *
 * Instantiated by the main SDK client and receives `HttpClient` and
 * `FileUploader` via constructor injection (D-04). Both images are uploaded
 * in parallel via batch presign before a single POST to the API (D-01, D-02).
 *
 * @example
 * ```typescript
 * const client = new DeepIDVClient({ apiKey: 'your-key' });
 *
 * const result = await client.identity.verify({
 *   documentImage: passportBuffer,
 *   faceImage: selfieBuffer,
 *   documentType: 'passport',
 * });
 *
 * if (result.verified) {
 *   console.log('Identity verified:', result.document.fullName);
 *   console.log('Overall confidence:', result.overallConfidence);
 * }
 * ```
 */
export class Identity {
  constructor(
    private readonly client: HttpClient,
    private readonly uploader: FileUploader,
  ) {}

  /**
   * Verify an identity by combining document OCR, face detection, and face matching.
   *
   * Uploads both the document image and face image in parallel via a batch presign
   * request (count: 2) with parallel S3 PUTs (IDV-02, D-02). A single POST to
   * `/v1/identity/verify` returns a unified result — server-side orchestration
   * handles scan + detect + compare internally (IDV-01, D-01).
   *
   * If the API returns 200 with `verified: false`, the result is parsed as-is.
   * All sub-result fields (`document`, `faceDetection`, `faceMatch`) are always
   * populated on a 2xx response (D-04, D-05).
   *
   * @param input - Verification parameters including document image, face image, and optional document type hint.
   * @returns Unified identity verification result with overall pass/fail, document OCR data, face detection, face match, and aggregate confidence.
   * @throws {ValidationError} If input fails schema validation before any network call.
   * @throws {AuthenticationError} If the API key is invalid (401).
   * @throws {RateLimitError} If the rate limit is exceeded (429).
   * @throws {DeepIDVError} For other API errors (e.g., 400 document unreadable, 500 server error).
   * @throws {NetworkError} If the upload or API call fails at the network level.
   * @throws {TimeoutError} If the upload or API call exceeds the configured timeout.
   */
  async verify(input: z.input<typeof IdentityVerifyInputSchema>): Promise<IdentityVerificationResult> {
    // Step 1: Zod-validate input (maps ZodError to ValidationError per D-12)
    let validated: z.infer<typeof IdentityVerifyInputSchema>;
    try {
      validated = IdentityVerifyInputSchema.parse(input);
    } catch (err) {
      if (err instanceof z.ZodError) throw mapZodError(err);
      throw err;
    }

    // Step 2: Batch upload both images in parallel (IDV-02, D-02 — batch presign count:2)
    const fileKeys = await this.uploader.upload([validated.documentImage, validated.faceImage]);

    // Step 3: POST to single API endpoint (IDV-01, D-01 — server handles scan+detect+compare)
    const raw = await this.client.post<unknown>('/v1/identity/verify', {
      documentFileKey: fileKeys[0],
      faceFileKey: fileKeys[1],
      documentType: validated.documentType,
    });

    // Step 4: Parse and strip response (D-06 — validate and strip unknown fields)
    return IdentityVerificationResultSchema.parse(raw);
  }
}

// Re-export types for consumers who import from this module path
export type { IdentityVerifyInput, IdentityVerificationResult };
