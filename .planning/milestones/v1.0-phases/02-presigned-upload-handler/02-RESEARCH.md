# Phase 2: Presigned Upload Handler - Research

**Researched:** 2026-04-05
**Domain:** File input normalization, magic-byte content-type detection, presigned URL upload orchestration, Zod v4 validation, S3 PUT via native fetch
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**File Input Normalization**
- **D-01:** Single `toUint8Array()` function normalizes all input types to `Uint8Array` before upload. Detects input type and converts: Uint8Array passes through, base64 is decoded, file path uses conditional `fs.readFile` on Node/Deno/Bun, ReadableStream is materialized (UPL-06).
- **D-02:** `FileInput` type is `Uint8Array | ReadableStream | string` only — no `Buffer` in the union. Node Buffers pass the `instanceof Uint8Array` check naturally. Avoids importing Buffer (doesn't exist on edge runtimes).
- **D-03:** File path vs base64 string detection uses prefix convention: strings starting with `data:` are data URLs; strings matching base64 character pattern with length > 256 are raw base64; everything else is treated as a file path.
- **D-04:** On edge runtimes where `fs` is unavailable, passing a file path string throws `ValidationError` immediately with message: "File path input requires Node.js, Deno, or Bun. Pass Buffer or Uint8Array on edge runtimes." (COMPAT-04)

**Content-Type Detection**
- **D-05:** Magic byte sniffing detects JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), and WebP (`52 49 46 46...57 45 42 50`) from the first 12 bytes of the normalized `Uint8Array`. Throws `ValidationError` if format is unrecognized.
- **D-06:** Optional `contentType` field in upload options allows caller override. When provided, skip auto-detection and use the caller's value.

**Upload Timeout & Retry**
- **D-07:** New `uploadTimeout` field added to `DeepIDVConfig` (default: 120,000ms / 2 minutes). Separate from API request `timeout` (30s). S3 PUTs use `uploadTimeout`, presign API calls use `timeout`.
- **D-08:** S3 PUTs retry on 5xx and network errors using the same exponential backoff policy as API calls. 403 (expired presigned URL) throws immediately — never retry. Other 4xx throw immediately.
- **D-09:** `FileUploader` uses raw `config.fetch` for S3 PUT requests, not `HttpClient`. S3 PUTs don't need x-api-key headers, JSON parsing, or API error mapping. Presign requests go through `HttpClient` as normal.

**Zod Validation Pattern**
- **D-10:** Zod schemas are co-located with their module — `uploader.ts` defines upload schemas at the top.
- **D-11:** `z.infer<typeof Schema>` is the single source of truth for TypeScript types. No separate interface definitions for validated inputs. (VAL-03)
- **D-12:** Zod validation errors are caught and mapped to `ValidationError` from the existing error hierarchy. First issue's path and message extracted: `"{message} at '{path}'"`. Raw `ZodError` attached as `cause`. (VAL-02)

### Claude's Discretion

None — all areas discussed and decided.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UPL-01 | Presigned URL upload handler: POST `/v1/uploads/presign` → PUT to S3 → return `fileKey` | Presign flow verified against build guide; `HttpClient.post()` for presign, raw `config.fetch` for S3 PUT |
| UPL-02 | Accept `Buffer`, `Uint8Array`, `ReadableStream`, file path string, and base64 string as file inputs | `Buffer instanceof Uint8Array` verified true in Node; `toUint8Array()` normalization pattern researched |
| UPL-03 | Content-type detection from input (JPEG, PNG, WebP) and alignment with presign request | Magic byte patterns verified by test; 12-byte detection window sufficient for all three formats |
| UPL-04 | Parallel batch presigned uploads for multi-file operations via `Promise.all` | `Promise.all` parallel pattern verified; one presign with `count:N` returns array |
| UPL-05 | Separate configurable timeout for S3 uploads (independent of API request timeout) | `uploadTimeout` field added to `DeepIDVConfig`; `AbortController` pattern reused from Phase 1 |
| UPL-06 | ReadableStream materialization before upload (prevent double-read zero-byte bug) | `reader.read()` loop pattern verified; materializes once at SDK boundary |
| UPL-07 | Zero AWS SDK dependency — all S3 interaction via native `fetch` with presigned URLs | Raw `config.fetch` used for S3 PUT; no AWS SDK imports at all |
| VAL-01 | Zod schemas validate all public method inputs before network calls | Zod v4.3.6 confirmed in project; schemas run `schema.parse()` before any fetch call |
| VAL-02 | Clear error messages with param name and expected type | Zod v4 `issue.message` already includes type info; `message at 'path'` format verified |
| VAL-03 | Zod schemas infer TypeScript types (single source of truth) | `z.infer<typeof Schema>` pattern verified; no duplicate interface definitions |
</phase_requirements>

