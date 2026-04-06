/**
 * Tests for the Identity module.
 *
 * Uses msw + real HttpClient + real FileUploader to intercept native fetch calls.
 * Covers Identity.verify() — happy path, batch presign count:2 (IDV-02), field
 * forwarding (documentFileKey, faceFileKey, documentType), unknown field stripping
 * (D-06), verified:false case, and Zod validation errors.
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './setup.js';
import { resolveConfig, TypedEmitter, HttpClient, FileUploader, ValidationError, AuthenticationError, DeepIDVError } from '@deepidv/core';
import type { SDKEventMap } from '@deepidv/core';
import { Identity } from '../identity.js';

const BASE_URL = 'https://api.deepidv.com';

/**
 * Creates a fresh Identity instance backed by a real HttpClient and real FileUploader.
 * Retries disabled so tests are fast and deterministic.
 */
function createIdentity() {
  const config = resolveConfig({
    apiKey: 'sk_test_key_1234',
    baseUrl: BASE_URL,
    timeout: 5_000,
    maxRetries: 0,
  });
  const emitter = new TypedEmitter<SDKEventMap>();
  const client = new HttpClient(config, emitter);
  const uploader = new FileUploader(config, client, emitter);
  return new Identity(client, uploader);
}

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

/** Minimal valid JPEG header bytes for document image upload. */
const JPEG_BYTES = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, ...new Array(100).fill(0)]);
/** Minimal valid JPEG bytes for face image upload. */
const JPEG_BYTES_2 = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1, ...new Array(100).fill(0)]);

// ---------------------------------------------------------------------------
// MSW handler helpers
// ---------------------------------------------------------------------------

/**
 * Batch presign for identity.verify() — asserts count === 2 (IDV-02 / D-02)
 * and returns two upload slots with file keys for document and face.
 */
