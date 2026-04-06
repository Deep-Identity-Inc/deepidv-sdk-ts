---
phase: 07-tests-examples-publishing
plan: 02
subsystem: testing, publishing
tags: [tsup, changesets, typescript, consumer-typecheck, examples]

requires:
  - phase: 06-public-entry-point
    provides: DeepIDV class with all modules and public barrel exports

provides:
  - "@deepidv/core bundled inline into @deepidv/server via tsup noExternal"
  - "Changesets initialized with public access and core ignored"
  - "Consumer type-check (test/consumer) validates all public exports against built .d.ts"
  - "node-basic example showcasing all 9 SDK methods with comments"

affects:
  - publishing pipeline
  - consumer DX validation
  - CI test:types step

tech-stack:
  added: ["@changesets/cli (already in devDeps, now configured)", "consumer tsconfig with bundler resolution"]
  patterns:
    - "noExternal bundling: core inlined into server for zero-dep install"
    - "Consumer type-check against dist/index.d.ts (not source) validates publishing artifact"
    - "Changesets PR-flow: commit:false, access:public, core ignored"

key-files:
  created:
    - .changeset/config.json
    - .changeset/README.md
    - test/consumer/tsconfig.json
    - test/consumer/index.ts
    - examples/node-basic/index.ts
  modified:
    - packages/server/tsup.config.ts
    - package.json

key-decisions:
  - "noExternal: ['@deepidv/core'] in tsup.config.ts — core inlined; consumers install one package with no workspace dependency"
  - "Consumer tsconfig uses moduleResolution:bundler to exercise exports map the same way a real bundler would"
  - "paths in consumer tsconfig points to dist/index.d.ts not source — validates the publishing artifact, not the TypeScript source"
  - "changesets access:public, commit:false, ignore:[@deepidv/core] — core is internal, never published; PR-flow for version control"
  - "SDKEventMap event key is 'request' not 'request:start' — adjusted consumer assertion from plan spec after reading built d.ts"

patterns-established:
  - "Consumer type-check pattern: separate tsconfig, paths aliasing, tsc --noEmit against dist/"
  - "Example file pattern: Stripe-style comments, every method shown, error handling section, lifecycle events"

requirements-completed: [TEST-03, PUB-01, PUB-02, PUB-04]

duration: 4min
completed: 2026-04-06
---

# Phase 07 Plan 02: Bundle, Changesets, Consumer Type-Check, and Example Summary

**tsup noExternal bundles @deepidv/core inline; changesets initialized with public access; consumer tsc --noEmit validates all 33 public exports against built .d.ts; node-basic example documents every SDK method.**

## Performance

- **Duration:** ~4 minutes
- **Started:** 2026-04-06T14:39:18Z
- **Completed:** 2026-04-06T14:43:18Z
- **Tasks:** 2 completed
- **Files modified:** 7

## Accomplishments

- Added `noExternal: ['@deepidv/core']` to tsup — server bundle now inlines core, consumers install one package with zero workspace dependency
- Initialized changesets with `access: "public"`, `commit: false`, `ignore: ["@deepidv/core"]` — publishing pipeline ready for PR-flow versioning
- Created `test/consumer/index.ts` importing all 33 public exports (classes, schemas, types, error classes) — `tsc --noEmit` exits 0 against built `dist/index.d.ts`
- Created `examples/node-basic/index.ts` with Stripe-style documentation of all SDK methods: sessions (create/retrieve/list/updateStatus), document (scan), face (detect/compare/estimateAge), identity (verify), plus event subscription and error handling

## Task Commits

1. **Task 1: Configure tsup noExternal bundling, init changesets, add test:types script** - `315b3cc` (feat)
2. **Task 2: Create consumer type-check and node-basic example** - `f0f9a17` (feat)

## Files Created/Modified

- `packages/server/tsup.config.ts` — Added `noExternal: ['@deepidv/core']`
- `package.json` — Added `"test:types": "cd test/consumer && npx tsc --noEmit"` script
- `.changeset/config.json` — Changesets config: public access, commit:false, core ignored
- `.changeset/README.md` — Changesets documentation (auto-generated)
- `test/consumer/tsconfig.json` — moduleResolution:bundler, paths aliasing dist/index.d.ts
- `test/consumer/index.ts` — All 33 public exports imported and type-asserted; passes tsc --noEmit
- `examples/node-basic/index.ts` — Commented showcase of all SDK methods with error handling

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SDKEventMap event key corrected from 'request:start' to 'request'**
- **Found during:** Task 2 — type check failed with TS2339
- **Issue:** Plan's consumer/index.ts template used `SDKEventMap['request:start']` but the actual built .d.ts defines the key as `'request'` (confirmed by reading packages/core/dist/index.d.ts)
- **Fix:** Changed `SDKEventMap['request:start']` to `SDKEventMap['request']` in test/consumer/index.ts
- **Files modified:** test/consumer/index.ts
- **Commit:** f0f9a17

**2. [Rule 1 - Bug] Error class constructor signatures corrected**
- **Found during:** Task 2 — plan template used `new DeepIDVError('test', 500, 'TEST')` but actual signature is `(message: string, options?)`
- **Fix:** Adjusted all error constructor calls to match actual signatures from dist/index.d.ts
- **Files modified:** test/consumer/index.ts
- **Commit:** f0f9a17

## Known Stubs

None. All exports are wired to real implementations. The consumer type-check validates the built artifact, not mocks.

## Self-Check: PASSED

- `packages/server/tsup.config.ts` exists with noExternal — FOUND
- `.changeset/config.json` exists with ignore:[@deepidv/core] — FOUND
- `test/consumer/tsconfig.json` exists with moduleResolution:bundler — FOUND
- `test/consumer/index.ts` imports DeepIDV from @deepidv/server — FOUND
- `examples/node-basic/index.ts` contains all required methods — FOUND
- Commit 315b3cc exists — FOUND
- Commit f0f9a17 exists — FOUND
