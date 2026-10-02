# API Reference

Complete reference for every public class and method in `@deepidv/server`.

## DeepIDV

The main client class. Entry point for all SDK operations.

```typescript
import { DeepIDV } from '@deepidv/server';
```

### Constructor

```typescript
new DeepIDV(config: DeepIDVConfig)
```

Creates a new client instance. Validates config synchronously — throws `ValidationError` if `apiKey` is missing or empty.

| Parameter                  | Type            | Required | Description                                         |
| -------------------------- | --------------- | -------- | --------------------------------------------------- |
| `config`                   | `DeepIDVConfig` | Yes      | Client configuration                                |
| `config.apiKey`            | `string`        | Yes      | API key for authentication                          |
| `config.baseUrl`           | `string`        | No       | API base URL. Default: `https://api.deepidv.com`    |
| `config.timeout`           | `number`        | No       | Per-attempt request timeout in ms. Default: `30000` |
| `config.uploadTimeout`     | `number`        | No       | Per-attempt upload timeout in ms. Default: `120000` |
| `config.maxRetries`        | `number`        | No       | Max retry attempts for 429/5xx. Default: `3`        |
| `config.initialRetryDelay` | `number`        | No       | Initial backoff delay in ms. Default: `500`         |
| `config.fetch`             | `typeof fetch`  | No       | Custom fetch implementation                         |

**Example:**

```typescript
const client = new DeepIDV({
  apiKey: process.env.DEEPIDV_API_KEY!,
  timeout: 15_000,
  maxRetries: 5,
});
```

### Properties

| Property           | Type               | Description                                |
| ------------------ | ------------------ | ------------------------------------------ |
| `sessions`         | `Sessions`         | Session management methods                 |
| `document`         | `Document`         | Document scanning methods                  |
| `face`             | `Face`             | Face detection and comparison methods      |
| `identity`         | `Identity`         | Orchestrated identity verification         |
| `screening`        | `Screening`        | Synchronous and async screening operations |
| `asyncJobs`        | `AsyncJobs`        | Resumable async-job polling                |
| `deepfake`         | `Deepfake`         | Deepfake challenge, upload, and analysis   |
| `auth`             | `Auth`             | API-key connection verification            |
| `workflows`        | `Workflows`        | Workflow definitions and session creation  |
| `workflowSessions` | `WorkflowSessions` | Resumable workflow execution               |

### `on(event, listener)`

```typescript
on<K extends keyof SDKEventMap>(
  event: K,
  listener: (payload: SDKEventMap[K]) => void,
): () => void
```

Subscribe to an SDK lifecycle event. Returns an unsubscribe function.

| Parameter  | Type                | Description |
| ---------- | ------------------- | ----------- |
| `event`    | `keyof SDKEventMap` | Event name  |
| `listener` | `(payload) => void` | Callback    |

**Returns:** `() => void` — call to unsubscribe.

**Events:** `request`, `response`, `retry`, `error`, `warning`, `upload:start`, `upload:complete`

---

## Sessions

Access via `client.sessions`.

### `create(input)`

```typescript
async create(input: SessionCreateInput): Promise<SessionCreateResult>
```

Create a hosted verification session.

| Parameter               | Type      | Required | Default | Description                             |
| ----------------------- | --------- | -------- | ------- | --------------------------------------- |
| `input.firstName`       | `string`  | Yes      | —       | Applicant's first name                  |
| `input.lastName`        | `string`  | Yes      | —       | Applicant's last name                   |
| `input.email`           | `string`  | Yes      | —       | Applicant's email address               |
| `input.phone`           | `string`  | Yes      | —       | Applicant's phone number                |
| `input.externalId`      | `string`  | No       | —       | Your internal reference ID              |
| `input.workflowId`      | `string`  | No       | —       | Workflow to use                         |
| `input.redirectUrl`     | `string`  | No       | —       | URL to redirect user after verification |
| `input.sendEmailInvite` | `boolean` | No       | —       | Send email invitation                   |
| `input.sendPhoneInvite` | `boolean` | No       | —       | Send SMS invitation                     |
| `input.expiresInHours`  | `number`  | No       | —       | Expiry window from 1 to 8760 hours      |

**Returns:** `SessionCreateResult`

| Field        | Type                                                    | Description                    |
| ------------ | ------------------------------------------------------- | ------------------------------ |
| `id`         | `string`                                                | Session identifier             |
| `sessionUrl` | `string`                                                | Verification URL for the user  |
| `externalId` | `string?`                                               | Your external ID (if provided) |
| `expiresAt`  | `string?`                                               | Server-calculated expiry       |
| `links`      | `{ rel: string, href: string, description?: string }[]` | Associated links               |

