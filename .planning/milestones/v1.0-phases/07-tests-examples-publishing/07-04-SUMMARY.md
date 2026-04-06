---
phase: 07-tests-examples-publishing
plan: 04
subsystem: testing
tags: [examples, express, nextjs, sdk-documentation]

# Dependency graph
requires:
  - phase: 07-tests-examples-publishing
    provides: SDK built and typed (node-basic example existed from 07-02)
provides:
  - Corrected node-basic example with all 6 field name errors fixed
  - New express-app example with Express route handler integration
  - New nextjs-app example with Next.js App Router route handler integration
affects: [publishing, documentation, consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Example files follow Stripe-like commented showcase style with JSDoc on each method"
    - "Both new examples initialize client once at module scope for reuse across requests"

key-files:
  created:
    - examples/express-app/index.ts
    - examples/nextjs-app/app/api/verify/route.ts
  modified:
    - examples/node-basic/index.ts

key-decisions:
  - "All example files use correct SDK field names exactly matching Zod schemas (source/target, isMatch, sessionRecord, expirationDate, overallConfidence)"
  - "express-app uses multer.memoryStorage() to get Buffer from multipart uploads, compatible with SDK Buffer input"
  - "nextjs-app converts Web File to Uint8Array via arrayBuffer() — Next.js App Router is fetch-native so no multer needed"

patterns-established:
  - "SDK examples initialize client at module scope, not inside request handlers"
  - "Error handling in framework examples: ValidationError->400, AuthenticationError->401, DeepIDVError->502, unknown->rethrow"

requirements-completed: [PUB-04, TEST-01, TEST-02, TEST-03, PUB-01, PUB-02, PUB-03]

# Metrics
duration: 2min
completed: 2026-04-06
---

# Phase 07 Plan 04: Example Fixes and Framework Integration Examples Summary

**Fixed 6 runtime field name errors in node-basic and created express-app and nextjs-app examples satisfying PUB-04**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-06T14:53:35Z
- **Completed:** 2026-04-06T14:55:16Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Corrected all 6 field name errors in node-basic/index.ts (image1/image2, match, session, items, expiryDate, confidence) to match SDK Zod schema definitions
- Created examples/express-app/index.ts demonstrating Express.js integration with multer file uploads for identity verification and session management endpoints
- Created examples/nextjs-app/app/api/verify/route.ts demonstrating Next.js App Router route handler with FormData and Uint8Array conversion for the SDK

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix field name errors in node-basic example** - `e10eb78` (fix)
2. **Task 2: Create express-app and nextjs-app example projects** - `c4c1fc2` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `examples/node-basic/index.ts` — Fixed 6 field name errors and 2 comment inaccuracies to match SDK types exactly
- `examples/express-app/index.ts` — New Express.js integration example with POST /api/verify (multer), POST /api/sessions, GET /api/sessions/:id
- `examples/nextjs-app/app/api/verify/route.ts` — New Next.js App Router route handler with FormData-based POST /api/verify and GET method hint

## Decisions Made

- express-app uses multer with `memoryStorage()` to receive uploaded files as Node.js Buffers, which the SDK accepts directly
- nextjs-app converts `File` objects from `FormData` to `Uint8Array` via `.arrayBuffer()` — the Next.js App Router is fetch-native and has no Node.js `Buffer` by default; the SDK accepts `Uint8Array`
- Both framework examples initialize the DeepIDV client once at module scope, not inside request handlers — this is the correct pattern for production use (connection pooling, config validation once)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- PUB-04 fully satisfied: node-basic, express-app, and nextjs-app examples all exist with correct SDK field names
- Phase 07 is complete — all 4 plans executed
- Ready for milestone completion and npm publishing pipeline activation

---
*Phase: 07-tests-examples-publishing*
*Completed: 2026-04-06*
