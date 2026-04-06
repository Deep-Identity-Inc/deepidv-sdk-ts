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

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `config` | `DeepIDVConfig` | Yes | Client configuration |
| `config.apiKey` | `string` | Yes | API key for authentication |
| `config.baseUrl` | `string` | No | API base URL. Default: `https://api.deepidv.com` |
| `config.timeout` | `number` | No | Per-attempt request timeout in ms. Default: `30000` |
| `config.uploadTimeout` | `number` | No | Per-attempt upload timeout in ms. Default: `120000` |
| `config.maxRetries` | `number` | No | Max retry attempts for 429/5xx. Default: `3` |
| `config.initialRetryDelay` | `number` | No | Initial backoff delay in ms. Default: `500` |
| `config.fetch` | `typeof fetch` | No | Custom fetch implementation |

**Example:**
```typescript
const client = new DeepIDV({
  apiKey: process.env.DEEPIDV_API_KEY!,
  timeout: 15_000,
  maxRetries: 5,
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `sessions` | `Sessions` | Session management methods |
| `document` | `Document` | Document scanning methods |
| `face` | `Face` | Face detection and comparison methods |
| `identity` | `Identity` | Orchestrated identity verification |

### `on(event, listener)`

```typescript
on<K extends keyof SDKEventMap>(
  event: K,
  listener: (payload: SDKEventMap[K]) => void,
): () => void
```

Subscribe to an SDK lifecycle event. Returns an unsubscribe function.

| Parameter | Type | Description |
|-----------|------|-------------|
| `event` | `keyof SDKEventMap` | Event name |
| `listener` | `(payload) => void` | Callback |

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

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `input.firstName` | `string` | Yes | — | Applicant's first name |
| `input.lastName` | `string` | Yes | — | Applicant's last name |
| `input.email` | `string` | Yes | — | Applicant's email address |
| `input.phone` | `string` | Yes | — | Applicant's phone number |
| `input.externalId` | `string` | No | — | Your internal reference ID |
| `input.workflowId` | `string` | No | — | Workflow to use |
| `input.redirectUrl` | `string` | No | — | URL to redirect user after verification |
| `input.sendEmailInvite` | `boolean` | No | — | Send email invitation |
| `input.sendPhoneInvite` | `boolean` | No | — | Send SMS invitation |

**Returns:** `SessionCreateResult`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Session identifier |
| `sessionUrl` | `string` | Verification URL for the user |
| `externalId` | `string?` | Your external ID (if provided) |
| `links` | `{ url: string, type: string }[]` | Associated links |

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

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionId` | `string` | Yes | Session ID from `create()` |

**Returns:** `SessionRetrieveResult`

| Field | Type | Description |
|-------|------|-------------|
| `sessionRecord` | `Session` | Full session object with status, analysis data |
| `user` | `object?` | Applicant user details |
| `senderUser` | `object?` | User who created the session |
| `resourceLinks` | `Record<string, string>?` | Presigned URLs for uploaded resources |

**Throws:** `ValidationError`, `AuthenticationError`, `DeepIDVError`

**Example:**
```typescript
const result = await client.sessions.retrieve('session-id-123');
console.log(result.sessionRecord.status);
```

### `list(params?)`

```typescript
async list(params?: SessionListParams): Promise<PaginatedResponse<Session>>
```

List sessions with optional filtering and pagination.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `params.limit` | `number` | No | — | Max results per page |
| `params.offset` | `number` | No | — | Starting offset |
| `params.status` | `SessionStatus` | No | — | Filter: `PENDING`, `SUBMITTED`, `VERIFIED`, `REJECTED`, `VOIDED` |

**Returns:** `PaginatedResponse<Session>`

| Field | Type | Description |
|-------|------|-------------|
| `data` | `Session[]` | Array of sessions |
| `total` | `number?` | Total matching sessions |
| `hasMore` | `boolean?` | More pages available |
| `limit` | `number` | Page size used |
| `offset` | `number` | Starting offset |

**Example:**
```typescript
const page = await client.sessions.list({ status: 'SUBMITTED', limit: 10 });
for (const session of page.data) {
  console.log(`${session.id}: ${session.status}`);
}
```

### `updateStatus(sessionId, status)`

```typescript
async updateStatus(
  sessionId: string,
  status: 'VERIFIED' | 'REJECTED' | 'VOIDED',
): Promise<SessionRetrieveResult>
```