**Throws:** `ValidationError`, `AuthenticationError`, `RateLimitError`, `DeepIDVError`

**Example:**

```typescript
const session = await client.sessions.create({
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  phone: '+15551234567',
  redirectUrl: 'https://yourapp.com/done',
});
console.log(session.sessionUrl);
```

### `retrieve(sessionId)`

```typescript
async retrieve(sessionId: string): Promise<SessionRetrieveResult>
```

Retrieve full session details including analysis results.

| Parameter   | Type     | Required | Description                |
| ----------- | -------- | -------- | -------------------------- |
| `sessionId` | `string` | Yes      | Session ID from `create()` |

**Returns:** `SessionRetrieveResult`

| Field           | Type                     | Description                                    |
| --------------- | ------------------------ | ---------------------------------------------- |
| `sessionRecord` | `Session`                | Full session object with status, analysis data |
| `user`          | `object?`                | Applicant user details                         |
| `senderUser`    | `object?`                | User who created the session                   |
| `resourceLinks` | `Record<string, string>` | Presigned URLs for uploaded resources          |

**Throws:** `ValidationError`, `AuthenticationError`, `DeepIDVError`

**Example:**

```typescript
const result = await client.sessions.retrieve('session-id-123');
console.log(result.sessionRecord.status);
```

### `list(params?)`

```typescript
async list(params?: SessionListParams): Promise<SessionListResult>
```

List sessions with optional filtering and pagination.

| Parameter               | Type              | Required | Description                          |
| ----------------------- | ----------------- | -------- | ------------------------------------ |
| `params.limit`          | `number`          | No       | Page size from 1 to 500              |
| `params.nextToken`      | `string`          | No       | Cursor returned by the previous page |
| `params.startDate`      | `string`          | No       | ISO 8601 creation-time lower bound   |
| `params.endDate`        | `string`          | No       | ISO 8601 creation-time upper bound   |
| `params.byOrganization` | `boolean \| null` | No       | Include organization-wide sessions   |
| `params.externalId`     | `string`          | No       | Filter by caller reference           |
| `params.workflowId`     | `string`          | No       | Filter by workflow                   |

**Returns:** `SessionListResult`

| Field       | Type             | Description                  |
| ----------- | ---------------- | ---------------------------- |
| `sessions`  | `Session[]`      | Sessions in the current page |
| `nextToken` | `string \| null` | Cursor for the next page     |

**Example:**

```typescript
const page = await client.sessions.list({ workflowId: 'workflow-123', limit: 10 });
for (const session of page.sessions) {
  console.log(`${session.id}: ${session.status}`);
}
```

### `updateStatus(sessionId, status)`

```typescript
async updateStatus(
  sessionId: string,
  status: 'VERIFIED' | 'REJECTED',
): Promise<SessionStatusUpdateResult>
```

Update session status. Only `VERIFIED` and `REJECTED` are valid targets.

| Parameter   | Type                       | Required | Description |
| ----------- | -------------------------- | -------- | ----------- |
| `sessionId` | `string`                   | Yes      | Session ID  |
| `status`    | `'VERIFIED' \| 'REJECTED'` | Yes      | New status  |

**Returns:** `SessionStatusUpdateResult` — the updated session record.

**Throws:** `ValidationError` (invalid status), `AuthenticationError`, `DeepIDVError`

**Example:**

```typescript
await client.sessions.updateStatus('session-id-123', 'VERIFIED');
```

### `createUploadUrls(sessionId, input)`

Generate session-scoped presigned PUT URLs for legacy identity slots or dynamic workflow slots.

```typescript
const { signedUrls } = await client.sessions.createUploadUrls('session-id-123', {
  files: [
    { fileName: 'front.jpg', contentType: 'image/jpeg', uploadType: 'id_front' },
    { fileName: 'letter.pdf', contentType: 'application/pdf', slot: 'employment_letter' },
  ],
});
```

Each entry returns `fileKey`, `slot`, `uploadUrl`, and an optional legacy `uploadType`. Upload the file with an HTTP `PUT` whose `Content-Type` exactly matches the requested value. Dynamic slots must be required by the session's current workflow step. Terminal sessions and sessions without an active compatible step return `ConflictError`.

---

## Document

Access via `client.document`.

### `scan(input)`

```typescript
async scan(input: DocumentScanInput): Promise<DocumentScanResult>
```

Scan a document image and extract structured OCR data. Handles presigned upload internally.

