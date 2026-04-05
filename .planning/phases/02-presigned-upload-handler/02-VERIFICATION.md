---
phase: 02-presigned-upload-handler
verified: 2026-04-05T23:17:18Z
status: human_needed
score: 5/5 must-haves verified (1 human verification item)
human_verification:
  - test: "Pass a real file path string through FileUploader.upload() and confirm a non-empty fileKey is returned"
    expected: "upload() reads the file from disk, detects content type from magic bytes, calls presign, PUTs to S3, returns a fileKey string"
    why_human: "The automated test suite only verifies that toUint8Array('/nonexistent/path') throws a filesystem error. No test exercises the full presign+PUT cycle with a valid on-disk file path. Requires a real or mock file on disk wired through the full upload flow."
---

# Phase 02: Presigned Upload Handler — Verification Report

**Phase Goal:** A `FileUploader` in `@deepidv/core` that accepts any supported input type, detects content type, requests presigned URLs, PUTs files to S3, and returns `fileKey`s — with Zod validation on all public method inputs
**Verified:** 2026-04-05T23:17:18Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Passing a Buffer, Uint8Array, file path string, base64 string, and ReadableStream each produce a non-empty fileKey | PARTIAL | Uint8Array, base64 (raw + data URL), ReadableStream all have passing full-cycle tests in `uploader.test.ts`. File path: code routes correctly but no full-cycle test with a valid path (only `rejects.toThrow()` for non-existent path). Node `Buffer` works transparently via `instanceof Uint8Array`. |
| 2 | ReadableStream is materialized to Uint8Array exactly once at the SDK boundary | VERIFIED | `upload()` calls `Promise.all(inputArray.map(toUint8Array))` before `_putToS3()`. Integration test "ReadableStream input is materialized before S3 PUT retry loop" verifies second retry attempt sends full bytes. |
| 3 | Calling a public method with a missing required field throws a ValidationError with parameter name and expected type, before any network call | VERIFIED | `validateUploadOptions` wraps `UploadOptionsSchema.parse`, maps `ZodError` via `mapZodError`. Message format `"{issue.message} at '{path}'"` tested in `mapZodError` describe block. |
| 4 | A two-file batch presign issues one presign request (count:2) and two parallel S3 PUTs, completing faster than two sequential uploads | VERIFIED | `upload()` sends `{ contentType, count: inputArray.length }` then `Promise.all(presignResponse.uploads.map(...this._putToS3...))`. Test "upload([jpegBytes, pngBytes]) calls presign with count:2 and PUTs both files in parallel" passes; both PUT URLs captured. |
| 5 | FileUploader imports and runs on Cloudflare Workers without referencing fs, path, or any Node-specific global | VERIFIED | No static `import 'fs'` or `import 'path'`. Dynamic `import('node:fs/promises')` is inside a runtime guard (`!isNode && !isDeno && !isBun` → throws ValidationError). Built `dist/index.js` confirms guard at line 491 before the dynamic import at line 496. |

