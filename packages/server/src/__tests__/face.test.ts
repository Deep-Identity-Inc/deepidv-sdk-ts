/**
 * Tests for the Face module.
 *
 * Uses msw + real HttpClient + real FileUploader to intercept native fetch calls.
 * Covers Face.detect(), Face.compare(), and Face.estimateAge() — happy paths,
 * batch presign for compare(), field key forwarding, unknown field stripping,
 * and Zod validation errors.
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './setup.js';
import { resolveConfig, TypedEmitter, HttpClient, FileUploader, ValidationError, AuthenticationError, DeepIDVError } from '@deepidv/core';
import type { SDKEventMap } from '@deepidv/core';
import { Face } from '../face.js';

const BASE_URL = 'https://api.deepidv.com';

/**
 * Creates a fresh Face instance backed by a real HttpClient and real FileUploader.
 * Retries disabled so tests are fast and deterministic.
 */
function createFace() {
  const config = resolveConfig({
    apiKey: 'sk_test_key_1234',
    baseUrl: BASE_URL,
    timeout: 5_000,
    maxRetries: 0,
  });
  const emitter = new TypedEmitter<SDKEventMap>();
  const client = new HttpClient(config, emitter);
  const uploader = new FileUploader(config, client, emitter);
  return new Face(client, uploader);
}

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

/** Minimal valid JPEG header bytes for test uploads (source image). */
const JPEG_BYTES = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, ...new Array(100).fill(0)]);
/** Minimal valid JPEG bytes for second image (target in compare). */
const JPEG_BYTES_2 = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1, ...new Array(100).fill(0)]);

// ---------------------------------------------------------------------------
// MSW handler helpers
// ---------------------------------------------------------------------------

/** Single-file presign — returns one upload slot. */
function mockPresignSingle() {
  return http.post(`${BASE_URL}/v1/uploads/presign`, () => {
    return HttpResponse.json({
      uploads: [{ uploadUrl: 'https://s3.example.com/presigned-1', fileKey: 'fk_face_001' }],
    });
  });
}

/**
 * Batch presign for face.compare() — asserts count === 2 (FACE-02 / D-02)
 * and returns two upload slots.
 */
function mockPresignBatch() {
  return http.post(`${BASE_URL}/v1/uploads/presign`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    // Verify batch presign receives count: 2 (FACE-02 / D-02)
    expect(body['count']).toBe(2);
    return HttpResponse.json({
      uploads: [
        { uploadUrl: 'https://s3.example.com/presigned-1', fileKey: 'fk_source_001' },
        { uploadUrl: 'https://s3.example.com/presigned-2', fileKey: 'fk_target_001' },
      ],
    });
  });
}

/** S3 PUT handlers for both upload slots. */
function mockS3Puts() {
  return [
    http.put('https://s3.example.com/presigned-1', () => new HttpResponse(null, { status: 200 })),
    http.put('https://s3.example.com/presigned-2', () => new HttpResponse(null, { status: 200 })),
  ];
}

// ---------------------------------------------------------------------------
// Face.detect — FACE-01
// ---------------------------------------------------------------------------