| Parameter            | Type           | Required | Default  | Description                                                                      |
| -------------------- | -------------- | -------- | -------- | -------------------------------------------------------------------------------- |
| `input.image`        | `FileInput`    | Yes      | —        | Document image (Uint8Array, Buffer, ReadableStream, base64 string, or file path) |
| `input.documentType` | `DocumentType` | No       | `'auto'` | `'passport'`, `'drivers_license'`, `'national_id'`, or `'auto'`                  |

**Returns:** `DocumentScanResult`

| Field            | Type                     | Description              |
| ---------------- | ------------------------ | ------------------------ |
| `documentType`   | `string`                 | Detected document type   |
| `fullName`       | `string`                 | Full name                |
| `firstName`      | `string`                 | First name               |
| `lastName`       | `string`                 | Last name                |
| `dateOfBirth`    | `string`                 | Date of birth            |
| `gender`         | `string`                 | Gender                   |
| `nationality`    | `string`                 | Nationality              |
| `documentNumber` | `string`                 | Document/ID number       |
| `expirationDate` | `string`                 | Expiration date          |
| `issuingCountry` | `string`                 | Issuing country          |
| `address`        | `string?`                | Address (if on document) |
| `mrzData`        | `string?`                | Machine-readable zone    |
| `faceImage`      | `string?`                | Extracted face (base64)  |
| `rawFields`      | `Record<string, string>` | All extracted fields     |
| `confidence`     | `number`                 | OCR confidence (0–1)     |

**Throws:** `ValidationError`, `AuthenticationError`, `RateLimitError`, `NetworkError`, `TimeoutError`, `DeepIDVError`

**Example:**

```typescript
const result = await client.document.scan({
  image: readFileSync('passport.jpg'),
  documentType: 'passport',
});
console.log(`${result.fullName} — expires ${result.expirationDate}`);
```

---

## Face

Access via `client.face`.

### `detect(input)`

```typescript
async detect(input: FaceDetectInput): Promise<FaceDetectResult>
```

Detect a face in an image.

| Parameter     | Type        | Required | Description      |
| ------------- | ----------- | -------- | ---------------- |
| `input.image` | `FileInput` | Yes      | Image to analyze |

**Returns:** `FaceDetectResult`

| Field          | Type                            | Description                |
| -------------- | ------------------------------- | -------------------------- |
| `faceDetected` | `boolean`                       | Whether a face was found   |
| `confidence`   | `number`                        | Detection confidence (0–1) |
| `boundingBox`  | `{ top, left, width, height }?` | Face position              |
| `landmarks`    | `{ type, x, y }[]?`             | Facial landmarks           |

**Example:**

```typescript
const result = await client.face.detect({ image: readFileSync('photo.jpg') });
if (result.faceDetected) {
  console.log(`Confidence: ${result.confidence}`);
}
```

### `compare(input)`

```typescript
async compare(input: FaceCompareInput): Promise<FaceCompareResult>
```

Compare two face images. Both are uploaded in parallel via batch presign.

| Parameter      | Type        | Required | Description              |
| -------------- | ----------- | -------- | ------------------------ |
| `input.source` | `FileInput` | Yes      | Reference image          |
| `input.target` | `FileInput` | Yes      | Image to compare against |

**Returns:** `FaceCompareResult`

| Field                | Type      | Description              |
| -------------------- | --------- | ------------------------ |
| `isMatch`            | `boolean` | Whether faces match      |
| `confidence`         | `number`  | Match confidence (0–100) |
| `threshold`          | `number`  | Match threshold (0–100)  |
| `sourceFaceDetected` | `boolean` | Face found in source     |
| `targetFaceDetected` | `boolean` | Face found in target     |

**Example:**

```typescript
const result = await client.face.compare({
  source: readFileSync('id-photo.jpg'),
  target: readFileSync('selfie.jpg'),
});
console.log(result.isMatch ? 'Same person' : 'Different people');
```

### `estimateAge(input)`

```typescript
async estimateAge(input: FaceEstimateAgeInput): Promise<FaceEstimateAgeResult>
```

Estimate age and gender from a face image.

| Parameter     | Type        | Required | Description      |
| ------------- | ----------- | -------- | ---------------- |
| `input.image` | `FileInput` | Yes      | Image to analyze |

**Returns:** `FaceEstimateAgeResult`

| Field              | Type                            | Description              |
| ------------------ | ------------------------------- | ------------------------ |
| `estimatedAge`     | `number`                        | Best-estimate age        |
| `ageRange`         | `{ low: number, high: number }` | Confidence range         |
| `gender`           | `'male' \| 'female'`            | Estimated gender         |
| `genderConfidence` | `number`                        | Gender confidence (0–1)  |
| `faceDetected`     | `boolean`                       | Whether a face was found |