---

## Summary

Phase 2 builds `FileUploader` in `@deepidv/core`. The class has one public method (`upload(inputs, options)`) that normalizes any supported file input to `Uint8Array`, detects content type via magic bytes, calls `POST /v1/uploads/presign` through `HttpClient`, and PUTs each file to S3 in parallel via raw `config.fetch`. The result is an array of `fileKey` strings consumed by later service modules.

All architectural decisions were locked in CONTEXT.md during the discuss phase. Research validated the Zod v4 API (the project uses Zod 4.3.6, not v3), confirmed the `Buffer instanceof Uint8Array` property, verified ReadableStream materialization patterns, tested the magic byte detection logic, and confirmed the `withRetry` + `isRetryable` re-use strategy for S3 PUT retries.

One important nuance: Zod v4 error messages already include the "Invalid input: expected X, received Y" prefix internally. The D-12 format `"{message} at '{path}'"` should use `issue.message` directly (not prepend "Invalid input:" again). The verified output for a failed `z.instanceof(Uint8Array)` parse is `"Invalid input: expected Uint8Array, received string at 'image'"`.

**Primary recommendation:** Implement `FileUploader` with `upload(inputs: FileInput | FileInput[], options?: UploadOptions): Promise<string[]>` as the single public method. All normalization, detection, presigning, and uploading is internal.

---

## Standard Stack

### Core (already installed in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | 4.3.6 | Schema validation + type inference | Single production dependency; `z.infer<>` eliminates duplicate type declarations |
| vitest | 4.1.2 | Test runner | Already configured in `packages/core/vitest.config.ts` |
| msw | 2.12.14 | HTTP mocking | Already in `packages/core/__tests__/setup.ts`; intercepts any URL including S3 |

**Version verification:** All versions confirmed from `packages/core/package.json` — no npm lookup needed.

### Supporting (built-ins, zero-install)

| API | Runtime | Purpose |
|-----|---------|---------|
| `globalThis.atob` | Node 18+, Deno, Bun, CF Workers | Decode base64 strings without Buffer or external libs |
| `ReadableStream.getReader()` | All targets | Materialize stream to `Uint8Array` chunks |
| `AbortController` | All targets | Per-attempt upload timeout (same pattern as Phase 1 D-01) |
| `Promise.all` | All targets | Parallel S3 PUTs (UPL-04) |
| `import('fs/promises')` | Node/Deno/Bun only | Dynamic conditional import — never imported on edge runtimes |

**Installation:** No new packages needed. All dependencies are already in `packages/core/package.json`.

---

## Architecture Patterns

### Recommended Project Structure (new files)

```
packages/core/src/
├── uploader.ts         # NEW: FileUploader class + Zod schemas + toUint8Array()
├── config.ts           # MODIFY: add uploadTimeout to DeepIDVConfig + ResolvedConfig
├── events.ts           # MODIFY: add upload:start, upload:complete to SDKEventMap
├── index.ts            # MODIFY: export FileUploader, FileInput, UploadOptions, PresignResponse
└── __tests__/
    └── uploader.test.ts  # NEW: FileUploader unit tests with msw
```

### Pattern 1: `toUint8Array()` — Input Normalization (D-01 through D-04)

**What:** Pure async function that accepts `FileInput` and returns `Promise<Uint8Array>`. All detection and conversion happens here. `FileUploader` never works with raw FileInput after calling this.

**When to use:** Called once per input item, at the SDK boundary, before magic byte detection.

