# TypeScript Types Reference

Every public type exported by `@deepidv/server` with descriptions and their corresponding Zod schemas.

## Configuration Types

### `DeepIDVConfig`

User-provided configuration for creating a client.

```typescript
interface DeepIDVConfig {
  apiKey: string;
  baseUrl?: string; // Default: "https://api.deepidv.com"
  timeout?: number; // Default: 30000 (30s)
  uploadTimeout?: number; // Default: 120000 (2min)
  maxRetries?: number; // Default: 3
  initialRetryDelay?: number; // Default: 500 (ms)
  fetch?: typeof globalThis.fetch;
}
```

**Zod schema:** `DeepIDVConfigSchema`

### `DeepIDVOptions`

Alias for the Zod input type of `DeepIDVConfigSchema`. Equivalent to `DeepIDVConfig`.

```typescript
type DeepIDVOptions = z.input<typeof DeepIDVConfigSchema>;
```

## Session Types

### `SessionCreateInput`

Input for `client.sessions.create()`.

```typescript
interface SessionCreateInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  externalId?: string;
  workflowId?: string;
  redirectUrl?: string;
  sendEmailInvite?: boolean;
  sendPhoneInvite?: boolean;
  expiresInHours?: number; // 1–8760
}
```

**Zod schema:** `SessionCreateInputSchema`

### `SessionCreateResult`

Result from `client.sessions.create()`.

```typescript
interface SessionCreateResult {
  id: string;
  sessionUrl: string;
  externalId?: string;
  expiresAt?: string;
  links: Array<{ rel: string; href: string; description?: string }>;
}
```

### `Session`

Full session record returned in retrieve/list results.

```typescript
interface Session {
  id: string;
  organizationId: string;
  userId: string;
  senderUserId: string;
  externalId?: string;
  status: string;
  type: string;
  sessionProgress: string;
  location?: string | null;
  workflowId?: string;
  workflowSteps?: string[];
  bankStatementRequestId?: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  metaData?: Record<string, unknown>;
  uploads?: Record<string, boolean>;
  analysisData?: Record<string, unknown>;
}
```

### `SessionRetrieveResult`

Result from `client.sessions.retrieve()`.

```typescript
interface SessionRetrieveResult {
  sessionRecord: Session;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    createdAt: string;
    updatedAt: string;
  };
  senderUser?: {
    /* same shape as user */
  };
  resourceLinks: Record<string, string>;
}
```

### `SessionListParams`

Input for `client.sessions.list()`.

```typescript
interface SessionListParams {
  limit?: number; // 1–500
  nextToken?: string;
  startDate?: string;
  endDate?: string;
  byOrganization?: boolean | null;
  externalId?: string;
  workflowId?: string;
}
```

**Zod schema:** `SessionListParamsSchema`

### `SessionStatusUpdate`

Valid values for `client.sessions.updateStatus()`.

```typescript
type SessionStatusUpdate = 'VERIFIED' | 'REJECTED';
```

**Zod schema:** `SessionStatusUpdateSchema`

## Document Types

### `DocumentScanInput`

Input for `client.document.scan()`.

```typescript
interface DocumentScanInput {
  image: FileInput;
  documentType?: DocumentType; // Default: 'auto'
}
```

**Zod schema:** `DocumentScanInputSchema`

### `DocumentScanResult`

Result from `client.document.scan()`.

```typescript
interface DocumentScanResult {
  documentType: string;
  fullName: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  documentNumber: string;
  expirationDate: string;
  issuingCountry: string;
  address?: string;
  mrzData?: string;
  faceImage?: string;
  rawFields: Record<string, string>;
  confidence: number;
}
```

**Zod schema:** `DocumentScanResultSchema` (uses `.strip()` for forward compatibility)

### `DocumentType`

```typescript
type DocumentType = 'passport' | 'drivers_license' | 'national_id' | 'auto';
```

**Zod schema:** `DocumentTypeSchema`

## Face Types

### `FaceDetectInput`

```typescript
interface FaceDetectInput {
  image: FileInput;
}
```

**Zod schema:** `FaceDetectInputSchema`

### `FaceDetectResult`

```typescript
interface FaceDetectResult {
  faceDetected: boolean;
  confidence: number;
  boundingBox?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  landmarks?: Array<{
    type: string;
    x: number;
    y: number;
  }>;
}
```

**Zod schema:** `FaceDetectResultSchema`

### `FaceCompareInput`

```typescript
interface FaceCompareInput {
  source: FileInput;
  target: FileInput;
}
```

**Zod schema:** `FaceCompareInputSchema`

### `FaceCompareResult`

