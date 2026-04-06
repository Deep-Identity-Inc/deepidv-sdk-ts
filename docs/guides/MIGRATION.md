# Migration from REST API

If you're currently calling `api.deepidv.com` directly with `fetch` or `curl`, this guide shows what changes — and what the SDK handles for you.

## Endpoint Mapping

| REST Endpoint | SDK Method |
|--------------|------------|
| `POST /v1/sessions` | `client.sessions.create(input)` |
| `GET /v1/sessions/:id` | `client.sessions.retrieve(id)` |
| `GET /v1/sessions` | `client.sessions.list(params)` |
| `PATCH /v1/sessions/:id` | `client.sessions.updateStatus(id, status)` |
| `POST /v1/uploads/presign` → `PUT` to S3 → `POST /v1/document/scan` | `client.document.scan({ image })` |
| `POST /v1/uploads/presign` → `PUT` to S3 → `POST /v1/face/detect` | `client.face.detect({ image })` |
| `POST /v1/uploads/presign` (count:2) → 2x `PUT` to S3 → `POST /v1/face/compare` | `client.face.compare({ source, target })` |
| `POST /v1/uploads/presign` → `PUT` to S3 → `POST /v1/face/estimate-age` | `client.face.estimateAge({ image })` |
| `POST /v1/uploads/presign` (count:2) → 2x `PUT` to S3 → `POST /v1/identity/verify` | `client.identity.verify({ documentImage, faceImage })` |

## Before / After Examples

### Create a Session

**Before (fetch):**
```typescript
const response = await fetch('https://api.deepidv.com/v1/sessions', {
  method: 'POST',
  headers: {
    'x-api-key': process.env.DEEPIDV_API_KEY!,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  body: JSON.stringify({
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phone: '+15551234567',
  }),
});

if (!response.ok) {
  throw new Error(`HTTP ${response.status}: ${await response.text()}`);
}

const session = await response.json();
```

**After (SDK):**
```typescript
const session = await client.sessions.create({
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  phone: '+15551234567',
});
```

### Scan a Document

**Before (fetch) — 3 API calls, manual S3 upload:**
```typescript
import { readFileSync } from 'fs';

const image = readFileSync('passport.jpg');
const headers = {
  'x-api-key': process.env.DEEPIDV_API_KEY!,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// Step 1: Get presigned URL
const presignRes = await fetch('https://api.deepidv.com/v1/uploads/presign', {
  method: 'POST',
  headers,
  body: JSON.stringify({ contentType: 'image/jpeg', count: 1 }),
});
const { uploads } = await presignRes.json();

// Step 2: Upload to S3
await fetch(uploads[0].uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': 'image/jpeg' },
  body: image,
});

// Step 3: Call scan endpoint
const scanRes = await fetch('https://api.deepidv.com/v1/document/scan', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    fileKey: uploads[0].fileKey,
    documentType: 'passport',
  }),
});

if (!scanRes.ok) throw new Error(`Scan failed: ${scanRes.status}`);
const result = await scanRes.json();
```

**After (SDK) — one method call:**
```typescript
const result = await client.document.scan({
  image: readFileSync('passport.jpg'),
  documentType: 'passport',
});
```

### Compare Two Faces

**Before (fetch) — 4 API calls, manual parallel upload:**
```typescript
const source = readFileSync('id-photo.jpg');
const target = readFileSync('selfie.jpg');

// Step 1: Batch presign
const presignRes = await fetch('https://api.deepidv.com/v1/uploads/presign', {
  method: 'POST',
  headers,
  body: JSON.stringify({ contentType: 'image/jpeg', count: 2 }),
});
const { uploads } = await presignRes.json();

// Step 2: Parallel upload
await Promise.all([
  fetch(uploads[0].uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: source,
  }),
  fetch(uploads[1].uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: target,
  }),
]);

// Step 3: Compare
const compareRes = await fetch('https://api.deepidv.com/v1/face/compare', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    sourceFileKey: uploads[0].fileKey,
    targetFileKey: uploads[1].fileKey,
  }),
});
const result = await compareRes.json();
```

**After (SDK):**
```typescript
const result = await client.face.compare({
  source: readFileSync('id-photo.jpg'),
  target: readFileSync('selfie.jpg'),
});
```

## What the SDK Handles for You

| Concern | Manual (fetch) | SDK |
|---------|---------------|-----|
| Auth headers | Add `x-api-key` to every request | Automatic |
| Content-Type | Set `application/json` manually | Automatic |
| Presigned URL flow | 3+ API calls per file operation | One method call |
| Parallel uploads | Manual `Promise.all` | Automatic |
| Content-type detection | Read magic bytes yourself | Automatic |
| Retry on 429/5xx | Write retry loop with backoff | Automatic (configurable) |
| Timeout handling | Manual `AbortController` | Automatic (per-attempt) |
| Error classification | Parse status codes | Typed error classes |
| Input validation | Manual checks | Zod schemas (compile + runtime) |
| TypeScript types | Write your own interfaces | Inferred from schemas |
| API key redaction | Implement yourself | Built into error classes |