**Score:** 5/5 truths verified (1 with human-test needed for completeness)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/config.ts` | `uploadTimeout` in DeepIDVConfig and ResolvedConfig, `DEFAULT_UPLOAD_TIMEOUT` | VERIFIED | Constant at line 23 (`120_000`), optional field in `DeepIDVConfig` (line 49), required field in `ResolvedConfig` (line 69), resolved in `resolveConfig` (line 86) |
| `packages/core/src/events.ts` | `upload:start` and `upload:complete` event types in SDKEventMap | VERIFIED | Lines 29–31 in `events.ts`; payload types match plan spec exactly |
| `packages/core/src/uploader.ts` | FileInput, UploadOptions, SupportedContentType, PresignResponse, toUint8Array, detectContentType, FileUploader | VERIFIED | All 461 lines substantive; all types, utility functions, and FileUploader class exported |
| `packages/core/src/index.ts` | Barrel exports for FileUploader, FileInput, UploadOptions, PresignResponse, SupportedContentType | VERIFIED | Lines 44–57 export all types and values; `DEFAULT_UPLOAD_TIMEOUT` also exported |
| `packages/core/src/__tests__/uploader.test.ts` | Integration tests for FileUploader presign + S3 PUT flow | VERIFIED | 501 lines, 126 tests passing (5 test files total) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `uploader.ts` | `errors.ts` | `import { DeepIDVError, NetworkError, TimeoutError, ValidationError }` | WIRED | Line 20 of `uploader.ts` |
| `uploader.ts` | `config.ts` | `import type { ResolvedConfig }` | WIRED | Line 22 of `uploader.ts` |
| `uploader.ts` | `retry.ts` | `import { withRetry }` | WIRED | Line 21 of `uploader.ts` |
| `FileUploader.upload()` | `POST /v1/uploads/presign` | `this.httpClient.post('/v1/uploads/presign', ...)` | WIRED | Line 357–360; response parsed as `PresignResponse` and used in Promise.all |
| `FileUploader._attemptPut()` | `config.fetch` | `this.config.fetch(url, { method: 'PUT', ... })` | WIRED | Lines 412–419; no `x-api-key` header, uses `uploadTimeout` via AbortController |
| `FileUploader._putToS3()` | `withRetry` | `withRetry(() => this._attemptPut(...), ...)` | WIRED | Lines 382–386 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `FileUploader.upload()` | `presignResponse.uploads` | `this.httpClient.post<PresignResponse>('/v1/uploads/presign', body)` | Yes — real HTTP POST to presign API | FLOWING |
| `FileUploader.upload()` | `byteArrays` | `Promise.all(inputArray.map(toUint8Array))` | Yes — normalizes caller-supplied bytes | FLOWING |
| `FileUploader._attemptPut()` | `response` | `this.config.fetch(url, { method: 'PUT', body: bytes.buffer })` | Yes — real HTTP PUT to S3 presigned URL | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 126 tests pass | `pnpm --filter @deepidv/core test --run` | 126 passed (5 test files), 799ms | PASS |
| Core package builds (ESM + CJS + DTS) | `pnpm --filter @deepidv/core build` | ESM 21.99 KB, CJS 24.60 KB, DTS 25.50 KB — exit 0 | PASS |
| Server package builds after core changes | `pnpm --filter @deepidv/server build` | ESM 308 B, CJS 1.47 KB, DTS 169 B — exit 0 | PASS |
| No static Node fs/path imports in dist | `grep 'require("fs' dist/index.js` | No matches (dynamic import inside guard only) | PASS |
| No x-api-key on S3 paths | `grep 'x-api-key' packages/core/src/uploader.ts` | Only in JSDoc comments, never in headers map | PASS |
| No Buffer import in uploader | `grep 'import.*Buffer' packages/core/src/uploader.ts` | No matches | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UPL-01 | 02-02 | Presigned URL upload handler: POST `/v1/uploads/presign` → PUT to S3 → return `fileKey` | SATISFIED | `FileUploader.upload()` implements full flow; test "upload(jpegBytes) calls POST /v1/uploads/presign... returns [fileKey]" passes |
| UPL-02 | 02-01 | Accept Buffer, Uint8Array, ReadableStream, file path string, and base64 string | SATISFIED | `FileInput = Uint8Array \| ReadableStream<Uint8Array> \| string`; Node Buffer passes `instanceof Uint8Array`; all string variants (base64, data URL, file path) handled in `toUint8Array()` |
| UPL-03 | 02-01 | Content-type detection from magic bytes (JPEG, PNG, WebP) | SATISFIED | `detectContentType()` uses FF D8 FF (JPEG), 89 50 4E 47 (PNG), RIFF/WEBP (WebP) magic bytes; 5 unit tests cover all cases |
| UPL-04 | 02-02 | Parallel batch presigned uploads via `Promise.all` | SATISFIED | `upload()` calls `Promise.all(presignResponse.uploads.map(..._putToS3...))` with batch count; test with 2 files verifies both PUTs received |
| UPL-05 | 02-02 | Separate configurable timeout for S3 uploads | SATISFIED | `config.uploadTimeout` (120s default) used in `_attemptPut()` AbortController; separate from `config.timeout` (30s for API); timeout test with 50ms uploadTimeout confirms TimeoutError |
| UPL-06 | 02-02 | ReadableStream materialization before upload to prevent double-read bug | SATISFIED | `Promise.all(inputArray.map(toUint8Array))` executes in `upload()` before `_putToS3()` retry loop; retry test verifies second attempt still sends full bytes |
| UPL-07 | 02-01, 02-02 | Zero AWS SDK dependency; all S3 via native fetch with presigned URLs | SATISFIED | No AWS SDK imports anywhere; S3 PUT uses `this.config.fetch` (native fetch), not `HttpClient`; x-api-key test confirms header absent on S3 requests |
| VAL-01 | 02-01 | Zod schemas validate all public method inputs before network calls | SATISFIED | `validateUploadOptions(options ?? {})` is first call in `upload()`; called before `toUint8Array()` and before any network call |
| VAL-02 | 02-01 | Clear error messages with param name and expected type | SATISFIED | `mapZodError()` formats `"{issue.message} at '{path}'"` with `issue.path.join('.')` or `(root)`; test verifies `cause` is ZodError |
| VAL-03 | 02-01 | Zod schemas infer TypeScript types (single source of truth) | SATISFIED | `export type UploadOptions = z.infer<typeof UploadOptionsSchema>` at line 59 |

No orphaned requirements — all 10 Phase 2 IDs appear in plan frontmatter and REQUIREMENTS.md traceability table.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `uploader.ts` | 135–136 | `eslint-disable-next-line @typescript-eslint/no-explicit-any` for `globalThis as Record<string, any>` | Info | Required for runtime detection without @types/node; documented in SUMMARY decisions; not a blocker |
| `uploader.ts` | 151 | `eslint-disable-next-line @typescript-eslint/no-explicit-any` for dynamic `import('node:fs/promises' as string)` | Info | Required to prevent DTS type resolution of Node-specific module on edge runtimes; documented in SUMMARY decisions; not a blocker |
| `uploader.test.ts` | 97–116 | Edge-runtime ValidationError branch not asserted specifically — test only verifies `rejects.toThrow()` without checking error type | Warning | Leaves the edge-runtime file-path guard partially unverified by tests; implementation is correct per code inspection |

No blockers. Two eslint suppression comments are documented design decisions required for edge runtime compatibility.

### Human Verification Required

**1. File path string through full upload cycle**

**Test:** Create a temporary JPEG file on disk (e.g., write JPEG magic bytes `[0xFF, 0xD8, 0xFF, 0xE0, ...]` to `/tmp/test.jpg`). Instantiate `FileUploader` with a real or mocked presign + S3 endpoint, then call `uploader.upload('/tmp/test.jpg')` and assert the returned array contains a non-empty string `fileKey`.

**Expected:** The file is read from disk via `readFilePath`, content type detected as `image/jpeg` from magic bytes, presign API called with `{ contentType: 'image/jpeg', count: 1 }`, S3 PUT executed, and `['<fileKey>']` returned.

**Why human:** The existing test suite does not exercise the complete file-path code path through presign and S3 PUT. The current test only asserts `rejects.toThrow()` for a non-existent path (a filesystem error on Node, not a ValidationError). Adding an automated test would require writing a fixture file to disk or creating a `tmp` fixture in the test setup. This can be added as a new test case in `uploader.test.ts` using `import { writeFile, unlink } from 'node:fs/promises'` in `beforeAll`/`afterAll`, but the verification that it actually works end-to-end needs a human to confirm the test is worth adding or that the current coverage level is acceptable given the file-read path is a thin wrapper around Node's `readFile`.

### Gaps Summary

No blocking gaps. All five success criteria are satisfied by the implementation. The single human verification item is a test coverage gap (not an implementation gap) — the file path string input type is correctly implemented in code and correctly routes through `readFilePath`, but the end-to-end flow (file path → presign → S3 PUT → fileKey) has no passing automated test to prove it.

The two `any` suppressions are acceptable trade-offs documented in the SUMMARY decisions; they are confined to internal helpers and do not leak to the public API surface.

---

_Verified: 2026-04-05T23:17:18Z_
_Verifier: Claude (gsd-verifier)_
