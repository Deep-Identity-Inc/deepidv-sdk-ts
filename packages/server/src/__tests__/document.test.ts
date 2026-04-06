/**
 * Tests for the Document module.
 *
 * Uses msw + real HttpClient + real FileUploader to intercept native fetch calls.
 * Covers Document.scan() happy path, documentType default, unknown field stripping,
 * and Zod validation errors.
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './setup.js';
import { resolveConfig, TypedEmitter, HttpClient, FileUploader, ValidationError, AuthenticationError, DeepIDVError } from '@deepidv/core';
import type { SDKEventMap } from '@deepidv/core';
import { Document } from '../document.js';

const BASE_URL = 'https://api.deepidv.com';

/**
 * Creates a fresh Document instance backed by a real HttpClient and real FileUploader.
 * Retries disabled so tests are fast and deterministic.
 */
function createDocument() {
  const config = resolveConfig({
    apiKey: 'sk_test_key_1234',
    baseUrl: BASE_URL,
    timeout: 5_000,
    maxRetries: 0,
  });
  const emitter = new TypedEmitter<SDKEventMap>();
  const client = new HttpClient(config, emitter);
  const uploader = new FileUploader(config, client, emitter);
  return new Document(client, uploader);
}

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

/** Minimal valid JPEG header bytes for test uploads. */
const JPEG_BYTES = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, ...new Array(100).fill(0)]);

const MOCK_SCAN_RESULT = {
  documentType: 'passport',
  fullName: 'Jane Doe',
  firstName: 'Jane',
  lastName: 'Doe',
  dateOfBirth: '1990-01-15',
  gender: 'female',
  nationality: 'CA',
  documentNumber: 'AB1234567',
  expirationDate: '2030-06-01',
  issuingCountry: 'CA',
  address: '123 Main St',
  mrzData: 'P<CANDOE<<JANE<<<<<<<<<<<<<<<',
  rawFields: { firstName: 'Jane', lastName: 'Doe' },
  confidence: 0.97,
};

// ---------------------------------------------------------------------------
// MSW handler helpers
// ---------------------------------------------------------------------------

function mockPresign() {
  return http.post(`${BASE_URL}/v1/uploads/presign`, () => {
    return HttpResponse.json({
      uploads: [{ uploadUrl: 'https://s3.example.com/presigned-1', fileKey: 'fk_doc_001' }],
    });
  });
}

function mockS3Put() {
  return http.put('https://s3.example.com/presigned-1', () => {
    return new HttpResponse(null, { status: 200 });
  });
}

// ---------------------------------------------------------------------------
// Document.scan — DOC-01, DOC-02, DOC-03
// ---------------------------------------------------------------------------

describe('Document.scan', () => {
  it('returns DocumentScanResult on successful scan', async () => {
    server.use(
      mockPresign(),
      mockS3Put(),
      http.post(`${BASE_URL}/v1/document/scan`, () => {
        return HttpResponse.json(MOCK_SCAN_RESULT);
      }),
    );

    const doc = createDocument();
    const result = await doc.scan({ image: JPEG_BYTES });

    expect(result.fullName).toBe('Jane Doe');
    expect(result.confidence).toBe(0.97);
    expect(result.documentNumber).toBe('AB1234567');
    expect(result.rawFields['firstName']).toBe('Jane');
  });

  it('passes documentType to the API endpoint', async () => {
    let capturedBody: unknown = null;

    server.use(
      mockPresign(),
      mockS3Put(),
      http.post(`${BASE_URL}/v1/document/scan`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(MOCK_SCAN_RESULT);
      }),
    );

    const doc = createDocument();
    await doc.scan({ image: JPEG_BYTES, documentType: 'passport' });

    expect((capturedBody as Record<string, unknown>).documentType).toBe('passport');
  });

  it('defaults documentType to auto when omitted', async () => {
    let capturedBody: unknown = null;

    server.use(
      mockPresign(),
      mockS3Put(),
      http.post(`${BASE_URL}/v1/document/scan`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(MOCK_SCAN_RESULT);
      }),
    );

    const doc = createDocument();
    await doc.scan({ image: JPEG_BYTES });

    expect((capturedBody as Record<string, unknown>).documentType).toBe('auto');
  });

  it('strips unknown fields from API response (D-06)', async () => {
    server.use(
      mockPresign(),
      mockS3Put(),
      http.post(`${BASE_URL}/v1/document/scan`, () => {
        return HttpResponse.json({ ...MOCK_SCAN_RESULT, unknownField: 'surprise' });
      }),
    );

    const doc = createDocument();
    const result = await doc.scan({ image: JPEG_BYTES });

    expect(result).not.toHaveProperty('unknownField');
    expect(result.fullName).toBe('Jane Doe');
  });

  it('throws ValidationError for missing image', async () => {
    // No msw handlers registered — proves validation fires before any network call
    const doc = createDocument();
    await expect(doc.scan({} as never)).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for invalid documentType', async () => {
    const doc = createDocument();
    await expect(
      doc.scan({ image: JPEG_BYTES, documentType: 'invalid_type' as never }),
    ).rejects.toThrow(ValidationError);
  });

  it('returns AuthenticationError on 401 from presign', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/uploads/presign`, () =>
        HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      ),
    );
    const doc = createDocument();
    await expect(doc.scan({ image: JPEG_BYTES })).rejects.toThrow(AuthenticationError);
  });

  it('returns DeepIDVError on 500 from scan endpoint', async () => {
    server.use(
      mockPresign(),
      mockS3Put(),
      http.post(`${BASE_URL}/v1/document/scan`, () =>
        HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 }),
      ),
    );
    const doc = createDocument();
    await expect(doc.scan({ image: JPEG_BYTES })).rejects.toThrow(DeepIDVError);
  });
});
