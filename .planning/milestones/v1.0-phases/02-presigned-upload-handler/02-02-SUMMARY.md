---
phase: 02-presigned-upload-handler
plan: "02"
subsystem: core
tags: [upload, file-uploader, presign, s3, retry, events, tdd]
dependency_graph:
  requires: [02-01-upload-foundation]
  provides: [file-uploader-class, presign-s3-flow, upload-barrel-exports]
  affects: [03-document-scan, 04-face-module, 05-identity-verify]
tech_stack:
  added: []
  patterns: [tdd-red-green, msw-http-handlers, promise-all-parallel-uploads, abort-controller-timeout]
key_files:
  created: []
  modified:
    - packages/core/src/uploader.ts
    - packages/core/src/__tests__/uploader.test.ts
    - packages/core/src/index.ts
decisions:
  - "Cast Uint8Array body to ArrayBuffer for TypeScript 6 DTS compatibility — Uint8Array<ArrayBufferLike> is not directly assignable to BodyInit in strict mode"
  - "Stream materialization happens in upload() before _putToS3() — no double-read bug even with retry"
  - "FileUploader uses raw config.fetch for S3 PUTs (not HttpClient) to ensure no x-api-key header reaches S3"
metrics:
  duration_seconds: 196
  completed_date: "2026-04-05"
  tasks_completed: 2
  files_changed: 3
---

# Phase 02 Plan 02: FileUploader Class — Presign + S3 PUT Flow Summary

FileUploader class with full presign + S3 PUT orchestration: normalize inputs, detect content type, batch presign API call, parallel S3 PUTs with uploadTimeout and retry, upload lifecycle events. Barrel exports updated. All 126 tests pass, both packages build.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Implement FileUploader class + integration tests (TDD) | 1f66b44 | uploader.ts, uploader.test.ts |
| 2 | Update barrel exports in index.ts + fix DTS build error | 2322e14 | index.ts, uploader.ts |

## What Was Built

### uploader.ts

- **`FileUploader`** class with full JSDoc:
  - `upload(inputs, options?)` — normalizes all inputs to Uint8Array, detects content types, calls `POST /v1/uploads/presign` once for all files, PUTs to S3 in parallel via `Promise.all`, returns `fileKey[]` strings
  - `_putToS3(url, bytes, contentType)` — wraps single S3 PUT in `withRetry()` loop
  - `_attemptPut(url, bytes, contentType)` — single PUT attempt using raw `config.fetch` with `config.uploadTimeout` (120s), emits `upload:start` / `upload:complete` events, handles 403 as immediate non-retryable (`upload_url_expired`), handles 5xx as retryable via `DeepIDVError` with status
- Stream materialization (`toUint8Array`) called in `upload()` before entering retry loop — no double-read bug (UPL-06)
- Body sent as `bytes.buffer as ArrayBuffer` for TypeScript 6 DTS compatibility

### uploader.test.ts

9 new `FileUploader` integration tests using msw:
- Single upload: presign called with `count:1`, S3 PUT returns `fileKey`
- Batch upload: presign called with `count:2`, both PUTs received in parallel
- S3 PUT has `Content-Type` header but no `x-api-key` header
- Upload timeout: raw config.fetch with AbortController, short `uploadTimeout` triggers TimeoutError
- S3 5xx retries: retry event emitted, second attempt succeeds
- S3 403 throws immediately with code `upload_url_expired`, no retry (callCount=1)
- ReadableStream materialized before retry: second attempt still receives full bytes
- `contentType` option overrides auto-detection in both presign body and PUT header
- `upload:start` emitted before PUT, `upload:complete` emitted after success

### index.ts

- Added `FileUploader` to uploader exports
- Consolidated `DEFAULT_UPLOAD_TIMEOUT` into main config export block (removed duplicate standalone export)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript 6 DTS error: Uint8Array not assignable to BodyInit**
- **Found during:** Task 2 verification (build)
- **Issue:** TypeScript 6 strict mode: `Uint8Array<ArrayBufferLike>` is not assignable to `BodyInit | null | undefined` when used as fetch body in DTS generation
- **Fix:** Changed `body: bytes` to `body: bytes.buffer as ArrayBuffer` — `ArrayBuffer` is unambiguously assignable to `BodyInit`
- **Files modified:** packages/core/src/uploader.ts (line 415)
- **Commit:** 2322e14

## Known Stubs

None — FileUploader is fully implemented. No placeholder values, TODOs, or hardcoded data.

## Verification Results

- `pnpm --filter @deepidv/core build` exits 0 (ESM + CJS + DTS)
- `pnpm --filter @deepidv/server build` exits 0
- `pnpm --filter @deepidv/core test --run` exits 0 (126 tests, 9 new FileUploader tests)
- `grep 'x-api-key' packages/core/src/uploader.ts` returns only comment matches (no code usage)
- `grep 'FileUploader' packages/core/src/index.ts` returns a match

## Self-Check: PASSED
