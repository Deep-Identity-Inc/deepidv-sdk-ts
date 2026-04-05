---
phase: 01-core-infrastructure
plan: 02
subsystem: core
tags: [typescript, errors, events, config, vitest, msw, tdd]

dependency_graph:
  requires:
    - phase: 01-core-infrastructure
      plan: 01
      provides: pnpm workspace with @deepidv/core and tsup build pipeline
  provides:
    - DeepIDVConfig / ResolvedConfig interfaces and resolveConfig() with defaults
    - Full error hierarchy: DeepIDVError, AuthenticationError, RateLimitError, ValidationError, NetworkError, TimeoutError
    - TypedEmitter<TMap> with on/once/emit, unsubscribe-function pattern, SDKEventMap
    - vitest test setup with MSW server
    - packages/core/src/index.ts exports all Plan 02 types and classes
  affects:
    - 01-03 (HTTP client depends on config types, errors, and event emitter)
    - 01-04 (server client depends on all core internals)

tech-stack:
  added: []
  patterns:
    - "Error hierarchy with Object.setPrototypeOf(this, new.target.prototype) for cross-CJS/ESM instanceof"
    - "toJSON() on base error class for structured logging (D-08)"
    - "Unsubscribe-function pattern for event listeners (D-12)"
    - "TDD: write failing tests first, then implement to green"

key-files:
  created:
    - packages/core/src/config.ts
    - packages/core/src/errors.ts
    - packages/core/src/events.ts
    - packages/core/vitest.config.ts
    - packages/core/src/__tests__/setup.ts
    - packages/core/src/__tests__/errors.test.ts
    - packages/core/src/__tests__/events.test.ts
  modified:
    - packages/core/src/index.ts
    - packages/core/tsconfig.json

key-decisions:
  - "Added lib:[ES2022, DOM] to core tsconfig — DOM lib required for globalThis.fetch, URL, RequestInit, Response types; correct for a Web-API-first SDK"
  - "Kept FetchFunction as typeof globalThis.fetch (DOM-typed) rather than a custom minimal interface — cleaner, and DOM lib is the right long-term solution"

patterns-established:
  - "Error constructor pattern: Object.setPrototypeOf(this, new.target.prototype) in every error subclass — required for instanceof in CJS interop"
  - "API key redaction: sk_...{last4} format matching Stripe SDK (D-05)"
  - "Event emitter: snapshot listener array before iterating (spread) so mid-iteration unsubscription is safe"

requirements-completed: [ERR-01, ERR-02, ERR-03, ERR-04, ERR-05, ERR-06, EVT-01, EVT-02]

duration: 5min
completed: "2026-04-05"
---

# Phase 01 Plan 02: Config, Errors, and Event Emitter Summary

**Six-class error hierarchy with instanceof, toJSON, and API key redaction; typed event emitter with unsubscribe-function pattern; config types with defaults — all TDD-tested with 42 passing tests.**

## Performance

- **Duration:** ~5 minutes
- **Started:** 2026-04-05T17:53:15Z
- **Completed:** 2026-04-05T17:58:40Z
- **Tasks:** 2 (TDD)
- **Files created:** 7
- **Files modified:** 2

## Accomplishments

- Implemented complete error hierarchy (DeepIDVError + 5 subclasses) with proper `instanceof` support via `Object.setPrototypeOf`, `toJSON()` structured logging, `.response` for raw HTTP debug data, and API key redaction (last 4 chars)
- Implemented `TypedEmitter<TMap>` with `on()`/`once()`/`emit()` — listeners execute synchronously, exceptions are swallowed and re-emitted as `warning` events, no infinite recursion
- Implemented `DeepIDVConfig` / `ResolvedConfig` interfaces with `resolveConfig()` applying defaults (30s timeout, 3 retries, 500ms initial delay)
- Wired all types to `packages/core/src/index.ts` public exports

## Task Commits

1. **Task 1: Config types, error hierarchy, and tests** — `2030f49` (feat)
2. **Task 2: Typed event emitter and tests** — `a489441` (feat)
3. **Build fix: DOM lib + index exports** — `0901c38` (fix)

_Note: TDD tasks have integrated test+implementation commits per the plan's `tdd="true"` attribute._

## Files Created/Modified

- `packages/core/src/config.ts` — DeepIDVConfig, ResolvedConfig, resolveConfig(), DEFAULT_* constants
- `packages/core/src/errors.ts` — DeepIDVError, AuthenticationError, RateLimitError, ValidationError, NetworkError, TimeoutError; RawResponse interface
- `packages/core/src/events.ts` — TypedEmitter<TMap>, SDKEventMap type
- `packages/core/vitest.config.ts` — vitest config with globals, node env, MSW setup file
- `packages/core/src/__tests__/setup.ts` — MSW setupServer() with before/afterAll/afterEach hooks
- `packages/core/src/__tests__/errors.test.ts` — 31 tests covering all error classes and config (TDD)
- `packages/core/src/__tests__/events.test.ts` — 11 tests covering TypedEmitter (TDD)
- `packages/core/src/index.ts` — Updated from stub to export all Plan 02 types and classes
- `packages/core/tsconfig.json` — Added `lib: ["ES2022", "DOM"]` for Web API types

## Decisions Made

- Added `lib: ["ES2022", "DOM"]` to `packages/core/tsconfig.json` — the SDK is built on Web APIs (`fetch`, `URL`, `RequestInit`, `Response`) which require DOM lib types. Since the lib is used at type-check time only and not bundled, this doesn't affect runtime compatibility.
- Used `typeof globalThis.fetch` as the fetch field type rather than a custom minimal interface — cleaner API, no invented types, DOM lib is the right dependency for Web API types.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DTS build failed: DOM types not in lib**

- **Found during:** Task 2 (building after events.ts implementation)
- **Issue:** `tsconfig.base.json` only has `lib: ["ES2022"]`. `typeof globalThis.fetch` requires DOM lib for `fetch`, `URL`, `RequestInit`, `Response` types. tsup DTS build threw `TS7017: Element implicitly has an 'any' type` and `TS2304: Cannot find name 'URL'/'RequestInit'/'Response'`.
- **Fix:** Added `lib: ["ES2022", "DOM"]` to `packages/core/tsconfig.json` (package-level override, not root tsconfig — correct scope)
- **Files modified:** `packages/core/tsconfig.json`, `packages/core/src/config.ts` (reverted FetchFunction alias), `packages/core/src/index.ts`
- **Verification:** `pnpm -r build` exits 0, 42 tests pass
- **Committed in:** `0901c38`

---

**Total deviations:** 1 auto-fixed (1 build bug)
**Impact on plan:** Build fix was required for DTS output correctness. No scope creep — only added DOM lib to the package that actually uses Web APIs.

## Issues Encountered

None beyond the DOM lib build fix documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Config types, error classes, and event emitter are complete and exported from `@deepidv/core`
- Plan 03 (HTTP client + retry logic) can import `DeepIDVConfig`, `ResolvedConfig`, all error classes, and `TypedEmitter` directly
- The `RateLimitError.retryAfter` field is ready for retry logic to use (D-02)
- The `TypedEmitter` `retry` event (D-04) is typed and ready for retry.ts to emit

## Self-Check: PASSED

- All 7 created files found on disk
- All 3 commits (2030f49, a489441, 0901c38) verified in git history
- 42 tests pass, `pnpm -r build` exits 0

---
*Phase: 01-core-infrastructure*
*Completed: 2026-04-05*
