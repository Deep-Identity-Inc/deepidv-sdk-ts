---
phase: 04-document-face-primitives
plan: 03
subsystem: api
tags: [typescript, zod, msw, vitest, document, face, barrel-exports, testing]

requires:
  - phase: 04-document-face-primitives plan 01
    provides: Document class with scan() and document.types.ts Zod schemas
  - phase: 04-document-face-primitives plan 02
    provides: Face class with detect/compare/estimateAge and face.types.ts Zod schemas
  - phase: 03-sessions-module
    provides: msw test pattern (factory function, server.use per test, real HttpClient)

provides:
  - Document and Face classes importable from @deepidv/server barrel
  - All document types (DocumentScanInput, DocumentScanResult, DocumentType) exported
  - All face types (FaceDetect/Compare/EstimateAge, Gender) exported
  - All Zod schemas exported for consumer-side custom validation
  - document.test.ts: 6 tests covering Document.scan() end-to-end
  - face.test.ts: 9 tests covering Face.detect/compare/estimateAge end-to-end

affects: [phase-05, phase-06, publishing-pipeline]

tech-stack:
  added: []
  patterns:
    - "msw per-test handler pattern: server.use() inside each it() block"
    - "Factory function pattern: createDocument()/createFace() with real HttpClient + FileUploader"
    - "mockPresignBatch: assert count===2 inside handler to prove batch upload (D-02)"
    - "Barrel export order: class, then types, then schemas"

key-files:
  created:
    - packages/server/src/__tests__/document.test.ts
    - packages/server/src/__tests__/face.test.ts
  modified:
    - packages/server/src/index.ts

key-decisions:
  - "Exported Zod schemas alongside types — enables consumer-side custom validation without importing zod directly"
  - "mockPresignBatch asserts body.count === 2 inline — verifies batch presign contract in the test that exercises it"

patterns-established:
  - "Barrel export order: class first, then export type {...}, then export {...schemas}"
  - "Factory function creates fresh instance per describe block; server.use() per it() block"

requirements-completed: [DOC-01, DOC-02, DOC-03, FACE-01, FACE-02, FACE-03, FACE-04]

duration: 15min
completed: 2026-04-05
---

# Phase 4 Plan 3: Barrel Exports and Test Suites Summary

**Document and Face barrel exports wired to @deepidv/server with 15-test msw suite covering scan, detect, compare, and estimateAge including batch presign verification, unknown field stripping, and pre-network ValidationError checks**

## Performance

- **Duration:** 15 min
- **Started:** 2026-04-05T23:00:00Z
- **Completed:** 2026-04-05T23:15:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Barrel exports: Document and Face classes plus all types and Zod schemas importable from `@deepidv/server`
- document.test.ts: 6 tests — happy path, documentType forwarding, auto default, unknown field stripping (D-06), and two ValidationError cases
- face.test.ts: 9 tests — detect with optional fields, compare with batch presign count assertion, file key forwarding, estimateAge with unknown field stripping, ValidationError for all three methods

## Task Commits

1. **Task 1: Update barrel exports for Document and Face modules** - `ca8e701` (feat)
2. **Task 2: Create document.test.ts with msw test suite** - `2fb2489` (test)
3. **Task 3: Create face.test.ts with msw test suite** - `61317a6` (test)

## Files Created/Modified

- `packages/server/src/index.ts` - Added Document/Face class exports plus all type and schema exports
- `packages/server/src/__tests__/document.test.ts` - 6-test suite for Document.scan()
- `packages/server/src/__tests__/face.test.ts` - 9-test suite for Face.detect/compare/estimateAge

## Decisions Made

- Exported Zod schemas alongside types so consumers can perform custom validation without declaring zod as a direct dependency
- `mockPresignBatch` asserts `body.count === 2` inside the msw handler — this verifies the batch presign contract (FACE-02 / D-02) in the exact test that exercises face.compare()

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 04 complete: Document and Face primitives fully implemented, tested, and exported
- All 29 server tests pass (sessions + document + face)
- `pnpm build` exits 0 with dual ESM + CJS output and .d.ts generation
- Phase 05 can now import Document and Face from `@deepidv/server` barrel and build on these primitives

---
*Phase: 04-document-face-primitives*
*Completed: 2026-04-05*