```typescript
// Source: verified by experiment + build guide spec
export type FileInput = Uint8Array | ReadableStream | string;

async function toUint8Array(input: FileInput): Promise<Uint8Array> {
  // Uint8Array (and Buffer via instanceof): pass through
  if (input instanceof Uint8Array) return input;

  // ReadableStream: materialize once (UPL-06)
  if (input instanceof ReadableStream) {
    return materializeStream(input);
  }

  // string: detect subtype (D-03)
  if (input.startsWith('data:')) {
    // data URL: strip header, decode base64
    const b64 = input.replace(/^data:[^,]+,/, '');
    return base64ToUint8Array(b64);
  }

  const isBase64 = /^[A-Za-z0-9+/]+=*$/.test(input) && input.length > 256;
  if (isBase64) {
    return base64ToUint8Array(input);
  }

  // file path: conditional fs (D-04)
  return readFilePath(input);
}
```

### Pattern 2: `materializeStream()` — ReadableStream Consumption (UPL-06)

**What:** Reads all chunks from a `ReadableStream` into a single `Uint8Array`. The stream's reader is consumed exactly once — calling this twice on the same stream throws `TypeError: ReadableStream is locked`.

**Why:** Prevents the double-read zero-byte bug where a stream is passed to fetch directly and accidentally re-read.

```typescript
// Source: verified by experiment in Node 22
async function materializeStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
```

### Pattern 3: `base64ToUint8Array()` — Runtime-Agnostic Base64 Decode

**What:** Uses `globalThis.atob` which is available on Node 18+, Deno, Bun, and CF Workers. No `Buffer` dependency.

```typescript
// Source: verified by experiment — atob available as globalThis.atob in Node 22
function base64ToUint8Array(b64: string): Uint8Array {
  const binary = globalThis.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
```

### Pattern 4: `readFilePath()` — Conditional `fs` Import (D-04)

**What:** Detects filesystem availability at runtime. On edge runtimes, throws `ValidationError` immediately with a clear message.

```typescript
// Source: verified runtime detection approach — process.versions.node absent on CF Workers
async function readFilePath(path: string): Promise<Uint8Array> {
  const isNodeLike =
    typeof process !== 'undefined' && process.versions?.node !== undefined;
  const isDeno = typeof Deno !== 'undefined';
  const isBun = typeof Bun !== 'undefined';

  if (!isNodeLike && !isDeno && !isBun) {
    throw new ValidationError(
      "File path input requires Node.js, Deno, or Bun. Pass Buffer or Uint8Array on edge runtimes.",
    );
  }

  // Dynamic import avoids bundler inclusion on edge runtimes
  const { readFile } = await import('fs/promises');
  const buffer = await readFile(path);
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}
```

### Pattern 5: `detectContentType()` — Magic Byte Sniffing (D-05)

**What:** Reads the first 12 bytes of normalized `Uint8Array`. Throws `ValidationError` on unknown format.

```typescript
// Source: verified by experiment — JPEG/PNG/WebP magic bytes confirmed correct
type SupportedContentType = 'image/jpeg' | 'image/png' | 'image/webp';

function detectContentType(bytes: Uint8Array): SupportedContentType {
  if (bytes.length < 4) {
    throw new ValidationError('File is too small to detect content type (minimum 4 bytes).');
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image/png';
  }

  // WebP: RIFF....WEBP (bytes 0-3 = RIFF, bytes 8-11 = WEBP)
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  throw new ValidationError(
    'Unsupported image format. Accepted formats: JPEG, PNG, WebP.',
  );
}
```

### Pattern 6: Zod Schema Definition + ValidationError Mapping (D-10, D-11, D-12)

**What:** Schemas co-located in `uploader.ts`. `z.infer<>` provides TypeScript types. Zod errors mapped to `ValidationError` with `cause` chaining.

**Important:** Zod v4 `issue.message` already includes type information (e.g., "Invalid input: expected Uint8Array, received string"). The D-12 format extracts `issue.message` directly and appends the path — do NOT prepend "Invalid input:" again or you will get a doubled prefix.

