/**
 * @deepidv/server — Node.js basic usage example
 *
 * Prerequisites:
 *   - Set DEEPIDV_API_KEY in your environment: export DEEPIDV_API_KEY=sk_...
 *   - Install the SDK: npm install @deepidv/server
 *   - Provide real image files at the paths used in the examples below
 *
 * This file is a showcase of every SDK method with comments explaining
 * inputs and return values. It is not intended to be run as-is — replace
 * the placeholder paths and values with real data.
 *
 * Run (after replacing placeholders):
 *   npx tsx examples/node-basic/index.ts
 */

import { readFileSync } from 'node:fs';
import {
  DeepIDV,
  DeepIDVError,
  AuthenticationError,
  RateLimitError,
} from '@deepidv/server';

// ---------------------------------------------------------------------------
// 1. Initialize the client
// ---------------------------------------------------------------------------

/**
 * Create a DeepIDV client with your API key.
 * The apiKey is validated at construction time — an invalid (empty) key
 * throws synchronously before any network call is made.
 */
const client = new DeepIDV({
  apiKey: process.env.DEEPIDV_API_KEY ?? 'sk_replace_me',

  // Optional: override the API base URL (default: https://api.deepidv.com)
  // baseUrl: 'https://api.deepidv.com',

  // Optional: per-request timeout in milliseconds (default: 30 000)
  // timeout: 30_000,

  // Optional: maximum retry attempts for 429 / 5xx errors (default: 3)
  // maxRetries: 3,
});

// ---------------------------------------------------------------------------
// 2. Observe lifecycle events
// ---------------------------------------------------------------------------

/**
 * Subscribe to the 'request' event to log outgoing requests.
 * client.on() returns an unsubscribe function.
 *
 * Available events: 'request', 'response', 'retry', 'error', 'warning',
 * 'upload:start', 'upload:complete', 'upload:error'
 */
const unsubRequest = client.on('request', ({ method, url }) => {
  console.log(`[deepidv] --> ${method} ${url}`);
});

client.on('response', ({ status, url, durationMs }) => {
  console.log(`[deepidv] <-- ${status} ${url} (${durationMs}ms)`);
});

client.on('retry', ({ attempt, delayMs }) => {
  console.log(`[deepidv] retry attempt ${attempt} after ${delayMs}ms`);
});

// Unsubscribe when you no longer need the listener:
// unsubRequest();
void unsubRequest; // suppress unused warning in this example

// ---------------------------------------------------------------------------
// 3. Load sample image buffers from disk
// ---------------------------------------------------------------------------

// Replace these paths with real image files before running
const passportBuffer = readFileSync('path/to/passport.jpg');
const selfieBuffer = readFileSync('path/to/selfie.jpg');
const documentBuffer = readFileSync('path/to/document.jpg');

// ---------------------------------------------------------------------------
// 4. Sessions module
// ---------------------------------------------------------------------------

async function sessionsExample(): Promise<void> {
  /**
   * Create a hosted verification session.
   *
   * Returns: { id, sessionUrl, externalId?, links[] }
   * The sessionUrl is a deepidv-hosted page where the end user completes
   * identity verification steps in their browser.
   */
  const created = await client.sessions.create({
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane.doe@example.com',
    phone: '+15555550100',

    // Optional: link this session to an ID in your own system
    externalId: 'user_abc123',

    // Optional: custom workflow ID configured in your deepidv dashboard
    // workflowId: 'wf_standard_kyc',

    // Optional: URL to redirect the user after completing verification
    // redirectUrl: 'https://yourapp.com/verify/complete',

    // Optional: send email/SMS invites (both default to true on the API)
    sendEmailInvite: true,
    sendPhoneInvite: false,
  });

  console.log('Session created:', created.id);
  console.log('Verification URL:', created.sessionUrl);

  const sessionId = created.id;

  /**
   * Retrieve a full session record by ID.
   *
   * Returns the complete Session object including status, analysis results,
   * timestamps, and all linked data collected during verification.
   */
  const retrieved = await client.sessions.retrieve(sessionId);
  console.log('Session status:', retrieved.sessionRecord.status);

  /**
   * List sessions with optional filters.
   *
   * Returns: { data: Session[], total?: number, hasMore?: boolean, limit: number, offset: number }
   */
  const page = await client.sessions.list({
    limit: 10,
    offset: 0,
    // status: 'PENDING',   // filter by status
  });

  console.log(`Listed ${page.data.length} of ${page.total} sessions`);

  /**
   * Update a session's status to VERIFIED, REJECTED, or VOIDED.
   *
   * PENDING and SUBMITTED cannot be set manually — they are managed by the
   * API as users progress through the verification flow.
   *
   * Returns the updated Session object.
   */
  const updated = await client.sessions.updateStatus(sessionId, 'VERIFIED');
  console.log('Updated status:', updated.sessionRecord.status);
}

