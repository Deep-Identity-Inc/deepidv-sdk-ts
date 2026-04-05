---
phase: 01-core-infrastructure
plan: 03
subsystem: api
tags: [typescript, fetch, retry, exponential-backoff, msw, vitest, abort-controller]

# Dependency graph
requires:
  - phase: 01-core-infrastructure/01-02
    provides: DeepIDVConfig, ResolvedConfig, resolveConfig, error classes, TypedEmitter

provides:
  - buildHeaders(): x-api-key injection, Content-Type handling
  - buildUrl(): trailing/leading slash normalization
  - withRetry(): retry loop with exponential backoff + jitter
  - isRetryable(): classifies 429/5xx/NetworkError/TimeoutError as retryable
  - computeDelay(): Retry-After honoring with 60s cap, backoff fallback
  - extractRetryAfter(): numeric and HTTP-date parsing
  - HttpClient class: authenticated HTTP client composing all above

affects:
  - 01-04 (presigned URL upload handler uses HttpClient)
  - 02-xx (server SDK main client uses HttpClient)
  - all API method modules (sessions, document, face, identity)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-attempt AbortController pattern: new controller created inside retry loop fn, never reused (D-01)"
    - "Error mapping pattern: HTTP status -> typed SDK error class in switch statement"
    - "Pure helper pattern: auth.ts exports only pure functions, no state"
    - "TDD pattern: failing test first, then implementation, tests green before commit"

key-files:
  created:
    - packages/core/src/auth.ts
    - packages/core/src/retry.ts
    - packages/core/src/client.ts
    - packages/core/src/__tests__/retry.test.ts
    - packages/core/src/__tests__/client.test.ts
  modified:
    - packages/core/src/index.ts

key-decisions:
  - "Per-attempt AbortController: created inside withRetry fn, not outside the loop — ensures each retry gets a fresh timeout window (D-01)"
  - "Retry-After cap at 60s: prevents adversarial servers from forcing arbitrarily long waits (D-02)"
  - "error event emitted at HttpClient level, not withRetry level: HttpClient has full context (url, method) for meaningful error events"
  - "extractRetryAfter as standalone export: enables retry.ts to compute delay without coupling to client.ts"

patterns-established:
  - "Per-attempt AbortController: create AbortController inside the attempt fn passed to withRetry, not in the outer scope"
  - "Error first, response second: catch fetch TypeError before reading response, so network errors are caught correctly"
  - "buildHeaders(apiKey, body): pass body as second arg to control Content-Type presence rather than a boolean flag"

requirements-completed: [HTTP-01, HTTP-02, HTTP-03, HTTP-04]

# Metrics
duration: 8min
completed: 2026-04-05
---

# Phase 01 Plan 03: HTTP Client Summary

**Native fetch HttpClient with x-api-key auth, per-attempt AbortController timeout, exponential backoff retry honoring Retry-After with 60s cap, typed error mapping, and lifecycle events — 102 tests passing**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-05T21:58:00Z
- **Completed:** 2026-04-05T22:05:41Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- auth.ts: pure `buildHeaders()` and `buildUrl()` functions for all request construction
- retry.ts: `withRetry()` retries 429/5xx/Network/Timeout errors, never 4xx; fires retry event before sleeping (D-04)
- client.ts: `HttpClient` class composing config, auth, retry, errors, events with per-attempt AbortController timeout
- 102 unit + integration tests passing (retry.test.ts + client.test.ts) using vitest + msw

## Task Commits

Each task was committed atomically:

1. **Task 1: Auth helpers and retry logic with tests** - `313b9bc` (feat)
2. **Task 2: HttpClient class with tests** - `115baea` (feat)

## Files Created/Modified

- `packages/core/src/auth.ts` — `buildHeaders()` (x-api-key injection) and `buildUrl()` (slash normalization)
- `packages/core/src/retry.ts` — `withRetry()`, `isRetryable()`, `computeDelay()`, `extractRetryAfter()`
- `packages/core/src/client.ts` — `HttpClient` class with request/get/post/put/patch/delete methods
- `packages/core/src/__tests__/retry.test.ts` — 37 unit tests for auth helpers and retry logic
- `packages/core/src/__tests__/client.test.ts` — 65 integration tests using msw for all HttpClient behavior
- `packages/core/src/index.ts` — Added barrel exports for auth, retry, and client modules

## Decisions Made

- Per-attempt AbortController created inside the fn passed to withRetry (not outside the loop) — ensures each retry attempt gets a full timeout window rather than inheriting a partially-consumed controller
- error event emitted at HttpClient.request() level after withRetry throws, so the event has full context (was considered emitting inside withRetry but HttpClient has URL/method context that withRetry doesn't)
- extractRetryAfter exported as standalone public function from retry.ts — enables the retry loop to parse Retry-After without importing from client.ts, avoiding circular dependencies
- computeDelay uses full jitter (Math.random() * cap) not equal jitter (base + Math.random() * cap) — avoids thundering herd with many concurrent retries

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed unhandled promise rejection in "throws last error when all retries are exhausted" test**
- **Found during:** Task 1 (retry.test.ts RED phase)
- **Issue:** `vi.mockRejectedValue()` + fake timers caused Node to see promise rejections handled asynchronously, triggering a PromiseRejectionHandledWarning that made vitest report an error even though all tests passed
- **Fix:** Rewrote the exhausted-retries test to temporarily use `vi.useRealTimers()` with `initialDelayMs: 0` and a `try/catch` pattern, avoiding the timing conflict between fake timers and promise rejection tracking
- **Files modified:** packages/core/src/__tests__/retry.test.ts
- **Verification:** 79 tests passing with no unhandled errors
- **Committed in:** `313b9bc` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug in test timing)
**Impact on plan:** Test-only fix. Implementation unchanged. No scope creep.

## Issues Encountered

- `vitest run` initially failed because `node_modules` was missing in the worktree — resolved by running `pnpm install` first
- Fake timers + `mockRejectedValue` interaction caused spurious test error — fixed by restructuring the test (see Deviations above)

## Known Stubs

None. All modules are fully implemented and wired.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- HttpClient is the complete networking foundation for all SDK modules
- Plan 04 (presigned URL upload handler) can now use `HttpClient.post()` and `HttpClient.get()` directly
- The retry + timeout + error mapping behavior is fully tested and ready for production use
- `@deepidv/core` now exports `HttpClient`, `buildHeaders`, `buildUrl`, `withRetry`, `isRetryable`, `computeDelay`, `extractRetryAfter` for use by `@deepidv/server`

---
## Self-Check: PASSED

All created files found on disk. Both task commits verified in git log.

*Phase: 01-core-infrastructure*
*Completed: 2026-04-05*
