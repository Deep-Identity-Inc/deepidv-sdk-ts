---
phase: 02-presigned-upload-handler
plan: "01"
subsystem: core
tags: [upload, types, zod, validation, content-type, config, events]
dependency_graph:
  requires: [01-core-infrastructure]
  provides: [upload-foundation, file-input-types, upload-events, content-type-detection]
  affects: [02-02-file-uploader-class]
tech_stack:
  added: []
  patterns: [zod-infer-types, globalThis-runtime-detection, magic-byte-sniffing, tdd-red-green]
key_files:
  created:
    - packages/core/src/uploader.ts
    - packages/core/src/__tests__/uploader.test.ts
  modified:
    - packages/core/src/config.ts
    - packages/core/src/events.ts
    - packages/core/src/index.ts
decisions:
  - "Used globalThis['process'] property access instead of bare `process` to avoid requiring @types/node in runtime-agnostic core package"
  - "Used dynamic import with string cast (`import('node:fs/promises' as string)`) to prevent DTS type errors while keeping conditional Node-only import"
  - "Added uploader exports to core barrel (index.ts) even though not listed in plan files_modified — required for Plan 02 FileUploader class to import from @deepidv/core"
metrics:
  duration_seconds: 215
  completed_date: "2026-04-05"
  tasks_completed: 2
  files_changed: 5
---

# Phase 02 Plan 01: Upload Foundation — Config, Events, and Utility Functions Summary

Upload foundation layer: `uploadTimeout` config extension, upload lifecycle events in `SDKEventMap`, and all utility functions in `uploader.ts` (input normalization, magic-byte content-type detection, Zod schema validation, type definitions). Build and all 117 tests pass.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Extend config and events for upload support | 1d27234 | config.ts, events.ts |
| 2 | Create uploader.ts with types, Zod schemas, utility functions | 806b6d4 | uploader.ts, uploader.test.ts, index.ts |

## What Was Built

### config.ts
- Added `DEFAULT_UPLOAD_TIMEOUT = 120_000` constant
- Added `uploadTimeout?: number` to `DeepIDVConfig` interface (optional, default 120s)
- Added `uploadTimeout: number` to `ResolvedConfig` interface (required after resolution)
- Added `uploadTimeout: config.uploadTimeout ?? DEFAULT_UPLOAD_TIMEOUT` to `resolveConfig()`

### events.ts
- Added `'upload:start': { url: string; bytes: number; contentType: string }` to `SDKEventMap`
- Added `'upload:complete': { url: string; contentType: string }` to `SDKEventMap`

### uploader.ts (new file)
- **`FileInput`** type: `Uint8Array | ReadableStream<Uint8Array> | string` — no Buffer
- **`SupportedContentType`** type: `'image/jpeg' | 'image/png' | 'image/webp'`
- **`UploadOptions`** type: `z.infer<typeof UploadOptionsSchema>` — Zod schema as source of truth
- **`PresignResponse`** interface: `{ uploads: Array<{ uploadUrl: string; fileKey: string }> }`
- **`toUint8Array()`**: Normalizes Uint8Array (pass-through), ReadableStream (materialized), data URL (base64-decoded), raw base64 > 256 chars (decoded), file path (Node/Deno/Bun fs read or ValidationError on edge)
- **`detectContentType()`**: Magic byte detection for JPEG (FF D8 FF), PNG (89 50 4E 47), WebP (RIFF....WEBP); throws ValidationError for unknown or too-small input
- **`mapZodError()`**: Maps ZodError first issue to `ValidationError` with format `"{message} at '{path}'"` using `(root)` when path is empty; attaches ZodError as cause
- **`validateUploadOptions()`**: Parses raw input through UploadOptionsSchema, maps ZodError to ValidationError

### index.ts
- Exported `DEFAULT_UPLOAD_TIMEOUT` from config
- Exported all public types and functions from uploader.ts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript DTS build errors for process/Deno/Bun globals**
- **Found during:** Task 2 verification
- **Issue:** TypeScript 6 with strict mode and no @types/node couldn't type `process`, `Deno`, `Bun`, or `import('fs/promises')` in uploader.ts DTS build
- **Fix:** Routed all runtime globals through `globalThis as Record<string, any>` property access; used `import('node:fs/promises' as string) as any` to suppress type checking on conditional Node-only import
- **Files modified:** packages/core/src/uploader.ts
- **Commit:** 806b6d4

**2. [Rule 2 - Missing Critical] Added uploader exports to core barrel**
- **Found during:** Task 2 implementation
- **Issue:** Plan's `files_modified` did not list `index.ts`, but Plan 02 (FileUploader class) must import types and utilities from `@deepidv/core`
- **Fix:** Added `FileInput`, `SupportedContentType`, `UploadOptions`, `PresignResponse`, `toUint8Array`, `detectContentType`, `mapZodError`, `validateUploadOptions`, and `DEFAULT_UPLOAD_TIMEOUT` exports to `packages/core/src/index.ts`
- **Files modified:** packages/core/src/index.ts
- **Commit:** 806b6d4

## Known Stubs

None — all types and functions are fully implemented. No placeholder values or TODO markers.

## Verification Results

- `pnpm --filter @deepidv/core build` exits 0
- `pnpm --filter @deepidv/core test --run` exits 0 (117 tests pass)
- `grep -c 'uploadTimeout' packages/core/src/config.ts` returns 3
- `grep -c 'upload:start' packages/core/src/events.ts` returns 1
- No `import.*Buffer` in uploader.ts

## Self-Check: PASSED
