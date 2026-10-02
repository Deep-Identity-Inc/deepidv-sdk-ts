# Migration from REST API

If you're currently calling `api.deepidv.com` directly with `fetch` or `curl`, this guide shows what changes — and what the SDK handles for you.

## Endpoint Mapping

| REST Endpoint                                                                     | SDK Method                                             |
| --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `POST /v1/sessions`                                                               | `client.sessions.create(input)`                        |
| `GET /v1/sessions/:id`                                                            | `client.sessions.retrieve(id)`                         |
| `GET /v1/sessions`                                                                | `client.sessions.list(params)`                         |
| `PATCH /v1/sessions/:id/update-status`                                            | `client.sessions.updateStatus(id, status)`             |
| `POST /v1/upload/presign` → `PUT` to S3 → `POST /v1/document/scan`                | `client.document.scan({ image })`                      |
| `POST /v1/upload/presign` → `PUT` to S3 → `POST /v1/face/detect`                  | `client.face.detect({ image })`                        |
| `POST /v1/upload/presign` (2 files) → 2x `PUT` to S3 → `POST /v1/face/compare`    | `client.face.compare({ source, target })`              |
| `POST /v1/upload/presign` → `PUT` to S3 → `POST /v1/face/estimate-age`            | `client.face.estimateAge({ image })`                   |
| `POST /v1/upload/presign` (2 files) → 2x `PUT` to S3 → `POST /v1/identity/verify` | `client.identity.verify({ documentImage, faceImage })` |

| `GET /v1/workflows` | `client.workflows.list()` |
| `POST /v1/workflows` | `client.workflows.create(input)` |
| `GET /v1/workflows/:id` | `client.workflows.retrieve(id)` |
| `PATCH /v1/workflows/:workflowId/steps/:stepId/config` | `client.workflows.updateStepConfig(workflowId, stepId, config)` |
| `POST /v1/workflows/:workflowId/sessions` | `client.workflows.createSession(workflowId, input)` |
| `GET /v1/sessions/:sessionId/workflow` | `client.workflowSessions.retrieve(sessionId)` |
| `POST /v1/sessions/:sessionId/workflow/start` | `client.workflowSessions.start(sessionId)` |
| `POST /v1/sessions/:sessionId/steps/:stepId` | `client.workflowSessions.submitStep(sessionId, stepId, input)` |

## Upgrading from an earlier SDK version

This parity release intentionally removes or changes SDK shapes that did not match the public API:

- `sessions.list()` now returns `{ sessions, nextToken }`. Replace the previous `{ data, limit, offset }` pagination shape and pass `nextToken` to retrieve the next page.
- Session list filters now use `startDate`, `endDate`, `byOrganization`, `externalId`, and `workflowId`. The unsupported `offset` and `status` parameters were removed.
- `sessions.updateStatus()` calls `PATCH /v1/sessions/:id/update-status` with `{ new_status }`. Only `VERIFIED` and `REJECTED` can be set; `VOIDED` is no longer an accepted update target.
- `screening.titleCheck()` returns `Promise<TitleCheckResult>` synchronously. Do not call `.wait()` or `.refresh()` on its result.
- The non-functional `screening.list()` method was removed because the public API does not define a screening-history route.
- `DocumentScanResult` no longer contains `faceImage`, which is not returned by the public document-scan response. Keep the original image when it is needed by `face.compare()` or use `identity.verify()` for the combined document-and-face flow.

Session records normalize `auto_decision` to `autoDecision` and `decision_source` to `decisionSource`. A `pending` auto-decision means you should continue polling; `AUTO_APPROVE` and `DECLINED` distinguish AI decisions from operator-set statuses.

## Before / After Examples

### Create a Session

**Before (fetch):**

```typescript
const response = await fetch('https://api.deepidv.com/v1/sessions', {
  method: 'POST',
  headers: {
    'x-api-key': process.env.DEEPIDV_API_KEY!,
    'Content-Type': 'application/json',
    Accept: 'application/json',
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
  Accept: 'application/json',
};

// Step 1: Get presigned URL
const presignRes = await fetch('https://api.deepidv.com/v1/upload/presign', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    files: [{ contentType: 'image/jpeg', byteLength: image.byteLength }],
  }),
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
const presignRes = await fetch('https://api.deepidv.com/v1/upload/presign', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    files: [
      { contentType: 'image/jpeg', byteLength: source.byteLength },
      { contentType: 'image/jpeg', byteLength: target.byteLength },
    ],
  }),
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

| Concern                | Manual (fetch)                   | SDK                             |
| ---------------------- | -------------------------------- | ------------------------------- |
| Auth headers           | Add `x-api-key` to every request | Automatic                       |
| Content-Type           | Set `application/json` manually  | Automatic                       |
| Presigned URL flow     | 3+ API calls per file operation  | One method call                 |
| Parallel uploads       | Manual `Promise.all`             | Automatic                       |
| Content-type detection | Read magic bytes yourself        | Automatic                       |
| Retry on 429/5xx       | Write retry loop with backoff    | Automatic for retry-safe calls  |
| Timeout handling       | Manual `AbortController`         | Automatic (per-attempt)         |
| Error classification   | Parse status codes               | Typed error classes             |
| Input validation       | Manual checks                    | Zod schemas (compile + runtime) |
| TypeScript types       | Write your own interfaces        | Inferred from schemas           |
| API key redaction      | Implement yourself               | Built into error classes        |

Session creation and billable synchronous screening calls disable automatic retries because replaying them could create duplicate sessions, invitations, or charges.