```typescript
// Source: verified by experiment with Zod 4.3.6
import { z, ZodError } from 'zod';
import { ValidationError } from './errors.js';

const UploadOptionsSchema = z.object({
  contentType: z.string().optional(),
});

export type UploadOptions = z.infer<typeof UploadOptionsSchema>;

function mapZodError(err: ZodError): ValidationError {
  const issue = err.issues[0];
  // issue.message already contains "Invalid input: expected X, received Y" in Zod v4
  const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
  return new ValidationError(`${issue.message} at '${path}'`, { cause: err });
}

function validateUploadOptions(raw: unknown): UploadOptions {
  try {
    return UploadOptionsSchema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) throw mapZodError(err);
    throw err;
  }
}
```

### Pattern 7: `FileUploader` Class Structure

**What:** Constructor takes `ResolvedConfig`, `HttpClient`, and `TypedEmitter`. Single public method `upload()` accepts one or more `FileInput` values plus options, and returns `fileKey[]`.

```typescript
// Source: build guide spec + CONTEXT.md decisions
export class FileUploader {
  constructor(
    private readonly config: ResolvedConfig,
    private readonly httpClient: HttpClient,
    private readonly emitter: TypedEmitter<SDKEventMap>,
  ) {}

  /**
   * Uploads one or more files via presigned URL flow.
   * Returns an array of fileKeys in the same order as inputs.
   */
  async upload(
    inputs: FileInput | FileInput[],
    options?: UploadOptions,
  ): Promise<string[]> {
    const opts = validateUploadOptions(options ?? {});
    const inputArray = Array.isArray(inputs) ? inputs : [inputs];

    // 1. Normalize all inputs to Uint8Array (materialization happens here)
    const byteArrays = await Promise.all(inputArray.map(toUint8Array));

    // 2. Detect or use caller-provided content type
    const contentTypes = byteArrays.map(bytes =>
      opts.contentType ?? detectContentType(bytes),
    );

    // 3. Request presigned URLs (one API call for all files)
    const presignResponse = await this.httpClient.post<PresignResponse>(
      '/v1/uploads/presign',
      { contentType: contentTypes[0], count: inputArray.length },
    );

    // 4. PUT each file to S3 in parallel
    await Promise.all(
      presignResponse.uploads.map((upload, i) =>
        this._putToS3(upload.uploadUrl, byteArrays[i]!, contentTypes[i]!),
      ),
    );

    return presignResponse.uploads.map(u => u.fileKey);
  }
}
```

### Pattern 8: S3 PUT with Retry (D-08, D-09)

**What:** Raw `config.fetch` (no auth headers, no JSON). `withRetry` wraps the attempt. Status codes mapped to SDK error types so `isRetryable` works correctly.

```typescript
// Source: decisions D-08, D-09 + verified isRetryable behavior
private async _putToS3(
  url: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  await withRetry(
    () => this._attemptPut(url, bytes, contentType),
    { maxRetries: this.config.maxRetries, initialDelayMs: this.config.initialRetryDelay },
    this.emitter,
  );
}

private async _attemptPut(
  url: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const controller = new AbortController();
  const timeoutMs = this.config.uploadTimeout;
  const id = setTimeout(() => controller.abort(), timeoutMs);

  this.emitter.emit('upload:start', { url, bytes: bytes.length, contentType });

  try {
    let response: Response;
    try {
      response = await this.config.fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: bytes,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new TimeoutError(`Upload timed out after ${timeoutMs}ms`, { cause: err });
      }
      throw new NetworkError(
        err instanceof Error ? err.message : 'S3 upload network error',
        { cause: err },
      );
    }

    if (response.ok) {
      this.emitter.emit('upload:complete', { url, contentType });
      return;
    }

    // 403: expired presigned URL — throw immediately (D-08)
    if (response.status === 403) {
      throw new DeepIDVError('Presigned URL has expired or is invalid.', {
        status: 403,
        code: 'upload_url_expired',
      });
    }

    // 5xx: wrap in NetworkError so isRetryable returns true (D-08)
    if (response.status >= 500) {
      throw new NetworkError(`S3 upload failed: HTTP ${response.status}`);
    }

    // Other 4xx: throw immediately
    throw new DeepIDVError(`S3 upload failed: HTTP ${response.status}`, {
      status: response.status,
      code: 'upload_error',
    });
  } finally {
    clearTimeout(id);
  }
}
```