// ---------------------------------------------------------------------------
// 5. Document module
// ---------------------------------------------------------------------------

async function documentExample(): Promise<void> {
  /**
   * Scan a document image and extract structured OCR data.
   *
   * Accepts: Buffer, Uint8Array, ReadableStream, file path (string), or base64
   * Returns: DocumentScanResult — extracted fields (name, DOB, ID number, etc.)
   *
   * Supported document types: 'passport' | 'drivers_license' | 'national_id' | 'other'
   */
  const result = await client.document.scan({
    image: passportBuffer,
    documentType: 'passport',
  });

  console.log('Document type:', result.documentType);
  console.log('Full name:', result.fullName);
  console.log('Date of birth:', result.dateOfBirth);
  console.log('Document number:', result.documentNumber);
  console.log('Expiration date:', result.expirationDate);
  console.log('Nationality:', result.nationality);
}

// ---------------------------------------------------------------------------
// 6. Face module
// ---------------------------------------------------------------------------

async function faceExample(): Promise<void> {
  /**
   * Detect whether a face is present in an image.
   *
   * Returns: { faceDetected: boolean, confidence: number (0–1) }
   */
  const detection = await client.face.detect({
    image: selfieBuffer,
  });

  console.log('Face detected:', detection.faceDetected);
  console.log('Detection confidence:', detection.confidence);

  /**
   * Compare two face images and get a similarity score.
   *
   * Both images are uploaded in parallel using presigned URLs.
   * Returns: { isMatch: boolean, confidence: number (0–1), threshold: number }
   *
   * Typical use case: compare a selfie against a document photo.
   */
  const comparison = await client.face.compare({
    source: selfieBuffer,   // source face (e.g., live selfie)
    target: documentBuffer, // target face (e.g., passport photo)
  });

  console.log('Faces match:', comparison.isMatch);
  console.log('Match confidence:', comparison.confidence);

  /**
   * Estimate the age and gender of a person from a face image.
   *
   * Returns: { estimatedAge: number, ageRange: { low, high }, gender: 'male' | 'female' | 'unknown' }
   */
  const ageResult = await client.face.estimateAge({
    image: selfieBuffer,
  });

  console.log('Estimated age:', ageResult.estimatedAge);
  console.log('Age range:', ageResult.ageRange);
  console.log('Gender:', ageResult.gender);
}

// ---------------------------------------------------------------------------
// 7. Identity module
// ---------------------------------------------------------------------------

async function identityExample(): Promise<void> {
  /**
   * Run a full identity verification in one call.
   *
   * Internally orchestrates:
   *   1. Document scan (OCR extraction)
   *   2. Face detection on the selfie
   *   3. Face comparison between the selfie and the document photo
   *
   * Both images are uploaded concurrently via presigned URLs.
   * Returns: IdentityVerificationResult — aggregated result with sub-results
   * for document, face detection, and face match.
   */
  const result = await client.identity.verify({
    documentImage: passportBuffer,
    faceImage: selfieBuffer,
  });

  console.log('Identity verified:', result.verified);
  console.log('Overall confidence:', result.overallConfidence);

  // Sub-results for each check
  console.log('Document scan result:', result.document);
  console.log('Face detection result:', result.faceDetection);
  console.log('Face match result:', result.faceMatch);
}

// ---------------------------------------------------------------------------
// 8. Error handling
// ---------------------------------------------------------------------------

async function errorHandlingExample(): Promise<void> {
  try {
    await client.identity.verify({
      documentImage: passportBuffer,
      faceImage: selfieBuffer,
    });
  } catch (err) {
    if (err instanceof AuthenticationError) {
      // HTTP 401 — invalid or expired API key
      console.error('Authentication failed:', err.message);
      console.error('Redacted key:', err.redactedKey); // never logs the full key
    } else if (err instanceof RateLimitError) {
      // HTTP 429 — slow down requests
      console.error('Rate limited. Retry after:', err.retryAfter, 'seconds');
    } else if (err instanceof DeepIDVError) {
      // Any other API error (validation, server error, network, timeout)
      console.error('API error:', err.message);
      console.error('Status:', err.status);
      console.error('Code:', err.code);
    } else {
      throw err; // re-throw unexpected errors
    }
  }
}

// ---------------------------------------------------------------------------
// 9. Run all examples
// ---------------------------------------------------------------------------

(async () => {
  console.log('=== deepidv SDK — Node.js basic usage example ===\n');

  try {
    await sessionsExample();
    await documentExample();
    await faceExample();
    await identityExample();
    await errorHandlingExample();

    console.log('\nAll examples completed successfully.');
  } catch (err) {
    console.error('Example failed:', err);
    process.exit(1);
  }
})();
