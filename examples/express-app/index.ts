/**
 * @deepidv/server — Express.js integration example
 *
 * Demonstrates how to use the @deepidv/server SDK inside Express route handlers.
 * This example creates REST endpoints for identity verification and session management.
 *
 * Prerequisites:
 *   - npm install @deepidv/server express multer
 *   - npm install -D @types/express @types/multer tsx
 *   - Set DEEPIDV_API_KEY in your environment
 *
 * Run: npx tsx examples/express-app/index.ts
 */

import express from 'express';
import multer from 'multer';
import {
  DeepIDV,
  DeepIDVError,
  AuthenticationError,
  ValidationError,
} from '@deepidv/server';

const app = express();
app.use(express.json());

// Configure multer for file uploads (stores in memory as Buffer)
const upload = multer({ storage: multer.memoryStorage() });

// Initialize the DeepIDV client once — reuse across all requests
const client = new DeepIDV({
  apiKey: process.env.DEEPIDV_API_KEY ?? 'sk_replace_me',
});

// -------------------------------------------------------------------------
// POST /api/verify — Full identity verification
// -------------------------------------------------------------------------

/**
 * Accepts two image files (document + selfie) via multipart form data
 * and runs a full identity verification.
 *
 * curl -X POST http://localhost:3000/api/verify \
 *   -F "document=@passport.jpg" \
 *   -F "selfie=@selfie.jpg"
 */
app.post(
  '/api/verify',
  upload.fields([
    { name: 'document', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      if (!files['document']?.[0] || !files['selfie']?.[0]) {
        res.status(400).json({ error: 'Both "document" and "selfie" files are required' });
        return;
      }

      const result = await client.identity.verify({
        documentImage: files['document'][0].buffer,
        faceImage: files['selfie'][0].buffer,
      });

      res.json({
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
        res.status(400).json({ error: err.message });
      } else if (err instanceof AuthenticationError) {
        res.status(401).json({ error: 'Invalid API key' });
      } else if (err instanceof DeepIDVError) {
        res.status(502).json({ error: 'Verification service error', detail: err.message });
      } else {
        throw err;
      }
    }
  },
);

// -------------------------------------------------------------------------
// POST /api/sessions — Create a hosted verification session
// -------------------------------------------------------------------------

app.post('/api/sessions', async (req, res) => {
  try {
    const session = await client.sessions.create({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      phone: req.body.phone,
      externalId: req.body.externalId,
    });

    res.status(201).json({
      id: session.id,
      sessionUrl: session.sessionUrl,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
    } else if (err instanceof DeepIDVError) {
      res.status(502).json({ error: err.message });
    } else {
      throw err;
    }
  }
});

// -------------------------------------------------------------------------
// GET /api/sessions/:id — Retrieve session details
// -------------------------------------------------------------------------

app.get('/api/sessions/:id', async (req, res) => {
  try {
    const result = await client.sessions.retrieve(req.params.id);

    res.json({
      status: result.sessionRecord.status,
      progress: result.sessionRecord.sessionProgress,
      createdAt: result.sessionRecord.createdAt,
    });
  } catch (err) {
    if (err instanceof DeepIDVError) {
      res.status(err.status ?? 500).json({ error: err.message });
    } else {
      throw err;
    }
  }
});

// -------------------------------------------------------------------------
// Start the server
// -------------------------------------------------------------------------

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('  POST /api/verify     — identity verification (multipart)');
  console.log('  POST /api/sessions   — create verification session');
  console.log('  GET  /api/sessions/:id — retrieve session');
});