### Pattern 9: `config.ts` Changes (D-07)

**What:** Add `uploadTimeout` to `DeepIDVConfig` (optional) and `ResolvedConfig` (required). Add `DEFAULT_UPLOAD_TIMEOUT` constant.

```typescript
// Add to config.ts
export const DEFAULT_UPLOAD_TIMEOUT = 120_000; // 2 minutes (D-07)

// Add to DeepIDVConfig interface:
/**
 * Per-attempt timeout for S3 uploads in milliseconds. Defaults to 120_000 (2 min).
 * Separate from API request timeout (D-07).
 */
uploadTimeout?: number;

// Add to ResolvedConfig interface:
uploadTimeout: number;

// Add to resolveConfig():
uploadTimeout: config.uploadTimeout ?? DEFAULT_UPLOAD_TIMEOUT,
```

### Pattern 10: `events.ts` Changes (EVT-01)

**What:** Add `upload:start` and `upload:complete` event types to `SDKEventMap`.

```typescript
// Add to SDKEventMap:
'upload:start': { url: string; bytes: number; contentType: string };
'upload:complete': { url: string; contentType: string };
```

### Anti-Patterns to Avoid

- **Importing `Buffer` directly:** `Buffer` is not available on CF Workers. D-02 is explicit: no `Buffer` in the `FileInput` union. Node `Buffer` passes `instanceof Uint8Array` naturally — no explicit handling needed.
- **Streaming body to S3 fetch:** Passing a `ReadableStream` directly to fetch body bypasses materialization. Always normalize to `Uint8Array` first (the `toUint8Array()` call in `upload()` does this before any PUT).
- **Reusing `HttpClient` for S3 PUTs:** `HttpClient` injects `x-api-key` and expects JSON responses. S3 presigned URLs need neither. Use raw `config.fetch` directly.
- **Single presign call per file:** The presign API supports `count: N`. For batch uploads, always use one presign call. Never loop `count: 1`.
- **Calling `toUint8Array` inside `_attemptPut`:** Materialization of `ReadableStream` must happen once before retry loop. If called inside retry, the stream would be exhausted after the first attempt.
- **Prepending "Invalid input:" to Zod error messages:** Zod v4 messages already include this prefix. The D-12 pattern uses `issue.message` directly: `"${issue.message} at '${path}'"`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Retry with backoff for S3 PUTs | Custom retry loop | `withRetry()` from `retry.ts` | Identical policy needed; jitter + Retry-After already handled |
| Zod error formatting | Custom message builder | `ZodError.issues[0].message + path` | Zod v4 already includes type info in message; extracting `issue.message` is sufficient |
| AbortController timeout for uploads | Custom timeout mechanism | Same `AbortController` pattern from Phase 1 D-01 | Established pattern; works on all target runtimes |
| Base64 decode | `Buffer.from(b64, 'base64')` | `globalThis.atob()` | `atob` available on all targets; `Buffer` is Node-only |
| Content-type detection library | `file-type` npm package | 12-byte magic byte check | Zero-dep; only 3 formats needed; straightforward |

**Key insight:** Phase 1 established patterns that Phase 2 reuses almost exactly. The S3 PUT is structurally identical to `HttpClient._attempt()` minus auth headers and JSON parsing.

---

## Common Pitfalls

### Pitfall 1: Double-Read Zero-Byte Bug (UPL-06)
**What goes wrong:** A `ReadableStream` passed to `toUint8Array()` is consumed once. If `_attemptPut` is called inside `withRetry` with the original `ReadableStream` instead of the normalized `Uint8Array`, the second retry attempt reads from an exhausted stream and sends 0 bytes.
**Why it happens:** Retry loops re-invoke their wrapped function. If stream materialization is inside the retried function, only the first attempt gets real bytes.
**How to avoid:** `toUint8Array()` runs once in `upload()` before the retry loop. `_attemptPut` only receives `Uint8Array` — never `FileInput`.
**Warning signs:** Tests for retry that pass a ReadableStream see the second attempt upload 0 bytes to S3.

