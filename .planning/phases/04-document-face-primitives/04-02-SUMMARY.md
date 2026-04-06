---
phase: 04-document-face-primitives
plan: 02
subsystem: api
tags: [zod, typescript, face-detection, presigned-upload, file-uploader]

# Dependency graph
requires:
  - phase: 02-presigned-upload-handler
    provides: FileUploader.upload() accepting FileInput | FileInput[] for single/batch S3 uploads
  - phase: 01-core-infrastructure
    provides: HttpClient, mapZodError, error classes
provides:
  - Face class with detect(), compare(), estimateAge() methods
  - Zod schemas and inferred types for all three face operations
  - Batch upload pattern for compare() using array of 2 FileInputs
affects:
  - 04-document-face-primitives (04-03: identity module depends on face.detect and face.compare)
  - Any phase that builds the main SDK client entry point (wires Face into client.face)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "validate-upload-call-parse: Zod validate input → FileUploader.upload() → HttpClient.post() → result schema parse"
    - "Batch upload via array: pass [source, target] array to FileUploader.upload() to trigger count:2 batch presign with parallel S3 PUTs"
    - "Constructor injection for two deps: Face(client: HttpClient, uploader: FileUploader)"

key-files:
  created:
    - packages/server/src/face.types.ts
    - packages/server/src/face.ts
  modified: []

key-decisions:
  - "compare() passes array [source, target] to FileUploader.upload() — single call triggers batch presign (count:2) and parallel S3 PUTs per UPL-04/D-02"
  - "All result schemas use .strip() to tolerate future API fields without breaking"
  - "GenderSchema defined as named export (not inline z.enum) so Gender type can be imported independently"
  - "Response parsing uses schema.parse(raw) on the raw unknown API response — ensures strong typing and strips undocumented fields"

patterns-established:
  - "Face service pattern: two-dep constructor (HttpClient + FileUploader), four-step method flow (validate → upload → call → parse)"
  - "Batch upload pattern: pass FileInput[] to uploader.upload() for multi-file operations"

requirements-completed: [FACE-01, FACE-02, FACE-03, FACE-04]

# Metrics
duration: 1min
completed: 2026-04-06
---

# Phase 4 Plan 2: Face Module Summary

**Face class with detect/compare/estimateAge methods, Zod schemas for all three operations, and batch parallel upload for face comparison via FileUploader array input**

## Performance

- **Duration:** 1 min
- **Started:** 2026-04-06T02:59:25Z
- **Completed:** 2026-04-06T02:59:47Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `face.types.ts` with full Zod schemas for all three face operations and exported inferred types
- Created `face.ts` with Face class implementing validate-upload-call-parse flow for each method
- compare() uses batch upload pattern: passes `[source, target]` array to FileUploader which issues a single presign request with `count: 2` and parallel S3 PUTs

## Task Commits

Each task was committed atomically:

1. **Task 1: Create face.types.ts with Zod schemas and inferred types** - `1ec203e` (feat)
2. **Task 2: Create Face class with detect(), compare(), estimateAge() methods** - `9abae43` (feat)

## Files Created/Modified
- `packages/server/src/face.types.ts` - Zod schemas (FaceDetectInputSchema, FaceDetectResultSchema, FaceCompareInputSchema, FaceCompareResultSchema, FaceEstimateAgeInputSchema, FaceEstimateAgeResultSchema, GenderSchema) and inferred types
- `packages/server/src/face.ts` - Face class with detect(), compare(), estimateAge() methods

## Decisions Made
- `compare()` passes an array `[validated.source, validated.target]` to `this.uploader.upload()`. FileUploader already handles the batch presign (count: 2) and parallel S3 PUTs internally (UPL-04/D-02) — no extra orchestration needed in Face class.
- All result schemas use `.strip()` rather than `.passthrough()` to drop unknown API fields and maintain clean typed results.
- `GenderSchema` is exported as a named const so `Gender` type can be imported independently by consumers.
- Response parsing uses `ResultSchema.parse(raw)` on the raw API response (unknown type) to ensure runtime type safety.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Face module complete with all three methods (FACE-01, FACE-02, FACE-03, FACE-04)
- Ready for Phase 4 Plan 3: identity.verify() which orchestrates document.scan + face.detect + face.compare
- Both Face and Document classes follow the same constructor injection pattern — can be wired into the main DeepIDVClient alongside Sessions

## Self-Check: PASSED

All files created and commits verified:
- `packages/server/src/face.types.ts` — FOUND
- `packages/server/src/face.ts` — FOUND
- `.planning/phases/04-document-face-primitives/04-02-SUMMARY.md` — FOUND
- Commit `1ec203e` (Task 1) — FOUND
- Commit `9abae43` (Task 2) — FOUND

---
*Phase: 04-document-face-primitives*
*Completed: 2026-04-06*