**Example:**

```typescript
const result = await client.face.estimateAge({ image: readFileSync('photo.jpg') });
console.log(`Age: ${result.estimatedAge} (${result.ageRange.low}–${result.ageRange.high})`);
```

### `createLivenessSession(input?)`

Create an AWS Rekognition Face Liveness session and receive short-lived credentials for the device-side streaming component.

```typescript
const liveness = await client.face.createLivenessSession({
  sessionId: 'session-id-123',
  challengeType: 'FaceMovementAndLightChallenge',
});
```

The returned `credentials` are sensitive and expire at `expiresAt`. Do not log or persist them. This server SDK does not perform camera capture or add an AWS Amplify dependency.

Standalone creation is billable and is never automatically retried. Passing `sessionId` associates the result with an existing verification session.

### `getLivenessResult(livenessSessionId, params?)`

```typescript
const result = await client.face.getLivenessResult(liveness.livenessSessionId, {
  sessionId: 'session-id-123',
  confidenceThreshold: 80,
});
```

Returns `status` (`SUCCEEDED`, `IN_PROGRESS`, or `FAILED`), optional confidence from 0–100, and the server-computed `passed` flag. `confidenceThreshold` must be an integer from 1–100.

---

## Identity

Access via `client.identity`.

### `verify(input)`

```typescript
async verify(input: IdentityVerifyInput): Promise<IdentityVerificationResult>
```

Full identity verification: document scan + face detection + face comparison. Both images uploaded in parallel.

| Parameter             | Type           | Required | Default     | Description                                                     |
| --------------------- | -------------- | -------- | ----------- | --------------------------------------------------------------- |
| `input.documentImage` | `FileInput`    | Yes      | —           | Document image                                                  |
| `input.faceImage`     | `FileInput`    | Yes      | —           | Selfie / face image                                             |
| `input.documentType`  | `DocumentType` | No       | auto-detect | `'passport'`, `'drivers_license'`, `'national_id'`, or `'auto'` |

**Returns:** `IdentityVerificationResult`

All confidence and threshold values on this response are reported on a **0–100** scale.

| Field                        | Type                          | Description                  |
| ---------------------------- | ----------------------------- | ---------------------------- |
| `verified`                   | `boolean`                     | Overall pass/fail            |
| `overallConfidence`          | `number`                      | Aggregate confidence (0–100) |
| `document`                   | `IdentityDocumentResult`      | Document OCR data            |
| `document.documentType`      | `string`                      | Detected type                |
| `document.fullName`          | `string`                      | Full name                    |
| `document.firstName`         | `string`                      | First name                   |
| `document.lastName`          | `string`                      | Last name                    |
| `document.dateOfBirth`       | `string`                      | Date of birth                |
| `document.gender`            | `string`                      | Gender                       |
| `document.nationality`       | `string`                      | Nationality                  |
| `document.documentNumber`    | `string`                      | Document number              |
| `document.expirationDate`    | `string`                      | Expiration date              |
| `document.issuingCountry`    | `string`                      | Issuing country              |
| `document.confidence`        | `number`                      | OCR confidence (0–100)       |
| `faceDetection`              | `IdentityFaceDetectionResult` | Face detection result        |
| `faceDetection.faceDetected` | `boolean`                     | Face found                   |
| `faceDetection.confidence`   | `number`                      | Detection confidence (0–100) |
| `faceMatch`                  | `IdentityFaceMatchResult`     | Face comparison result       |
| `faceMatch.isMatch`          | `boolean`                     | Faces match                  |
| `faceMatch.confidence`       | `number`                      | Match confidence (0–100)     |
| `faceMatch.threshold`        | `number`                      | Match threshold (0–100)      |

**Throws:** `ValidationError`, `AuthenticationError`, `RateLimitError`, `NetworkError`, `TimeoutError`, `DeepIDVError`

**Example:**

```typescript
const result = await client.identity.verify({
  documentImage: readFileSync('passport.jpg'),
  faceImage: readFileSync('selfie.jpg'),
  documentType: 'passport',
});

if (result.verified) {
  console.log(`Verified: ${result.document.fullName}`);
  console.log(`Confidence: ${result.overallConfidence}`);
} else {
  console.log('Verification failed');
  console.log(`Face match: ${result.faceMatch.isMatch}`);
  console.log(`Document confidence: ${result.document.confidence}`);
}
```

---

## Deepfake

Access via `client.deepfake`. Capture remains application-owned; the SDK exposes the three resumable server operations without keeping hidden lifecycle state.

### `getChallenge(sessionId)`