### Pitfall 2: Zod v4 Message Double-Prefix (VAL-02)
**What goes wrong:** The D-12 spec says format is `"Invalid input: {message} at '{path}'"`. In Zod v4, `issue.message` already starts with `"Invalid input: expected X, received Y"`. If you prepend `"Invalid input: "` again, you get `"Invalid input: Invalid input: expected Uint8Array, received string at 'image'"`.
**Why it happens:** The spec was written thinking of a custom message. Zod v4 changed from v3 in that error messages include the full "Invalid input:" prefix internally.
**How to avoid:** Use `"${issue.message} at '${path}'"` directly without any prefix addition.
**Warning signs:** ValidationError messages have doubled "Invalid input:" prefix in test assertions.

### Pitfall 3: `withRetry` + `isRetryable` for S3 Non-DeepIDVError
**What goes wrong:** `isRetryable()` checks `instanceof DeepIDVError`. A raw S3 5xx response status is just an HTTP Response object — it won't be retried unless wrapped.
**Why it happens:** `withRetry` was designed for `HttpClient` where all responses are pre-mapped to SDK error types. S3 responses are raw fetch responses.
**How to avoid:** `_attemptPut` manually maps: 5xx → `new NetworkError(...)`, 403 → `new DeepIDVError(...)`, network errors → `new NetworkError(...)`. This makes `isRetryable` work correctly without any changes to `retry.ts`.
**Warning signs:** S3 5xx responses are not retried in tests despite retry being configured.

### Pitfall 4: Magic Byte Buffer Too Small
**What goes wrong:** A 3-byte file (or truncated upload) passes the JPEG check (which only needs 3 bytes) but fails later in S3 or API processing.
**Why it happens:** No minimum size validation before detection.
**How to avoid:** Require `bytes.length >= 4` before any magic byte check. Throw `ValidationError` if too small. In practice, any real image will be many kilobytes.
**Warning signs:** 3-byte Uint8Array is detected as JPEG without error.

### Pitfall 5: Batch Presign Assumes Same Content Type
**What goes wrong:** The presign API request sends `{ contentType, count }`. If a batch contains mixed types (one JPEG + one PNG), sending only one `contentType` may cause issues.
**Why it happens:** The build guide spec shows `{ contentType: "image/jpeg", count: 1 }` but doesn't explicitly document mixed-type batches.
**How to avoid:** For Phase 2, the presign request sends the first file's `contentType` and `count: N`. Service modules (Phase 4+) typically call `FileUploader` with files of the same type. If mixed-type batches are needed in the future, the API would need to accept `contentTypes: string[]` — defer to a blocker note.
**Warning signs:** Mixed JPEG+PNG batch test returns wrong content-type assignments.

### Pitfall 6: `fs/promises` Dynamic Import on CF Workers Build
**What goes wrong:** Even though `readFilePath` conditionally imports `fs/promises`, some bundlers (tsup/esbuild) may try to resolve and bundle the import at build time, including Node-specific code in the edge bundle.
**Why it happens:** Static analysis of `import()` expressions by bundlers.
**How to avoid:** tsup with `platform: 'neutral'` or CF Workers entry should mark `fs/promises` as external. Verify `packages/core/tsup.config.ts` handles this. The runtime check (no `process.versions.node`) ensures the code path never executes on edge, even if the import is included.
**Warning signs:** CF Workers deploy fails with "fs module not found" error.

---

## Code Examples

### Verified: `PresignResponse` Type Shape

```typescript
// Source: build guide lines 192-196 + CONTEXT.md specifics
interface PresignResponse {
  uploads: Array<{
    uploadUrl: string;
    fileKey: string;
  }>;
}
```

### Verified: Full Presign API Request

```typescript
// Source: build guide lines 191-196
// POST /v1/uploads/presign
// Request:  { contentType: "image/jpeg", count: 2 }
// Response: { uploads: [{ uploadUrl: "https://s3...", fileKey: "abc123" }, { uploadUrl: "...", fileKey: "def456" }] }
```

### Verified: Zod v4 `ZodError` Issue Shape