describe('Face.detect', () => {
  it('returns FaceDetectResult on successful detection', async () => {
    server.use(
      mockPresignSingle(),
      http.put('https://s3.example.com/presigned-1', () => new HttpResponse(null, { status: 200 })),
      http.post(`${BASE_URL}/v1/face/detect`, () => {
        return HttpResponse.json({
          faceDetected: true,
          confidence: 0.98,
          boundingBox: { top: 10, left: 20, width: 100, height: 120 },
          landmarks: [{ type: 'leftEye', x: 45, y: 50 }],
        });
      }),
    );

    const face = createFace();
    const result = await face.detect({ image: JPEG_BYTES });

    expect(result.faceDetected).toBe(true);
    expect(result.confidence).toBe(0.98);
    expect(result.boundingBox?.width).toBe(100);
    expect(result.landmarks?.[0]?.type).toBe('leftEye');
  });

  it('handles response without optional fields', async () => {
    server.use(
      mockPresignSingle(),
      http.put('https://s3.example.com/presigned-1', () => new HttpResponse(null, { status: 200 })),
      http.post(`${BASE_URL}/v1/face/detect`, () => {
        return HttpResponse.json({ faceDetected: false, confidence: 0.1 });
      }),
    );

    const face = createFace();
    const result = await face.detect({ image: JPEG_BYTES });

    expect(result.faceDetected).toBe(false);
    expect(result.boundingBox).toBeUndefined();
    expect(result.landmarks).toBeUndefined();
  });

  it('throws ValidationError for missing image', async () => {
    // No msw handlers — proves validation fires before any network call
    const face = createFace();
    await expect(face.detect({} as never)).rejects.toThrow(ValidationError);
  });

  it('returns AuthenticationError on 401 from presign', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/uploads/presign`, () =>
        HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      ),
    );
    const face = createFace();
    await expect(face.detect({ image: JPEG_BYTES })).rejects.toThrow(AuthenticationError);
  });
});

// ---------------------------------------------------------------------------
// Face.compare — FACE-02
// ---------------------------------------------------------------------------

describe('Face.compare', () => {
  it('uploads two images via batch presign and returns FaceCompareResult', async () => {
    server.use(
      mockPresignBatch(),
      ...mockS3Puts(),
      http.post(`${BASE_URL}/v1/face/compare`, () => {
        return HttpResponse.json({
          isMatch: true,
          confidence: 0.95,
          threshold: 0.8,
          sourceFaceDetected: true,
          targetFaceDetected: true,
        });
      }),
    );

    const face = createFace();
    const result = await face.compare({ source: JPEG_BYTES, target: JPEG_BYTES_2 });

    expect(result.isMatch).toBe(true);
    expect(result.confidence).toBe(0.95);
  });

  it('sends sourceFileKey and targetFileKey to compare endpoint', async () => {
    let capturedBody: unknown = null;

    server.use(
      mockPresignBatch(),
      ...mockS3Puts(),
      http.post(`${BASE_URL}/v1/face/compare`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          isMatch: true,
          confidence: 0.95,
          threshold: 0.8,
          sourceFaceDetected: true,
          targetFaceDetected: true,
        });
      }),
    );

    const face = createFace();
    await face.compare({ source: JPEG_BYTES, target: JPEG_BYTES_2 });

    expect((capturedBody as Record<string, unknown>)['sourceFileKey']).toBe('fk_source_001');
    expect((capturedBody as Record<string, unknown>)['targetFileKey']).toBe('fk_target_001');
  });

  it('throws ValidationError for missing target image', async () => {
    const face = createFace();
    await expect(
      face.compare({ source: JPEG_BYTES } as never),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when source image is missing', async () => {
    const face = createFace();
    await expect(
      face.compare({ target: JPEG_BYTES_2 } as never),
    ).rejects.toThrow(ValidationError);
  });
});

// ---------------------------------------------------------------------------
// Face.estimateAge — FACE-03
// ---------------------------------------------------------------------------

describe('Face.estimateAge', () => {
  it('returns FaceEstimateAgeResult on success', async () => {
    server.use(
      mockPresignSingle(),
      http.put('https://s3.example.com/presigned-1', () => new HttpResponse(null, { status: 200 })),
      http.post(`${BASE_URL}/v1/face/estimate-age`, () => {
        return HttpResponse.json({
          estimatedAge: 32,
          ageRange: { low: 28, high: 36 },
          gender: 'female',
          genderConfidence: 0.92,
          faceDetected: true,
        });
      }),
    );

    const face = createFace();
    const result = await face.estimateAge({ image: JPEG_BYTES });

    expect(result.estimatedAge).toBe(32);
    expect(result.ageRange.low).toBe(28);
    expect(result.gender).toBe('female');
  });

  it('throws ValidationError for missing image', async () => {
    const face = createFace();
    await expect(face.estimateAge({} as never)).rejects.toThrow(ValidationError);
  });

  it('returns DeepIDVError on 500 from estimateAge endpoint', async () => {
    server.use(
      mockPresignSingle(),
      http.put('https://s3.example.com/presigned-1', () => new HttpResponse(null, { status: 200 })),
      http.post(`${BASE_URL}/v1/face/estimate-age`, () =>
        HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 }),
      ),
    );
    const face = createFace();
    await expect(face.estimateAge({ image: JPEG_BYTES })).rejects.toThrow(DeepIDVError);
  });

  it('strips unknown fields from response (D-06)', async () => {
    server.use(
      mockPresignSingle(),
      http.put('https://s3.example.com/presigned-1', () => new HttpResponse(null, { status: 200 })),
      http.post(`${BASE_URL}/v1/face/estimate-age`, () => {
        return HttpResponse.json({
          estimatedAge: 25,
          ageRange: { low: 21, high: 29 },
          gender: 'male',
          genderConfidence: 0.88,
          faceDetected: true,
          extraField: true,
        });
      }),
    );

    const face = createFace();
    const result = await face.estimateAge({ image: JPEG_BYTES });

    expect(result).not.toHaveProperty('extraField');
    expect(result.estimatedAge).toBe(25);
  });
});
