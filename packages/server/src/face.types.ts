/**
 * Zod schemas and inferred TypeScript types for the face module.
 *
 * All TypeScript types are derived exclusively from Zod schemas via
 * `z.infer<typeof Schema>` (D-04). No separate `interface` declarations.
 *
 * @module face.types
 */

import { z } from 'zod';
import type { FileInput } from '@deepidv/core';

// ---------------------------------------------------------------------------
// Shared FileInput custom validator (reused across all input schemas)
// ---------------------------------------------------------------------------

const fileInputValidator = z.custom<FileInput>(
  (val) => {
    return val instanceof Uint8Array || val instanceof ReadableStream || typeof val === 'string';
  },
  { message: 'expected Buffer, Uint8Array, ReadableStream, or string' },
);

// ---------------------------------------------------------------------------
// face.detect() schemas (FACE-01)
// ---------------------------------------------------------------------------

/**
 * Input schema for `face.detect()`. Requires a single image.
 */
export const FaceDetectInputSchema = z.object({
  /** Image to detect a face in. Accepts Uint8Array, ReadableStream, base64 string, or file path. */
  image: fileInputValidator,
});

/** Bounding box coordinates for a detected face region. */
const BoundingBoxSchema = z.object({
  top: z.number(),
  left: z.number(),
  width: z.number(),
  height: z.number(),
});

/** Single facial landmark with type and coordinates. */
const LandmarkSchema = z.object({
  type: z.string(),
  x: z.number(),
  y: z.number(),
});

/**
 * Response schema for `face.detect()`. Unknown API fields are stripped.
 */
export const FaceDetectResultSchema = z
  .object({
    /** Whether a face was detected in the image. */
    faceDetected: z.boolean(),
    /** Detection confidence score (0-1). */
    confidence: z.number(),
    /** Bounding box of the detected face. Present only when `faceDetected` is true. */
    boundingBox: BoundingBoxSchema.optional(),
    /** Facial landmark positions. Present only when `faceDetected` is true. */
    landmarks: z.array(LandmarkSchema).optional(),
  })
  .strip();

// ---------------------------------------------------------------------------
// face.compare() schemas (FACE-02)
// ---------------------------------------------------------------------------

/**
 * Input schema for `face.compare()`. Requires two images (source and target).
 */
export const FaceCompareInputSchema = z.object({
  /** Source image (e.g. ID document face). Accepts Uint8Array, ReadableStream, base64 string, or file path. */
  source: fileInputValidator,
  /** Target image (e.g. selfie). Accepts Uint8Array, ReadableStream, base64 string, or file path. */
  target: fileInputValidator,
});

/**
 * Response schema for `face.compare()`. Unknown API fields are stripped.
 */
export const FaceCompareResultSchema = z
  .object({
    /** Whether the two faces are considered a match. */
    isMatch: z.boolean(),
    /** Match confidence score (0-1). */
    confidence: z.number(),
    /** Confidence threshold used to determine `isMatch`. */
    threshold: z.number(),
    /** Whether a face was detected in the source image. */
    sourceFaceDetected: z.boolean(),
    /** Whether a face was detected in the target image. */
    targetFaceDetected: z.boolean(),
  })
  .strip();

// ---------------------------------------------------------------------------
// face.estimateAge() schemas (FACE-03)
// ---------------------------------------------------------------------------

/**
 * Predicted gender values from face analysis.
 */
export const GenderSchema = z.enum(['male', 'female']);

/**
 * Input schema for `face.estimateAge()`. Requires a single image.
 */
export const FaceEstimateAgeInputSchema = z.object({
  /** Image containing a face to analyze. Accepts Uint8Array, ReadableStream, base64 string, or file path. */
  image: fileInputValidator,
});

/**
 * Response schema for `face.estimateAge()`. Unknown API fields are stripped.
 *
 * Age, range, and gender fields are optional because the API only returns them
 * when a face was detected — `{ faceDetected: false }` is the no-face response.
 */
export const FaceEstimateAgeResultSchema = z
  .object({
    /** Whether a face was detected in the image. */
    faceDetected: z.boolean(),
    /** Estimated age of the face in years. Present only when `faceDetected` is true. */
    estimatedAge: z.number().optional(),
    /** Age range containing the estimated age. Present only when `faceDetected` is true. */
    ageRange: z
      .object({
        low: z.number(),
        high: z.number(),
      })
      .optional(),
    /** Predicted gender. Present only when `faceDetected` is true. */
    gender: GenderSchema.optional(),
    /** Gender prediction confidence score (0-1). Present only when `faceDetected` is true. */
    genderConfidence: z.number().optional(),
  })
  .strip();

// ---------------------------------------------------------------------------
// Exported inferred types (z.infer only — no separate interface declarations)
// ---------------------------------------------------------------------------

/** Input for `face.detect()`. */
export type FaceDetectInput = z.infer<typeof FaceDetectInputSchema>;

/** Response from `face.detect()`. */
export type FaceDetectResult = z.infer<typeof FaceDetectResultSchema>;

/** Input for `face.compare()`. */
export type FaceCompareInput = z.infer<typeof FaceCompareInputSchema>;

/** Response from `face.compare()`. */
export type FaceCompareResult = z.infer<typeof FaceCompareResultSchema>;

/** Input for `face.estimateAge()`. */
export type FaceEstimateAgeInput = z.infer<typeof FaceEstimateAgeInputSchema>;

/** Response from `face.estimateAge()`. */
export type FaceEstimateAgeResult = z.infer<typeof FaceEstimateAgeResultSchema>;

/** Predicted gender value. */
export type Gender = z.infer<typeof GenderSchema>;