Update session status. Only `VERIFIED`, `REJECTED`, and `VOIDED` are valid targets.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionId` | `string` | Yes | Session ID |
| `status` | `'VERIFIED' \| 'REJECTED' \| 'VOIDED'` | Yes | New status |

**Returns:** `SessionRetrieveResult` — updated session details.

**Throws:** `ValidationError` (invalid status), `AuthenticationError`, `DeepIDVError`

**Example:**
```typescript
await client.sessions.updateStatus('session-id-123', 'VERIFIED');
```

---

## Document

Access via `client.document`.

### `scan(input)`

```typescript
async scan(input: DocumentScanInput): Promise<DocumentScanResult>
```

Scan a document image and extract structured OCR data. Handles presigned upload internally.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `input.image` | `FileInput` | Yes | — | Document image (Uint8Array, Buffer, ReadableStream, base64 string, or file path) |
| `input.documentType` | `DocumentType` | No | `'auto'` | `'passport'`, `'drivers_license'`, `'national_id'`, or `'auto'` |

**Returns:** `DocumentScanResult`

| Field | Type | Description |
|-------|------|-------------|
| `documentType` | `string` | Detected document type |
| `fullName` | `string` | Full name |
| `firstName` | `string` | First name |
| `lastName` | `string` | Last name |
| `dateOfBirth` | `string` | Date of birth |
| `gender` | `string` | Gender |
| `nationality` | `string` | Nationality |
| `documentNumber` | `string` | Document/ID number |
| `expirationDate` | `string` | Expiration date |
| `issuingCountry` | `string` | Issuing country |
| `address` | `string?` | Address (if on document) |
| `mrzData` | `string?` | Machine-readable zone |
| `faceImage` | `string?` | Extracted face (base64) |
| `rawFields` | `Record<string, string>` | All extracted fields |
| `confidence` | `number` | OCR confidence (0–1) |

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

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input.image` | `FileInput` | Yes | Image to analyze |

**Returns:** `FaceDetectResult`

| Field | Type | Description |
|-------|------|-------------|
| `faceDetected` | `boolean` | Whether a face was found |
| `confidence` | `number` | Detection confidence (0–1) |
| `boundingBox` | `{ top, left, width, height }?` | Face position |
| `landmarks` | `{ type, x, y }[]?` | Facial landmarks |

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

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input.source` | `FileInput` | Yes | Reference image |
| `input.target` | `FileInput` | Yes | Image to compare against |

**Returns:** `FaceCompareResult`

| Field | Type | Description |
|-------|------|-------------|
| `isMatch` | `boolean` | Whether faces match |
| `confidence` | `number` | Match confidence (0–1) |
| `threshold` | `number` | Match threshold |
| `sourceFaceDetected` | `boolean` | Face found in source |
| `targetFaceDetected` | `boolean` | Face found in target |

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

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input.image` | `FileInput` | Yes | Image to analyze |

**Returns:** `FaceEstimateAgeResult`

| Field | Type | Description |
|-------|------|-------------|
| `estimatedAge` | `number` | Best-estimate age |
| `ageRange` | `{ low: number, high: number }` | Confidence range |
| `gender` | `'male' \| 'female'` | Estimated gender |
| `genderConfidence` | `number` | Gender confidence (0–1) |
| `faceDetected` | `boolean` | Whether a face was found |

**Example:**
```typescript
const result = await client.face.estimateAge({ image: readFileSync('photo.jpg') });
console.log(`Age: ${result.estimatedAge} (${result.ageRange.low}–${result.ageRange.high})`);
```

---

## Identity

Access via `client.identity`.

### `verify(input)`

```typescript
async verify(input: IdentityVerifyInput): Promise<IdentityVerificationResult>
```

Full identity verification: document scan + face detection + face comparison. Both images uploaded in parallel.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `input.documentImage` | `FileInput` | Yes | — | Document image |
| `input.faceImage` | `FileInput` | Yes | — | Selfie / face image |
| `input.documentType` | `DocumentType` | No | auto-detect | `'passport'`, `'drivers_license'`, `'national_id'`, or `'auto'` |

**Returns:** `IdentityVerificationResult`

| Field | Type | Description |
|-------|------|-------------|
| `verified` | `boolean` | Overall pass/fail |
| `overallConfidence` | `number` | Aggregate confidence (0–1) |
| `document` | `IdentityDocumentResult` | Document OCR data |
| `document.documentType` | `string` | Detected type |
| `document.fullName` | `string` | Full name |
| `document.firstName` | `string` | First name |
| `document.lastName` | `string` | Last name |
| `document.dateOfBirth` | `string` | Date of birth |
| `document.gender` | `string` | Gender |
| `document.nationality` | `string` | Nationality |
| `document.documentNumber` | `string` | Document number |
| `document.expirationDate` | `string` | Expiration date |
| `document.issuingCountry` | `string` | Issuing country |
| `document.confidence` | `number` | OCR confidence |
| `faceDetection` | `IdentityFaceDetectionResult` | Face detection result |
| `faceDetection.faceDetected` | `boolean` | Face found |
| `faceDetection.confidence` | `number` | Detection confidence |
| `faceMatch` | `IdentityFaceMatchResult` | Face comparison result |
| `faceMatch.isMatch` | `boolean` | Faces match |
| `faceMatch.confidence` | `number` | Match confidence |
| `faceMatch.threshold` | `number` | Match threshold |

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
