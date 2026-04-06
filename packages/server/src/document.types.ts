/**
 * Zod schemas and inferred TypeScript types for the document module.
 *
 * All TypeScript types are derived exclusively from Zod schemas via
 * `z.infer<typeof Schema>` (D-04). No separate `interface` declarations.
 *
 * @module document.types
 */

import { z } from 'zod';
import type { FileInput } from '@deepidv/core';

// ---------------------------------------------------------------------------
// Enum schemas
// ---------------------------------------------------------------------------

/**
 * Supported document type hints for `document.scan()`.
 * Use `'auto'` (default) to let the API detect the document type.
 */
export const DocumentTypeSchema = z.enum([
  'passport',
  'drivers_license',
  'national_id',
  'auto',
]);

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

/**
 * Input schema for `document.scan()`.
 *
 * The `image` field accepts any supported file input. The `documentType`
 * field defaults to `'auto'` for server-side detection (DOC-03).
 */
export const DocumentScanInputSchema = z.object({
  /**
   * Document image file input.
   * Accepts Buffer, Uint8Array, ReadableStream, base64 string, or file path.
   */
  image: z.custom<FileInput>(
    (val) => {
      return (
        val instanceof Uint8Array ||
        (typeof ReadableStream !== 'undefined' && val instanceof ReadableStream) ||
        typeof val === 'string'
      );
    },
    { message: "expected Buffer, Uint8Array, ReadableStream, or string at 'image'" },
  ),
  /** Document type hint. Defaults to `'auto'` for server-side detection. */
  documentType: DocumentTypeSchema.default('auto'),
});

// ---------------------------------------------------------------------------
// Output schemas (DOC-02 — uses .strip() per D-06)
// ---------------------------------------------------------------------------

/**
 * Response schema for `document.scan()`.
 *
 * Unknown API fields are stripped (`D-06`) to keep the result shape stable
 * for SDK consumers while remaining forward-compatible when the API adds fields.
 */
export const DocumentScanResultSchema = z
  .object({
    /** Detected or specified document type (e.g., `'passport'`). */
    documentType: z.string(),
    /** Full name as extracted from the document. */
    fullName: z.string(),
    /** First name as extracted from the document. */
    firstName: z.string(),
    /** Last name as extracted from the document. */
    lastName: z.string(),
    /** Date of birth in ISO 8601 format (`YYYY-MM-DD`). */
    dateOfBirth: z.string(),
    /** Gender as recorded on the document. */
    gender: z.string(),
    /** Nationality as recorded on the document. */
    nationality: z.string(),
    /** Document number (passport number, license number, etc.). */
    documentNumber: z.string(),
    /** Expiration date in ISO 8601 format (`YYYY-MM-DD`). */
    expirationDate: z.string(),
    /** Country that issued the document (ISO 3166-1 alpha-2). */
    issuingCountry: z.string(),
    /** Address as extracted from the document, if present. */
    address: z.string().optional(),
    /** Raw MRZ string extracted from the document, if present. */
    mrzData: z.string().optional(),
    /** Base64-encoded face image extracted from the document, if present. */
    faceImage: z.string().optional(),
    /** All extracted key-value pairs from the document (raw OCR output). */
    rawFields: z.record(z.string(), z.string()),
    /** Overall OCR confidence score (0–1). */
    confidence: z.number(),
  })
  .strip();

// ---------------------------------------------------------------------------
// Exported inferred types (z.infer only — no separate interface declarations)
// ---------------------------------------------------------------------------

/** Valid document type hint values for `document.scan()`. */
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

/** Input for `document.scan()`. */
export type DocumentScanInput = z.infer<typeof DocumentScanInputSchema>;

/** Structured OCR result returned by `document.scan()`. */
export type DocumentScanResult = z.infer<typeof DocumentScanResultSchema>;
