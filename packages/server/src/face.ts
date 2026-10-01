/**
 * Face analysis service module. Provides face detection, comparison, and age estimation.
 *
 * All methods validate developer inputs with Zod before making network calls.
 * File uploads are orchestrated transparently via FileUploader — callers pass
 * image data and receive typed results without ever seeing presigned URLs.
 *
 * @module face
 */

import { z } from 'zod';
import type { HttpClient, FileUploader } from '@deepidv/core';
import { mapZodError } from '@deepidv/core';
import {
  FaceDetectInputSchema,
  FaceDetectResultSchema,
  FaceCompareInputSchema,
  FaceCompareResultSchema,
  FaceEstimateAgeInputSchema,
  FaceEstimateAgeResultSchema,
  FaceLivenessSessionInputSchema,
  FaceLivenessSessionWireResultSchema,
  FaceLivenessResultParamsSchema,
  FaceLivenessResultSchema,
  type FaceDetectResult,
  type FaceCompareResult,
  type FaceEstimateAgeResult,
  type FaceLivenessSessionResult,
  type FaceLivenessResult,
} from './face.types.js';

// ---------------------------------------------------------------------------
// Face class
// ---------------------------------------------------------------------------

/**
 * Provides face detection, comparison, and age estimation operations.
 *
 * Instantiated by the main SDK client and receives `HttpClient` and
 * `FileUploader` via constructor injection (D-04). The injected client handles
 * authentication, retry, and error mapping. FileUploader orchestrates the
 * presigned upload flow transparently.
 *
 * @example
 * ```typescript
 * const client = new DeepIDVClient({ apiKey: 'your-key' });
 *
 * // Detect a face
 * const detection = await client.face.detect({ image: imageBuffer });
 *
 * // Compare two faces
 * const comparison = await client.face.compare({ source: idBuffer, target: selfieBuffer });
 *
 * // Estimate age from a face
 * const ageResult = await client.face.estimateAge({ image: selfieBuffer });
 * ```
 */
export class Face {
  constructor(
    private readonly client: HttpClient,
    private readonly uploader: FileUploader,
  ) {}

  /**
   * Detect a face in an image. Returns confidence, bounding box, and landmarks.
   *
   * Uploads the image via the presigned URL flow, then calls the face detection
   * endpoint. The caller never interacts with presigned URLs directly.
   *
   * @param input - Detection parameters including the image buffer to analyze.
   * @returns Detection result with face presence flag, confidence, bounding box, and landmarks.
   * @throws {ValidationError} If input fails schema validation.
   * @throws {AuthenticationError} If the API key is invalid (401).
   * @throws {RateLimitError} If the rate limit is exceeded (429).
   * @throws {DeepIDVError} For other API errors.
   * @throws {NetworkError} If the network request fails.
   * @throws {TimeoutError} If the request exceeds the configured timeout.
   * @example
   * ```typescript
   * const result = await client.face.detect({ image: selfieBuffer });
   * console.log(result.faceDetected, result.confidence);
   * ```
   */
  async detect(input: z.input<typeof FaceDetectInputSchema>): Promise<FaceDetectResult> {
    let validated: z.infer<typeof FaceDetectInputSchema>;
    try {
      validated = FaceDetectInputSchema.parse(input);
    } catch (err) {
      if (err instanceof z.ZodError) throw mapZodError(err);
      throw err;
    }

    const [fileKey] = await this.uploader.upload(validated.image);
    const raw = await this.client.post<unknown>('/v1/face/detect', { image: fileKey });
    return FaceDetectResultSchema.parse(raw);
  }