function mockPresignBatch() {
  return http.post(`${BASE_URL}/v1/uploads/presign`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    // Verify batch presign receives count: 2 (IDV-02 / D-02)
    expect(body['count']).toBe(2);
    return HttpResponse.json({
      uploads: [
        { uploadUrl: 'https://s3.example.com/presigned-1', fileKey: 'fk_doc_001' },
        { uploadUrl: 'https://s3.example.com/presigned-2', fileKey: 'fk_face_001' },
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

/** Full IdentityVerificationResult response — the API happy-path shape. */
const MOCK_IDENTITY_RESULT = {
  verified: true,
  document: {
    documentType: 'passport',
    fullName: 'John Doe',
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: '1990-01-15',
    gender: 'male',
    nationality: 'US',
    documentNumber: 'AB1234567',
    expirationDate: '2030-06-01',
    issuingCountry: 'US',
    confidence: 0.97,
  },
  faceDetection: { faceDetected: true, confidence: 0.99 },
  faceMatch: { isMatch: true, confidence: 0.95, threshold: 0.8 },
  overallConfidence: 0.94,
};

/** POST /v1/identity/verify handler returning the standard mock result with optional overrides. */
function mockIdentityVerify(overrides?: Record<string, unknown>) {
  return http.post(`${BASE_URL}/v1/identity/verify`, () => {
    return HttpResponse.json({ ...MOCK_IDENTITY_RESULT, ...overrides });
  });
}

// ---------------------------------------------------------------------------
// Identity.verify — IDV-01, IDV-02, IDV-03
// ---------------------------------------------------------------------------

describe('Identity', () => {
  describe('verify()', () => {
    it('returns typed IdentityVerificationResult on success', async () => {
      server.use(
        mockPresignBatch(),
        ...mockS3Puts(),
        mockIdentityVerify(),
      );

      const identity = createIdentity();
      const result = await identity.verify({ documentImage: JPEG_BYTES, faceImage: JPEG_BYTES_2 });

      expect(result.verified).toBe(true);
      expect(result.document.fullName).toBe('John Doe');
      expect(result.faceDetection.faceDetected).toBe(true);
      expect(result.faceMatch.isMatch).toBe(true);
      expect(result.overallConfidence).toBe(0.94);
    });

    it('sends batch presign with count: 2', async () => {
      // mockPresignBatch() asserts count === 2 inline — test passes if assertion does not throw
      server.use(
        mockPresignBatch(),
        ...mockS3Puts(),
        mockIdentityVerify(),
      );

      const identity = createIdentity();
      await identity.verify({ documentImage: JPEG_BYTES, faceImage: JPEG_BYTES_2 });
    });

    it('forwards documentFileKey, faceFileKey, and documentType to API', async () => {
      let capturedBody: unknown = null;

      server.use(
        mockPresignBatch(),
        ...mockS3Puts(),
        http.post(`${BASE_URL}/v1/identity/verify`, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json(MOCK_IDENTITY_RESULT);
        }),
      );

      const identity = createIdentity();
      await identity.verify({ documentImage: JPEG_BYTES, faceImage: JPEG_BYTES_2, documentType: 'passport' });

      const body = capturedBody as Record<string, unknown>;
      expect(body['documentFileKey']).toBe('fk_doc_001');
      expect(body['faceFileKey']).toBe('fk_face_001');
      expect(body['documentType']).toBe('passport');
    });

    it('strips unknown fields from API response (D-06)', async () => {
      server.use(
        mockPresignBatch(),
        ...mockS3Puts(),
        http.post(`${BASE_URL}/v1/identity/verify`, () => {
          return HttpResponse.json({
            ...MOCK_IDENTITY_RESULT,
            unknownField: 'foo',
            document: { ...MOCK_IDENTITY_RESULT.document, extraField: 'bar' },
          });
        }),
      );

      const identity = createIdentity();
      const result = await identity.verify({ documentImage: JPEG_BYTES, faceImage: JPEG_BYTES_2 });

      expect(result).not.toHaveProperty('unknownField');
      expect(result.document).not.toHaveProperty('extraField');
      expect(result.document.fullName).toBe('John Doe');
    });

    it('returns verified: false when API indicates no match', async () => {
      server.use(
        mockPresignBatch(),
        ...mockS3Puts(),
        mockIdentityVerify({
          verified: false,
          faceMatch: { isMatch: false, confidence: 0.3, threshold: 0.8 },
          overallConfidence: 0.4,
        }),
      );

      const identity = createIdentity();
      const result = await identity.verify({ documentImage: JPEG_BYTES, faceImage: JPEG_BYTES_2 });

      expect(result.verified).toBe(false);
      expect(result.faceMatch.isMatch).toBe(false);
    });

    it('throws ValidationError when documentImage is missing', async () => {
      const identity = createIdentity();
      await expect(
        identity.verify({ faceImage: JPEG_BYTES } as never),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when faceImage is missing', async () => {
      const identity = createIdentity();
      await expect(
        identity.verify({ documentImage: JPEG_BYTES } as never),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when input is empty object', async () => {
      const identity = createIdentity();
      await expect(
        identity.verify({} as never),
      ).rejects.toThrow(ValidationError);
    });

    it('accepts optional documentType parameter', async () => {
      server.use(
        mockPresignBatch(),
        ...mockS3Puts(),
        mockIdentityVerify(),
      );

      const identity = createIdentity();
      const result = await identity.verify({
        documentImage: JPEG_BYTES,
        faceImage: JPEG_BYTES_2,
        documentType: 'drivers_license',
      });

      // Optional param accepted — result.verified is a boolean (no error thrown)
      expect(typeof result.verified).toBe('boolean');
    });

    it('returns AuthenticationError on 401 from presign', async () => {
      server.use(
        http.post(`${BASE_URL}/v1/uploads/presign`, () =>
          HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        ),
      );
      const identity = createIdentity();
      await expect(
        identity.verify({ documentImage: JPEG_BYTES, faceImage: JPEG_BYTES_2 }),
      ).rejects.toThrow(AuthenticationError);
    });

    it('returns DeepIDVError on 500 from verify endpoint', async () => {
      server.use(
        mockPresignBatch(),
        ...mockS3Puts(),
        http.post(`${BASE_URL}/v1/identity/verify`, () =>
          HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 }),
        ),
      );
      const identity = createIdentity();
      await expect(
        identity.verify({ documentImage: JPEG_BYTES, faceImage: JPEG_BYTES_2 }),
      ).rejects.toThrow(DeepIDVError);
    });
  });
});
