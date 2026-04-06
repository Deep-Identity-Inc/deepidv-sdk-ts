---
phase: 06-public-entry-point
plan: "01"
subsystem: server
tags: [entry-point, barrel, jsdoc, validation, zod]
dependency_graph:
  requires:
    - "05-identity-module/05-01: Identity class and types"
    - "04-document-face-primitives: Document, Face classes"
    - "03-sessions-module: Sessions class"
    - "@deepidv/core: HttpClient, FileUploader, TypedEmitter, mapZodError, resolveConfig"
  provides:
    - "DeepIDV public client class with Zod config validation"
    - "Rewritten barrel with explicit named exports only"
    - "Full JSDoc on all 9 public module methods"
  affects:
    - "packages/server/src/index.ts (rewritten)"
    - "packages/server/src/deepidv.ts (new)"
tech_stack:
  added:
    - "DeepIDVConfigSchema (z.object) for constructor-time config validation"
  patterns:
    - "Fail-fast constructor: Zod parse then mapZodError before any I/O"
    - "Eager module instantiation: all namespaces wired in constructor"
    - "Event delegation: on() proxies to internal TypedEmitter without exposing it"
    - "Explicit named exports only: no export* wildcards"
key_files:
  created:
    - packages/server/src/deepidv.ts
    - packages/server/src/deepidv.test.ts
  modified:
    - packages/server/src/index.ts
    - packages/server/src/sessions.ts
    - packages/server/src/document.ts
    - packages/server/src/face.ts
    - packages/server/src/identity.ts
decisions:
  - "DeepIDV class is the single public entry point; Sessions/Document/Face/Identity classes are internal implementation details not exported from the barrel"
  - "DeepIDVConfigSchema exported for consumers who need schema-driven config validation"
  - "on() method delegates to private TypedEmitter — emitter not exposed directly"
metrics:
  duration_seconds: 256
  completed_date: "2026-04-06"
  tasks_completed: 3
  files_modified: 7
---

# Phase 6 Plan 1: Public Entry Point Summary

## One-Liner

DeepIDV public client class with Zod config validation, eager module wiring, event delegation, full JSDoc on all 9 module methods, and explicit-only barrel exports.

## What Was Built

**Task 1 (TDD): DeepIDV class (`packages/server/src/deepidv.ts`)**

New file implementing the public SDK entry point. `DeepIDVConfigSchema` validates all config fields synchronously — `apiKey` (non-empty required), `baseUrl` (valid URL), `timeout`/`initialRetryDelay`/`uploadTimeout` (positive), `maxRetries` (non-negative int), `fetch` (function). On invalid config, `mapZodError` converts the `ZodError` to `ValidationError` before any I/O. After validation, `resolveConfig` applies defaults, then one shared `TypedEmitter`, `HttpClient`, and `FileUploader` are created and injected into all four module namespaces (`sessions`, `document`, `face`, `identity`) eagerly. The `on()` method proxies to the private emitter without exposing it.

8 vitest tests cover: valid construction, missing apiKey, empty apiKey, invalid baseUrl, negative timeout, negative maxRetries, valid custom baseUrl, and event subscription.

**Task 2: JSDoc backfill on all 9 public module methods**

Added `@example` blocks to all 9 public module methods that lacked them. Also added missing `@throws {AuthenticationError}` and `@throws {RateLimitError}` to `sessions.retrieve`, `sessions.list`, and `sessions.updateStatus`. No method signatures or logic changed. JSDoc is visible in generated `.d.ts` output (15 `@example` occurrences in `index.d.ts`).

**Task 3: Barrel rewrite (`packages/server/src/index.ts`)**

Replaced the old barrel (which exposed `Sessions`, `Document`, `Face`, `Identity` classes directly) with an explicit-named-exports-only barrel. Module classes are no longer exported — consumers access them only through `client.sessions`, `client.document`, etc. Exports include: `DeepIDV`, `DeepIDVConfigSchema`, `DeepIDVOptions`, `DeepIDVConfig`, all six error classes, `SDKEventMap`, `RawResponse`, and all type/schema exports from the four type modules. No `export *` wildcards. `@packageDocumentation` JSDoc added.

## Verification

- `pnpm build`: exits 0, produces ESM + CJS + .d.ts
- `npx vitest run`: 214 tests pass (12 test files)
- CJS require: `idx.DeepIDV` truthy; `idx.Sessions`, `idx.Document`, `idx.Face`, `idx.Identity` all undefined
- Zero TypeScript `any` type annotations in `packages/server/dist/index.d.ts` (8 occurrences are prose in JSDoc comments)

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 (TDD) | 9ea1878 | feat(06-01): create DeepIDV public entry point class with Zod config validation |
| Task 2 | 706755f | feat(06-01): backfill @example JSDoc on all 9 public module methods |
| Task 3 | 1e744ba | feat(06-01): rewrite server barrel with explicit named exports only |

## Deviations from Plan

None — plan executed exactly as written. All existing module files already had substantial JSDoc on individual methods (from prior phases); Task 2 added the missing `@example` blocks and supplementary `@throws` tags only.

## Known Stubs

None. All exports are fully wired to real implementations.

## Self-Check: PASSED
