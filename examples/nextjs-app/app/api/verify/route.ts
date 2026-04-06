/**
 * @deepidv/server — Next.js App Router integration example
 *
 * Demonstrates how to use the @deepidv/server SDK inside a Next.js
 * App Router route handler (app/api/verify/route.ts).
 *
 * Prerequisites:
 *   - npx create-next-app@latest
 *   - npm install @deepidv/server
 *   - Set DEEPIDV_API_KEY in .env.local
 *
 * This file goes in: app/api/verify/route.ts
 *
 * Usage:
 *   POST /api/verify with FormData containing "document" and "selfie" files
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  DeepIDV,
  DeepIDVError,
  AuthenticationError,
  ValidationError,
} from '@deepidv/server';

// Initialize the client at module scope — reused across requests.
// Next.js App Router route handlers run on the server (Node.js runtime).
const client = new DeepIDV({
  apiKey: process.env.DEEPIDV_API_KEY ?? '',
});

// -------------------------------------------------------------------------
// POST /api/verify — Full identity verification
// -------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();

    const documentFile = formData.get('document') as File | null;
    const selfieFile = formData.get('selfie') as File | null;

    if (!documentFile || !selfieFile) {
      return NextResponse.json(
        { error: 'Both "document" and "selfie" files are required' },
        { status: 400 },
      );
    }

    // Convert Web File objects to Uint8Array for the SDK
    const documentBuffer = new Uint8Array(await documentFile.arrayBuffer());
    const selfieBuffer = new Uint8Array(await selfieFile.arrayBuffer());

    const result = await client.identity.verify({
      documentImage: documentBuffer,
      faceImage: selfieBuffer,
    });

    return NextResponse.json({
      verified: result.verified,
      overallConfidence: result.overallConfidence,
      document: {
        fullName: result.document.fullName,
        dateOfBirth: result.document.dateOfBirth,
        documentNumber: result.document.documentNumber,
        expirationDate: result.document.expirationDate,
      },
      faceMatch: {
        isMatch: result.faceMatch.isMatch,
        confidence: result.faceMatch.confidence,
      },
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    if (err instanceof AuthenticationError) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    if (err instanceof DeepIDVError) {
      return NextResponse.json(
        { error: 'Verification service error', detail: err.message },
        { status: 502 },
      );
    }

    throw err;
  }
}

// -------------------------------------------------------------------------
// GET /api/verify — Not supported, return method hint
// -------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Use POST with FormData containing "document" and "selfie" files' },
    { status: 405 },
  );
}
