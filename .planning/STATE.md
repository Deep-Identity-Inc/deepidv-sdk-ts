---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: verifying
stopped_at: Completed 07-03-PLAN.md — all 3 plans in phase 07 complete
last_updated: "2026-04-06T14:29:39.072Z"
last_activity: 2026-04-06
progress:
  total_phases: 7
  completed_phases: 7
  total_plans: 17
  completed_plans: 17
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-05)

**Core value:** Developers pass images in and get typed verification results back — all presigned URL orchestration, retry logic, and error handling is invisible.
**Current focus:** Phase 07 — tests-examples-publishing

## Current Position

Phase: 07 (tests-examples-publishing) — EXECUTING
Plan: 3 of 3
Status: Phase complete — ready for verification
Last activity: 2026-04-06

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01-core-infrastructure P01 | 3 | 2 tasks | 14 files |
| Phase 01-core-infrastructure P02 | 5 | 2 tasks | 9 files |
| Phase 01-core-infrastructure P03 | 8 | 2 tasks | 6 files |
| Phase 01-core-infrastructure P04 | 1 | 2 tasks | 2 files |
| Phase 02-presigned-upload-handler P01 | 215 | 2 tasks | 5 files |
| Phase 02-presigned-upload-handler P02 | 196 | 2 tasks | 3 files |
| Phase 03-sessions-module P01 | 25 | 3 tasks | 5 files |
| Phase 03-sessions-module P02 | 10 | 1 tasks | 3 files |
| Phase 04-document-face-primitives P01 | 1 | 2 tasks | 2 files |
| Phase 04-document-face-primitives P02 | 1 | 2 tasks | 2 files |
| Phase 04-document-face-primitives P03 | 15 | 3 tasks | 3 files |
| Phase 05-identity-module P01 | 4 | 2 tasks | 3 files |
| Phase 05-identity-module P02 | 2 | 2 tasks | 1 files |
| Phase 06-public-entry-point P01 | 256 | 3 tasks | 7 files |
| Phase 07-tests-examples-publishing P01 | 2 | 2 tasks | 6 files |
| Phase 07-tests-examples-publishing P02 | 4 | 2 tasks | 7 files |
| Phase 07-tests-examples-publishing P03 | 3 | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- — see PROJECT.md Key Decisions for architectural decisions made during initialization.
- [Phase 01-core-infrastructure]: Used TypeScript 6.0.2 and Zod 4.3.6 (latest stable) per RESEARCH.md — TypeScript 6.0 is GA March 2026, Zod v4 is the latest tag; starting on these versions avoids future migrations
- [Phase 01-core-infrastructure]: Added ignoreDeprecations:6.0 to tsconfig.base.json — TypeScript 6.0 deprecates baseUrl which tsup DTS builder injects; this is the TS-recommended migration path
- [Phase 01-core-infrastructure]: Added lib:[ES2022, DOM] to core tsconfig for Web API types (fetch, URL, RequestInit, Response) — DOM lib is type-only, no runtime impact
- [Phase 01-core-infrastructure]: Error hierarchy uses Object.setPrototypeOf(this, new.target.prototype) in every subclass for correct instanceof in CJS/ESM interop
- [Phase 01-core-infrastructure]: Per-attempt AbortController: create inside withRetry fn for each attempt, not outside the loop — ensures fresh timeout per retry (D-01)
- [Phase 01-core-infrastructure]: error event emitted at HttpClient level after withRetry throws — has URL/method context that retry layer does not
- [Phase 01-core-infrastructure]: extractRetryAfter exported as standalone function from retry.ts to avoid circular dependencies with client.ts
- [Phase 01-core-infrastructure]: passWithNoTests: true in @deepidv/server vitest config — Phase 1 shell has no tests; vitest exits 1 without this flag
- [Phase 01-core-infrastructure]: Core barrel file was complete from Plan 03 — Task 1 verified but required no file changes
- [Phase 02-presigned-upload-handler]: Used globalThis property access for process/Deno/Bun runtime detection to avoid requiring platform-specific type definitions in runtime-agnostic core package
- [Phase 02-presigned-upload-handler]: Used dynamic import with string cast for conditional Node fs/promises import to prevent DTS type errors while preserving edge-runtime compatibility
- [Phase 02-presigned-upload-handler]: Cast Uint8Array body to ArrayBuffer for TypeScript 6 DTS compatibility in S3 PUT fetch call
- [Phase 02-presigned-upload-handler]: FileUploader uses raw config.fetch for S3 PUTs (not HttpClient) to ensure no x-api-key header reaches S3 (UPL-07)
- [Phase 03-sessions-module]: Zod 4 z.record() requires 2 args (key+value schema) — updated all z.record(valueSchema) calls to z.record(z.string(), valueSchema)
- [Phase 03-sessions-module]: Added zod as direct dependency to @deepidv/server — pnpm strict workspace prevents phantom dep resolution from @deepidv/core
- [Phase 03-sessions-module]: Added lib:[ES2022, DOM] to server tsconfig for URLSearchParams Web API types — type-only lib, no runtime impact
- [Phase 03-sessions-module]: PaginatedResponse<T> defined as plain type alias (not z.infer) — generic schema factory cannot yield z.infer for generic type parameter; D-04 violation is intentional for this case
- [Phase 03-sessions-module]: All tests use real HttpClient + msw interception (not mocked HttpClient) — consistent with core package test pattern
- [Phase 03-sessions-module]: server.use() inside each it() block prevents msw handler leakage between tests; onUnhandledRequest: error catches accidental real HTTP calls
- [Phase 04-document-face-primitives]: Document class uses constructor injection with HttpClient + FileUploader (D-04); DocumentScanResultSchema uses .strip() for forward-compatible API response parsing (D-06)
- [Phase 04-document-face-primitives]: compare() passes array [source, target] to FileUploader.upload() for batch presign (count:2) and parallel S3 PUTs per UPL-04/D-02
- [Phase 04-document-face-primitives]: All face result schemas use .strip() to tolerate future API fields without breaking
- [Phase 04-document-face-primitives]: Exported Zod schemas alongside types in barrel — enables consumer-side custom validation without zod as direct dep
- [Phase 04-document-face-primitives]: mockPresignBatch asserts body.count===2 inline to verify batch presign contract in the test that exercises face.compare()
- [Phase 05-identity-module]: Independent nested result schemas (D-03): identity sub-shapes in identity.types.ts are not reused from Phase 4 — verified against build guide shapes
- [Phase 05-identity-module]: All sub-result fields (document, faceDetection, faceMatch) required not optional — API always returns full shape on 2xx (D-04)
- [Phase 05-identity-module]: Barrel exports pre-completed by 05-01 Rule 2 auto-fix — Task 2 required only verification, no file changes
- [Phase 06-public-entry-point]: DeepIDV class is the single public entry point; Sessions/Document/Face/Identity classes are internal implementation details not exported from the barrel
- [Phase 06-public-entry-point]: DeepIDVConfigSchema exported for consumers who need schema-driven config validation
- [Phase 07-tests-examples-publishing]: Overriding presign endpoint to 401 is the correct trigger for AuthenticationError in uploader-dependent methods
- [Phase 07-tests-examples-publishing]: passWithNoTests removed from server vitest.config.ts — server package now has 59 tests
- [Phase 07-tests-examples-publishing 02]: noExternal:['@deepidv/core'] in tsup.config.ts — core inlined; consumers install one package with no workspace dependency
- [Phase 07-tests-examples-publishing 02]: Consumer tsconfig uses moduleResolution:bundler — exercises exports map the same way a bundler would
- [Phase 07-tests-examples-publishing 02]: Consumer paths points to dist/index.d.ts not source — validates the publishing artifact
- [Phase 07-tests-examples-publishing 02]: Changesets access:public, commit:false, ignore:[@deepidv/core] — core is internal, never published
- [Phase 07-tests-examples-publishing 02]: SDKEventMap event key is 'request' not 'request:start' — plan template had wrong key; corrected after reading built d.ts
- [Phase 07-tests-examples-publishing]: pnpm/action-setup@v4 (not v3) required for pnpm v10 support in CI
- [Phase 07-tests-examples-publishing]: id-token:write enables npm provenance attestation linking package to GitHub Actions run
- [Phase 07-tests-examples-publishing]: concurrency guard on publish workflow prevents parallel runs on rapid pushes to main

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 2: Confirm exact `POST /v1/uploads/presign` request/response shape (field names, whether `count: N` returns array or map) against API docs before implementation
- Phase 4/5: Confirm exact shapes of `DocumentScanResult`, `FaceCompareResult`, and `IdentityVerificationResult` from the API reference before writing Zod schemas
- Phase 1: Decide whether to bundle `@deepidv/core` into `@deepidv/server` via tsup `noExternal` (eliminates workspace protocol stripping risk) before designing the publishing pipeline

## Session Continuity

Last session: 2026-04-06T14:29:39.069Z
Stopped at: Completed 07-03-PLAN.md — all 3 plans in phase 07 complete
Resume file: None