```typescript
// Source: verified by experiment with Zod 4.3.6
// e.issues[0] for a failed z.instanceof(Uint8Array) with string input:
{
  code: "invalid_type",
  expected: "Uint8Array",
  path: ["image"],
  message: "Invalid input: expected Uint8Array, received string"
}
// For nested path: issue.path = ["user", "age"] → join('.') = "user.age"
```

### Verified: Parallel Batch Upload with `Promise.all`

```typescript
// Source: verified timing — parallel is measurably faster than sequential
await Promise.all(
  presignResponse.uploads.map((upload, i) =>
    this._putToS3(upload.uploadUrl, byteArrays[i]!, contentTypes[i]!),
  ),
);
```

### Verified: msw Handler for S3 PUT in Tests

```typescript
// Source: msw 2.12.14 — intercepts any URL including S3
import { http, HttpResponse } from 'msw';
server.use(
  http.put('https://s3.amazonaws.com/*', () => {
    return new HttpResponse(null, { status: 200 });
  }),
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zod v3 error messages lack prefix | Zod v4 `issue.message` includes "Invalid input: expected X" | Zod v4 release | D-12 implementation: don't prepend prefix, use message directly |
| `Buffer.from(b64, 'base64')` for base64 decode | `globalThis.atob()` | Node 16+ | Enables edge runtime compatibility |
| `require('fs')` for file reads | Dynamic `import('fs/promises')` | Node 14+ ESM | Bundler can exclude from edge builds |

**Deprecated/outdated:**
- CLAUDE.md references Zod `^3.23` — the project is actually using Zod 4.3.6 (TypeScript 6.0 is also being used). All research uses the installed Zod v4 API.

---

## Open Questions

1. **Mixed content types in batch presign**
   - What we know: API takes `{ contentType: string, count: N }` — one type for the whole batch.
   - What's unclear: Does the API support `{ contentTypes: string[], count: N }` or per-upload content types?
   - Recommendation: For Phase 2, use first file's content type for the whole batch. Service modules (Phase 4) control this and will always pass same-type files. Document as a blocker comment in code if needed.

2. **`fs/promises` dynamic import and tsup bundling**
   - What we know: tsup bundles `import()` expressions; CF Workers entrypoint may include Node-specific code.
   - What's unclear: Whether the existing `packages/core/tsup.config.ts` marks `fs/promises` as external.
   - Recommendation: Check the tsup config when implementing. If needed, add `external: ['fs/promises']` or `platform: 'node'` vs `'neutral'` targeting.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | v22.18.0 | — |
| zod | Validation | Yes | 4.3.6 | — |
| vitest | Tests | Yes | 4.1.2 | — |
| msw | HTTP mocking in tests | Yes | 2.12.14 | — |
| globalThis.atob | Base64 decode | Yes (Node 18+) | built-in | — |
| fs/promises | File path reads | Yes (Node-only) | built-in | Throw ValidationError on edge |
| ReadableStream | Stream materialization | Yes | built-in | — |
| AbortController | Upload timeout | Yes | built-in | — |

No missing dependencies.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 |
| Config file | `packages/core/vitest.config.ts` |
| Quick run command | `pnpm --filter @deepidv/core test` |
| Full suite command | `pnpm --filter @deepidv/core test --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UPL-01 | `upload()` calls `POST /v1/uploads/presign` then `PUT` to S3, returns `fileKey` | unit | `pnpm --filter @deepidv/core test uploader` | ❌ Wave 0 |
| UPL-02 | Buffer, Uint8Array, ReadableStream, file path, base64 all produce non-empty `fileKey` | unit | `pnpm --filter @deepidv/core test uploader` | ❌ Wave 0 |
| UPL-03 | JPEG/PNG/WebP magic bytes produce correct `contentType` in presign request | unit | `pnpm --filter @deepidv/core test uploader` | ❌ Wave 0 |
| UPL-04 | Two-file batch issues one presign (`count:2`) and two parallel PUTs | unit | `pnpm --filter @deepidv/core test uploader` | ❌ Wave 0 |
| UPL-05 | Upload timeout fires `TimeoutError` independently of API timeout | unit | `pnpm --filter @deepidv/core test uploader` | ❌ Wave 0 |
| UPL-06 | ReadableStream materialized once; second read attempt throws | unit | `pnpm --filter @deepidv/core test uploader` | ❌ Wave 0 |
| UPL-07 | No `aws-sdk` import; S3 PUT has no `x-api-key` header | unit | verify import graph + msw handler assertion | ❌ Wave 0 |
| VAL-01 | Missing required field throws `ValidationError` before any fetch | unit | `pnpm --filter @deepidv/core test uploader` | ❌ Wave 0 |
| VAL-02 | `ValidationError.message` contains param name and type info | unit | `pnpm --filter @deepidv/core test uploader` | ❌ Wave 0 |
| VAL-03 | No duplicate TypeScript interface — type derived from `z.infer<>` | compile-time | `pnpm --filter @deepidv/core build` (tsc type check) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @deepidv/core test --run`
- **Per wave merge:** `pnpm --filter @deepidv/core test --run && pnpm --filter @deepidv/core build`
- **Phase gate:** All tests green + build succeeds before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/core/src/__tests__/uploader.test.ts` — covers UPL-01 through UPL-07, VAL-01, VAL-02
- [ ] No new framework config or shared fixture changes needed (existing `setup.ts` server and msw setup is reused)

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 2 |
|-----------|------------------|
| No Node-specific APIs in core | `fs/promises` only via dynamic `import()` with runtime detection; `Buffer` never imported |
| Zero AWS SDKs | S3 PUTs use raw `config.fetch` only — no `@aws-sdk/*` anywhere |
| Only zod as production dependency | No `file-type`, `mime`, or other type-detection packages |
| `strict: true`, zero `any` | All Zod schemas use `z.infer<>` for types; no `any` casts |
| Full JSDoc on all public API surface | `FileUploader.upload()`, `FileInput`, `UploadOptions`, `PresignResponse` need JSDoc |
| x-api-key on every API request | Via `HttpClient` for presign call; NOT on S3 PUT |
| Retry: exponential backoff + jitter on 429 and 5xx only | Reuse `withRetry` + `isRetryable`; S3 403 must throw immediately |
| Build output: dual ESM + CJS via tsup | `FileUploader` exported from `packages/core/src/index.ts` |
| GSD Workflow Enforcement | All file changes must happen within `/gsd:execute-phase` workflow |