Returns the phrase the user must speak for a workflow session. The session ID must be a UUID.

### `createUploadUrls(input)`

```typescript
const targets = await client.deepfake.createUploadUrls({
  sessionId,
  includeAudio: true,
});
```

Returns presigned URLs and matching S3 keys for six JPEG frames plus optional `audio/mp4`. Perform the PUTs directly and retain the returned keys for analysis.

### `analyze(input)`

Submit exactly six frame-metadata entries and the uploaded S3 keys. Analysis is synchronous and billable, consumes ephemeral media, and is never automatically retried.

```typescript
const verdict = await client.deepfake.analyze({
  scanDurationMs: 4000,
  challengeWord: challenge.challengeWord,
  frameMeta,
  s3Keys: targets.uploadKeys,
});
```

The result includes `verdict`, `riskScore`, `trustVerdict`, `trustScore`, failure reasons, and diagnostic details.

## Authentication

Use `client.auth.verify()` as a connection test for the configured REST API key. It returns `valid: true` and the owning organization's ID, name, and status. This is separate from hosted MCP OAuth client management.

```typescript
const connection = await client.auth.verify();
console.log(connection.organization.name);
```

---

## Workflows

Access workflow definitions through `client.workflows`.

### `list()` and `retrieve(workflowId)`

```typescript
const { workflows } = await client.workflows.list();
const { workflow } = await client.workflows.retrieve(workflows[0].id);
```

### `create(input)`

Creates an ordered workflow containing 1–10 unique steps. Step configuration uses the snake_case keys documented by the OpenAPI contract.

```typescript
const { workflow } = await client.workflows.create({
  name: 'Identity and liveness',
  steps: [
    { id: 'ID_VERIFICATION', config: { minimum_age: 18 } },
    { id: 'FACE_LIVENESS', config: { confidence_threshold: 80 } },
  ],
});
```

Workflow creation is not automatically retried because a lost response could otherwise create a duplicate definition.

### `updateStepConfig(workflowId, stepId, config)`

Partially updates one existing step. The API validates the supplied config against that step's current contract and can return `ConflictError` for legacy `propertyGroups` workflows.

```typescript
await client.workflows.updateStepConfig(workflow.id, 'FACE_LIVENESS', {
  confidence_threshold: 85,
});
```

### `createSession(workflowId, input)`

Creates a headless workflow session without sending an invite or returning a hosted URL.

```typescript
const session = await client.workflows.createSession(workflow.id, {
  email: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  phone: '+15192223333',
  externalId: 'customer-42',
  expiresInHours: 24,
});
```

This operation performs a funds preflight and is not automatically retried.

## Workflow sessions

`client.workflowSessions` is stateless: every method accepts a session ID, so an interrupted process can resume without preserving an SDK handle.

### `retrieve(sessionId)`

Returns ordered execution state, the current step, attempts remaining, and each step's server-resolved requirements. It is safe to poll.

### `start(sessionId)`

Validates and hands over a fresh headless session. The API does not write during this call, so the SDK retains normal retry behavior until the first step submission.

```typescript
const state = await client.workflowSessions.start(session.sessionId);
```

### `submitStep(sessionId, stepId, input)`

Validates the input against the selected public workflow step and submits it in order. State-changing step submissions are never automatically retried.

```typescript
const result = await client.workflowSessions.submitStep(session.sessionId, 'ID_VERIFICATION', {
  documentType: 'passport',
  uploads: {
    idFront: 'sessions/.../id_front.jpg',
    selfieFront: 'sessions/.../selfie_front.jpg',
  },
});
```

The common result fields are normalized to camelCase. Step-specific response objects are retained in `result.payload`, including fields that the OpenAPI contract adds in future versions. Out-of-order, concurrent, not-ready, and terminal-session submissions return `ConflictError`.

---

## Screening

Access via `client.screening`.

- `pepSanctions(input)` returns a `PepSanctionsResult` synchronously.
- `adverseMedia(input)` returns an `AdverseMediaHandle`.
- `titleCheck(input)` returns a `TitleCheckResult` synchronously.

The adverse-media handle exposes `jobId`, `refresh()` for one poll, and `wait(options?)` for polling until a typed result is ready. For adverse-media requests, the SDK sends an `Idempotency-Key` header from `input.idempotencyKey` or generates one automatically.

```typescript
const titleResult = await client.screening.titleCheck({
  email: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  address: '123 Main St, Austin, TX',
});
```

## Async jobs

Use `client.asyncJobs.get(jobId)` to resume a persisted job. `jobId` must be a UUID. The result is discriminated by lowercase `status`: `pending`, `processing`, `ready`, or `failed`.