  /**
   * Compare two face images. Uploads both in parallel and returns match confidence.
   *
   * Source and target images are uploaded simultaneously via a batch presign
   * request with two file entries and parallel S3 PUTs (D-02, UPL-04). The caller passes
   * both images; orchestration is handled transparently.
   *
   * @param input - Comparison parameters with source and target image buffers.
   * @returns Comparison result with match flag, confidence, threshold, and per-image detection flags.
   * @throws {ValidationError} If input fails schema validation.
   * @throws {AuthenticationError} If the API key is invalid (401).
   * @throws {RateLimitError} If the rate limit is exceeded (429).
   * @throws {DeepIDVError} For other API errors.
   * @throws {NetworkError} If the network request fails.
   * @throws {TimeoutError} If the request exceeds the configured timeout.
   * @example
   * ```typescript
   * const result = await client.face.compare({ source: idPhoto, target: selfie });
   * console.log(result.isMatch, result.confidence);
   * ```
   */
  async compare(input: z.input<typeof FaceCompareInputSchema>): Promise<FaceCompareResult> {
    let validated: z.infer<typeof FaceCompareInputSchema>;
    try {
      validated = FaceCompareInputSchema.parse(input);
    } catch (err) {
      if (err instanceof z.ZodError) throw mapZodError(err);
      throw err;
    }

    const fileKeys = await this.uploader.upload([validated.source, validated.target]);
    const raw = await this.client.post<unknown>('/v1/face/compare', {
      source: fileKeys[0],
      target: fileKeys[1],
    });
    return FaceCompareResultSchema.parse(raw);
  }

  /**
   * Estimate the age and gender from a face image.
   *
   * Uploads the image via the presigned URL flow, then calls the age estimation
   * endpoint. Returns estimated age, age range, gender, and face detection status.
   *
   * @param input - Estimation parameters including the image buffer to analyze.
   * @returns Age estimation result with estimated age, age range, gender, and detection flag.
   * @throws {ValidationError} If input fails schema validation.
   * @throws {AuthenticationError} If the API key is invalid (401).
   * @throws {RateLimitError} If the rate limit is exceeded (429).
   * @throws {DeepIDVError} For other API errors.
   * @throws {NetworkError} If the network request fails.
   * @throws {TimeoutError} If the request exceeds the configured timeout.
   * @example
   * ```typescript
   * const result = await client.face.estimateAge({ image: selfieBuffer });
   * console.log(result.estimatedAge, result.gender);
   * ```
   */
  async estimateAge(
    input: z.input<typeof FaceEstimateAgeInputSchema>,
  ): Promise<FaceEstimateAgeResult> {
    let validated: z.infer<typeof FaceEstimateAgeInputSchema>;
    try {
      validated = FaceEstimateAgeInputSchema.parse(input);
    } catch (err) {
      if (err instanceof z.ZodError) throw mapZodError(err);
      throw err;
    }

    const [fileKey] = await this.uploader.upload(validated.image);
    const raw = await this.client.post<unknown>('/v1/face/estimate-age', { image: fileKey });
    return FaceEstimateAgeResultSchema.parse(raw);
  }

  /** Create a face-liveness session and vend short-lived streaming credentials. */
  async createLivenessSession(
    input?: z.input<typeof FaceLivenessSessionInputSchema>,
  ): Promise<FaceLivenessSessionResult> {
    const parsed = FaceLivenessSessionInputSchema.safeParse(input ?? {});
    if (!parsed.success) throw mapZodError(parsed.error);
    const raw = await this.client.post<unknown>(
      '/v1/face/liveness/sessions',
      {
        ...(parsed.data.sessionId !== undefined ? { session_id: parsed.data.sessionId } : {}),
        ...(parsed.data.challengeType !== undefined
          ? { challenge_type: parsed.data.challengeType }
          : {}),
      },
      { maxRetries: 0 },
    );
    return FaceLivenessSessionWireResultSchema.parse(raw);
  }

  /** Fetch the latest normalized result for a face-liveness session. */
  async getLivenessResult(
    livenessSessionId: string,
    params?: z.input<typeof FaceLivenessResultParamsSchema>,
  ): Promise<FaceLivenessResult> {
    const id = z.string().min(1).safeParse(livenessSessionId);
    if (!id.success) throw mapZodError(id.error);
    const parsed = FaceLivenessResultParamsSchema.safeParse(params ?? {});
    if (!parsed.success) throw mapZodError(parsed.error);

    const query = new URLSearchParams();
    if (parsed.data.sessionId !== undefined) query.set('session_id', parsed.data.sessionId);
    if (parsed.data.confidenceThreshold !== undefined) {
      query.set('confidence_threshold', String(parsed.data.confidenceThreshold));
    }
    const queryString = query.size > 0 ? `?${query.toString()}` : '';
    const raw = await this.client.get<unknown>(
      `/v1/face/liveness/sessions/${encodeURIComponent(id.data)}/result${queryString}`,
    );
    return FaceLivenessResultSchema.parse(raw);
  }
}
