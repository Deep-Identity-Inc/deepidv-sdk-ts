---
phase: "04-document-face-primitives"
plan: "01"
subsystem: "document-module"
tags: ["document", "ocr", "zod", "types", "upload"]
dependency_graph:
  requires:
    - "@deepidv/core FileUploader (Phase 2)"
    - "@deepidv/core HttpClient (Phase 1)"
    - "sessions.types.ts pattern (Phase 3)"
  provides:
    - "Document class with scan() method"
    - "DocumentScanResultSchema Zod schema"
    - "DocumentScanInput / DocumentScanResult types"
  affects:
    - "packages/server/src/index.ts (will export Document class — Phase 6)"
    - "identity.verify() orchestration (Phase 5)"
tech_stack:
  added: []
  patterns:
    - "4-step upload-then-process flow: Zod validate → FileUploader.upload → HttpClient.post → schema.parse"
    - "z.object().strip() for forward-compatible API response parsing (D-06)"
    - "Constructor injection with HttpClient + FileUploader (D-04)"
key_files:
  created:
    - "packages/server/src/document.types.ts"
    - "packages/server/src/document.ts"
  modified: []
decisions:
  - "Used z.object().strip() on DocumentScanResultSchema — validates known fields, silently drops unknown ones (D-06, forward compatible)"
  - "Document class accepts two constructor params: HttpClient + FileUploader — explicit, testable (D-04)"
  - "documentType defaults to 'auto' via Zod schema default, not application code — validated before network call (DOC-03)"
metrics:
  duration: "1 minute"
  completed_date: "2026-04-06"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 4 Plan 1: Document Module Summary

**One-liner:** Document class with scan() method using Zod-validated 4-step upload-then-process flow, DocumentScanResultSchema with .strip() for forward-compatible OCR result parsing.

## What Was Built

`document.types.ts` and `document.ts` implement the `client.document.scan()` method (DOC-01, DOC-02, DOC-03).

**`packages/server/src/document.types.ts`:**
- `DocumentTypeSchema` — z.enum of passport, drivers_license, national_id, auto
- `DocumentScanInputSchema` — z.object with FileInput custom validator and documentType defaulting to 'auto'
- `DocumentScanResultSchema` — full-depth z.object().strip() with 13 named fields + rawFields Record + confidence
- Exported z.infer types: `DocumentType`, `DocumentScanInput`, `DocumentScanResult`

**`packages/server/src/document.ts`:**
- `Document` class with `constructor(client: HttpClient, uploader: FileUploader)`
- `scan()` method implementing the 4-step flow: Zod validate → FileUploader.upload → HttpClient.post('/v1/document/scan') → DocumentScanResultSchema.parse
- Full JSDoc on class and scan() with @throws documentation for all error types

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Create document.types.ts with Zod schemas and inferred types | 31ec6e4 |
| 2 | Create Document class with scan() method | 1103c76 |

## Verification

- `npx tsc --noEmit -p packages/server/tsconfig.json` exits 0 with zero errors
- Both files follow the sessions module structural pattern
- DocumentScanResultSchema matches build guide shape (13 fields + rawFields + confidence)
- Document class has two constructor params (HttpClient + FileUploader) per D-04
- No `any` usage in either file

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both files are fully implemented with no placeholder values, hardcoded empty returns, or TODO markers.

## Self-Check: PASSED
- packages/server/src/document.types.ts — FOUND
- packages/server/src/document.ts — FOUND
- Commit 31ec6e4 — FOUND
- Commit 1103c76 — FOUND
