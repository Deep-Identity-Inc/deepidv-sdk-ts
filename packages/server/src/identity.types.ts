/**
 * Zod schemas and inferred TypeScript types for the identity module.
 *
 * All TypeScript types are derived exclusively from Zod schemas via
 * `z.infer<typeof Schema>` (D-04). No separate `interface` declarations.
 * Schemas are independent of Phase 4 types (D-03) — the `/v1/identity/verify`
 * response uses nested shapes that differ from standalone service endpoints.
 *
 * @module identity.types
 */

import { z } from 'zod';
import type { FileInput } from '@deepidv/core';

// ---------------------------------------------------------------------------
// Shared FileInput custom validator
// ---------------------------------------------------------------------------

const fileInputValidator = z.custom<FileInput>(
  (val) => {
    return val instanceof Uint8Array || val instanceof ReadableStream || typeof val === 'string';
  },
  { message: 'expected Buffer, Uint8Array, ReadableStream, or string' },
);

// ---------------------------------------------------------------------------
// Document type enum
// ---------------------------------------------------------------------------

/**
 * Supported document type hints for `identity.verify()`.
 * Use `'auto'` to let the API detect the document type automatically.
 */
export const DocumentTypeSchema = z.enum([
  'passport',
  'drivers_license',
  'national_id',
  'auto',
]);

// ---------------------------------------------------------------------------
// identity.verify() input schema (IDV-01, IDV-02)
// ---------------------------------------------------------------------------

/**
 * Input schema for `identity.verify()`.
 *
 * Accepts a document image and a face image (selfie or live photo).
 * Both images are uploaded in parallel via batch presign (IDV-02, D-02).
 */
export const IdentityVerifyInputSchema = z.object({
  /** ID document image. Accepts Uint8Array, ReadableStream, base64 string, or file path. */
  documentImage: fileInputValidator,
  /** Selfie or live photo for face matching. Accepts Uint8Array, ReadableStream, base64 string, or file path. */
  faceImage: fileInputValidator,
  /** Optional document type hint. Defaults to server-side auto-detection. */
  documentType: DocumentTypeSchema.optional(),
});

// ---------------------------------------------------------------------------
// Nested result schemas (D-03: independent — NOT reusing Phase 4 types)
// ---------------------------------------------------------------------------

/**
 * Document OCR sub-result within `IdentityVerificationResult`.
 *
 * Independent schema (D-03) — the `/v1/identity/verify` response returns a
 * simplified document shape compared to the standalone `document.scan()` endpoint.
 * Unknown API fields are stripped for forward compatibility (D-06).
 */
export const IdentityDocumentResultSchema = z
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
    /** Base64-encoded face image extracted from the document, if present. */
    faceImage: z.string().optional(),
    /** Overall OCR confidence score (0–1). */
    confidence: z.number(),
  })
  .strip();

/**
 * Face detection sub-result within `IdentityVerificationResult`.
 *
 * Independent schema (D-03) — simplified shape compared to standalone
 * `face.detect()` endpoint (no bounding box or landmarks in the identity response).
 * Unknown API fields are stripped for forward compatibility (D-06).
 */
export const IdentityFaceDetectionResultSchema = z
  .object({
    /** Whether a face was detected in the provided face image. */
    faceDetected: z.boolean(),
    /** Face detection confidence score (0–1). */
    confidence: z.number(),
  })
  .strip();

/**
 * Face match sub-result within `IdentityVerificationResult`.
 *
 * Independent schema (D-03) — represents the ID-face-vs-selfie comparison
 * result embedded in the unified identity verification response.
 * Unknown API fields are stripped for forward compatibility (D-06).
 */
export const IdentityFaceMatchResultSchema = z
  .object({
    /** Whether the document face and the provided face image are considered a match. */
    isMatch: z.boolean(),
    /** Match confidence score (0–1). */
    confidence: z.number(),
    /** Confidence threshold used to determine `isMatch`. */
    threshold: z.number(),
  })
  .strip();

// ---------------------------------------------------------------------------
// identity.verify() result schema (IDV-03)
// ---------------------------------------------------------------------------

/**
 * Response schema for `identity.verify()` (IDV-03).
 *
 * All sub-result fields (`document`, `faceDetection`, `faceMatch`) are required —
 * the API always returns the full shape on 2xx responses (D-04).
 * Unknown API fields are stripped for forward compatibility (D-06).
 */
export const IdentityVerificationResultSchema = z
  .object({
    /** Overall pass/fail flag. `true` if document OCR, face detection, and face match all passed. */
    verified: z.boolean(),
    /** Structured OCR data extracted from the document image. */
    document: IdentityDocumentResultSchema,
    /** Face detection result from the provided face image. */
    faceDetection: IdentityFaceDetectionResultSchema,
    /** Face match result comparing the document face against the provided face image. */
    faceMatch: IdentityFaceMatchResultSchema,
    /** Weighted aggregate confidence score across all sub-results (0–1). */
    overallConfidence: z.number(),
  })
  .strip();

// ---------------------------------------------------------------------------
// Exported inferred types (z.infer only — no separate interface declarations)
// ---------------------------------------------------------------------------

/** Input for `identity.verify()`. */
export type IdentityVerifyInput = z.infer<typeof IdentityVerifyInputSchema>;

/** Unified identity verification result returned by `identity.verify()`. */
export type IdentityVerificationResult = z.infer<typeof IdentityVerificationResultSchema>;

/** Document OCR sub-result within `IdentityVerificationResult`. */
export type IdentityDocumentResult = z.infer<typeof IdentityDocumentResultSchema>;

/** Face detection sub-result within `IdentityVerificationResult`. */
export type IdentityFaceDetectionResult = z.infer<typeof IdentityFaceDetectionResultSchema>;

/** Face match sub-result within `IdentityVerificationResult`. */
export type IdentityFaceMatchResult = z.infer<typeof IdentityFaceMatchResultSchema>;
