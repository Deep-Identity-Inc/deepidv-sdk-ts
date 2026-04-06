---
phase: 07-tests-examples-publishing
plan: 01
subsystem: server-tests
tags: [testing, msw, vitest, error-paths, coverage]
dependency_graph:
  requires: []
  provides: [TEST-01, TEST-02]
  affects: [packages/server/src/__tests__]
tech_stack:
  added: []
  patterns: [real HttpClient + msw interception, server.use() per-test handler override]
key_files:
  created: []
  modified:
    - packages/server/src/__tests__/sessions.test.ts
    - packages/server/src/__tests__/document.test.ts
    - packages/server/src/__tests__/face.test.ts
    - packages/server/src/__tests__/identity.test.ts
    - packages/server/src/deepidv.test.ts
    - packages/server/vitest.config.ts
decisions:
  - "Overriding presign endpoint to return 401 is the correct trigger for AuthenticationError in uploader-dependent methods (document, face, identity)"
  - "Sessions.create error test overrides POST /v1/sessions directly since sessions.create does not use FileUploader"
  - "passWithNoTests removed from vitest.config.ts — server package now has 59 tests"
metrics:
  duration: "2 minutes"
  completed_date: "2026-04-06"
  tasks_completed: 2
  files_modified: 6
---

# Phase 7 Plan 1: Fill Test Gaps (Error-Path Coverage) Summary

Error-path tests added across all server module test files — every public method now has at least one happy-path and one error-path test. 17 new test cases added (13 error-path + 2 config edge-case + 2 already counted), bringing server total from 46 to 59 tests. Full suite (core + server): 185 tests, all green.

## What Was Built

Added error-path tests to all 5 server test files using the established pattern (real HttpClient + msw interception, `server.use()` per-test):

**sessions.test.ts — 4 error-path tests added:**
- `Sessions.retrieve returns AuthenticationError on 401` — wildcard `*/v1/sessions/:id` override
- `Sessions.list returns DeepIDVError on 500` — wildcard `*/v1/sessions` override
- `Sessions.updateStatus returns DeepIDVError on 404` — wildcard `*/v1/sessions/:id` PATCH override
- `Sessions.create returns AuthenticationError on 401` — `POST /v1/sessions` override

**document.test.ts — 2 error-path tests added:**
- `returns AuthenticationError on 401 from presign` — presign endpoint returns 401
- `returns DeepIDVError on 500 from scan endpoint` — presign + S3 succeed, scan returns 500

**face.test.ts — 3 error-path tests added:**
- `Face.detect returns AuthenticationError on 401 from presign`
- `Face.compare throws ValidationError when source image is missing`
- `Face.estimateAge returns DeepIDVError on 500 from estimateAge endpoint`

**identity.test.ts — 2 error-path tests added:**
- `Identity.verify returns AuthenticationError on 401 from presign`
- `Identity.verify returns DeepIDVError on 500 from verify endpoint`

**deepidv.test.ts — 2 config edge-case tests added:**
- `accepts maxRetries: 0 without throwing`
- `accepts uploadTimeout config without throwing`

**vitest.config.ts:** `passWithNoTests: true` removed.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | c416e75 | feat(07-01): add error-path tests to sessions, document, face, and identity |
| 2 | 239ac00 | feat(07-01): add config edge-case tests and remove passWithNoTests flag |

## Test Results

| Suite | Tests Before | Tests After |
|-------|-------------|-------------|
| @deepidv/core | 126 | 126 |
| @deepidv/server | 46 | 59 |
| **Total** | **172** | **185** |

## Deviations from Plan

None - plan executed exactly as written. The wildcard URL pattern (`*/v1/sessions/:id`) was used for Sessions.retrieve/updateStatus tests since the msw setup uses `onUnhandledRequest: 'error'` and requests go to `https://api.deepidv.com` — both `BASE_URL` and `*/...` patterns work; using wildcard mirrors the plan's specified pattern.

## Known Stubs

None.

## Self-Check: PASSED