---

## Sources

### Primary (HIGH confidence)

- `packages/core/src/config.ts` — Exact interface shape for `DeepIDVConfig` and `ResolvedConfig`
- `packages/core/src/errors.ts` — `ValidationError`, `NetworkError`, `TimeoutError`, `DeepIDVError` constructors
- `packages/core/src/retry.ts` — `withRetry`, `isRetryable` signatures; reuse confirmed
- `packages/core/src/client.ts` — `HttpClient._attempt()` pattern replicated for `_attemptPut()`
- `packages/core/src/events.ts` — `SDKEventMap` type for new upload events
- `packages/core/package.json` — Zod 4.3.6, vitest 4.1.2, msw 2.12.14 versions confirmed
- `deepidv-sdk-build-guide.md` — Presign flow (lines 186-208), FileUploader spec (lines 738-744)
- `02-CONTEXT.md` — All locked decisions D-01 through D-12

### Secondary (MEDIUM confidence)

- Verified by live Node 22 experiment: `Buffer instanceof Uint8Array === true`
- Verified by live Node 22 experiment: `ReadableStream.getReader()` materialization pattern
- Verified by live Node 22 experiment: `globalThis.atob` available and correct
- Verified by live Node 22 experiment: JPEG/PNG/WebP magic byte detection logic
- Verified by live Node 22 experiment: Zod v4.3.6 `issue.message` format (already includes "Invalid input:" prefix)
- Verified by live Node 22 experiment: `isRetryable` returns `false` for `DeepIDVError` with status 403
- Verified by live Node 22 experiment: `Promise.all` parallel uploads faster than sequential

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions confirmed from installed `package.json`, no lookup required
- Architecture: HIGH — patterns are direct extensions of Phase 1 code verified by reading source files
- Pitfalls: HIGH — Zod v4 message format verified by live experiment; retry/stream pitfalls verified by code analysis

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable stack; Zod v4 API unlikely to change in 30 days)