```typescript
interface FaceCompareResult {
  isMatch: boolean;
  confidence: number;
  threshold: number;
  sourceFaceDetected: boolean;
  targetFaceDetected: boolean;
}
```

**Zod schema:** `FaceCompareResultSchema`

### `FaceEstimateAgeInput`

```typescript
interface FaceEstimateAgeInput {
  image: FileInput;
}
```

**Zod schema:** `FaceEstimateAgeInputSchema`

### `FaceEstimateAgeResult`

```typescript
interface FaceEstimateAgeResult {
  estimatedAge: number;
  ageRange: { low: number; high: number };
  gender: Gender;
  genderConfidence: number;
  faceDetected: boolean;
}
```

**Zod schema:** `FaceEstimateAgeResultSchema`

### `Gender`

```typescript
type Gender = 'male' | 'female';
```

**Zod schema:** `GenderSchema`

## Identity Types

### `IdentityVerifyInput`

```typescript
interface IdentityVerifyInput {
  documentImage: FileInput;
  faceImage: FileInput;
  documentType?: 'passport' | 'drivers_license' | 'national_id' | 'auto';
}
```

**Zod schema:** `IdentityVerifyInputSchema`

### `IdentityVerificationResult`

```typescript
interface IdentityVerificationResult {
  verified: boolean;
  document: IdentityDocumentResult;
  faceDetection: IdentityFaceDetectionResult;
  faceMatch: IdentityFaceMatchResult;
  overallConfidence: number;
}
```

**Zod schema:** `IdentityVerificationResultSchema`

### `IdentityDocumentResult`

```typescript
interface IdentityDocumentResult {
  documentType: string;
  fullName: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  documentNumber: string;
  expirationDate: string;
  issuingCountry: string;
  address?: string;
  faceImage?: string;
  confidence: number;
}
```

**Zod schema:** `IdentityDocumentResultSchema`

### `IdentityFaceDetectionResult`

```typescript
interface IdentityFaceDetectionResult {
  faceDetected: boolean;
  confidence: number;
}
```

**Zod schema:** `IdentityFaceDetectionResultSchema`

### `IdentityFaceMatchResult`

```typescript
interface IdentityFaceMatchResult {
  isMatch: boolean;
  confidence: number;
  threshold: number;
}
```

**Zod schema:** `IdentityFaceMatchResultSchema`

## Screening and Async-Job Types

`PepSanctionsInput` and `PepSanctionsResult` describe the synchronous PEP and sanctions operation. `TitleCheckInput` and `TitleCheckResult` describe the synchronous title/property search. `AdverseMediaInput` accepts an optional `idempotencyKey`, which is sent as the `Idempotency-Key` header rather than in the request body.

`AdverseMediaHandle` exposes:

```typescript
interface AsyncResultHandle<TResult, TSnapshot> {
  readonly jobId: string;
  refresh(): Promise<TSnapshot>;
  wait(options?: { pollIntervalMs?: number; timeoutMs?: number }): Promise<TResult>;
}
```

`AsyncJobSnapshot` is a discriminated union with `pending`, `processing`, `ready`, and `failed` statuses. Ready snapshots contain `result`; failed snapshots contain `error`.

## Common Types

### `FileInput`

Accepted input types for image parameters.

```typescript
type FileInput = Uint8Array | ReadableStream<Uint8Array> | string;
```

- `Uint8Array` — raw bytes (Node `Buffer` extends `Uint8Array`)
- `ReadableStream<Uint8Array>` — streaming input (materialized before upload)
- `string` — data URL, base64, or file path

### `SessionListResult`

Cursor-paginated session response.

```typescript
interface SessionListResult {
  sessions: Session[];
  nextToken: string | null;
}
```

### `RawResponse`

Raw HTTP response attached to errors for debugging.

```typescript
interface RawResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}
```

## Error Types

All error classes are exported from `@deepidv/server`:

```typescript
import {
  DeepIDVError, // Base class (status, code, response, toJSON)
  AuthenticationError, // 401 (redactedKey)
  RateLimitError, // 429 (retryAfter)
  ValidationError, // 400
  NetworkError, // Connection failures
  TimeoutError, // Timeout exceeded
} from '@deepidv/server';
```

See [Error Handling](../architecture/ERROR-HANDLING.md) for full details.

## Event Types

### `SDKEventMap`

```typescript
type SDKEventMap = {
  request: { method: string; url: string };
  response: { status: number; url: string; durationMs: number };
  retry: { attempt: number; delayMs: number; error: unknown };
  error: { error: unknown };
  warning: { message: string; error: unknown };
  'upload:start': { url: string; bytes: number; contentType: string };
  'upload:complete': { url: string; contentType: string };
};
```

See [Event System](../architecture/EVENT-SYSTEM.md) for full details.
