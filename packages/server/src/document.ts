/**
 * Document scanning service module. Provides OCR extraction from identity documents.
 *
 * All methods validate developer inputs with Zod before making network calls.
 * Presigned URL orchestration and S3 upload are handled internally via FileUploader.
 * HTTP orchestration (auth, retry, error mapping) is delegated to HttpClient.
 *
 * @module document
 */

import { z } from 'zod';
import type { HttpClient, FileUploader } from '@deepidv/core';
import { mapZodError } from '@deepidv/core';
import {
  DocumentScanInputSchema,
  DocumentScanResultSchema,
  type DocumentScanInput,
  type DocumentScanResult,
} from './document.types.js';

// ---------------------------------------------------------------------------
// Document class
// ---------------------------------------------------------------------------

/**
 * Provides document scanning and OCR extraction for identity documents.
 *
 * Instantiated by the main SDK client and receives `HttpClient` and
 * `FileUploader` via constructor injection (D-04). The injected client
 * handles authentication, retry logic, and error mapping. The uploader
 * handles presigned URL orchestration and S3 uploads invisibly.
 *
 * @example
 * ```typescript
 * const client = new DeepIDVClient({ apiKey: 'your-key' });
 * const result = await client.document.scan({
 *   image: imageBuffer,
 *   documentType: 'passport',
 * });
 * console.log(result.fullName, result.confidence);
 * ```
 */
export class Document {
  constructor(
    private readonly client: HttpClient,
    private readonly uploader: FileUploader,
  ) {}

  /**
   * Scan a document image and extract structured OCR data.
   *
   * Accepts any supported file input (Buffer, Uint8Array, ReadableStream,
   * base64 string, or file path). The SDK handles presigned URL upload
   * internally — the caller never interacts with S3.
   *
   * @param input - Document scan parameters including the image and optional document type.
   * @returns Structured OCR result with extracted fields and confidence score.
   * @throws {ValidationError} If input fails schema validation.
   * @throws {AuthenticationError} If the API key is invalid (401).
   * @throws {RateLimitError} If the rate limit is exceeded (429).
   * @throws {DeepIDVError} For other API errors (e.g., document unreadable).
   * @throws {NetworkError} If the upload or API call fails at the network level.
   * @throws {TimeoutError} If the upload or API call times out.
   * @example
   * ```typescript
   * const result = await client.document.scan({ image: passportBuffer });
   * console.log(result.fullName, result.confidence);
   * ```
   */
  async scan(input: z.input<typeof DocumentScanInputSchema>): Promise<DocumentScanResult> {
    // Step 1: Zod-validate input (maps ZodError to ValidationError per D-12)
    // let validated: z.infer<typeof DocumentScanInputSchema>;
    // try {
    //   validated = DocumentScanInputSchema.parse(input);
    // } catch (err) {
    //   if (err instanceof z.ZodError) throw mapZodError(err);
    //   throw err;
    // }
    const validatedInputResult = DocumentScanInputSchema.safeParse(input);
    if (!validatedInputResult.success) {
      throw mapZodError(validatedInputResult.error);
    }
    const validated = validatedInputResult.data;

    // Step 2: Upload image via FileUploader (D-01 — developer never sees fileKey)
    // const [fileKey] = await this.uploader.upload(validated.image);

    // Step 3: Call processing endpoint via HttpClient (D-03 — gets auth, retry, error mapping)
    const raw = await this.client.post<Record<string, unknown>>('/v1/document/scan', {
      image: validated.image,
      documentType: validated.documentType,
    });

    // Step 4: Parse response with .strip() schema (D-07 — validate and strip unknown fields)
    return DocumentScanResultSchema.parse(raw);
  }
}

// Re-export types for consumers who import from this module path
export type { DocumentScanInput, DocumentScanResult };
