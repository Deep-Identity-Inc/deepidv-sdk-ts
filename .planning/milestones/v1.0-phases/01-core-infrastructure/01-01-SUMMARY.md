---
phase: 01-core-infrastructure
plan: 01
subsystem: monorepo-scaffold
tags: [pnpm, typescript, tsup, eslint, prettier, monorepo, build]
dependency_graph:
  requires: []
  provides:
    - pnpm workspace with @deepidv/core and @deepidv/server
    - TypeScript strict build pipeline (dual ESM+CJS)
    - ESLint flat config with typescript-eslint strictTypeChecked
    - Prettier formatting config
  affects:
    - All subsequent plans (depend on this buildable workspace)
tech_stack:
  added:
    - typescript@6.0.2
    - tsup@8.5.1
    - zod@4.3.6
    - pnpm@10.28.0
    - vitest@4.1.2
    - msw@2.12.14
    - eslint@9.39.4
    - typescript-eslint@8.58.0
    - prettier@3.8.1
    - "@changesets/cli@2.30.0"
  patterns:
    - pnpm workspaces with workspace:* protocol
    - tsup dual ESM+CJS with .d.ts via dts:true
    - ESLint v9 flat config with typescript-eslint
key_files:
  created:
    - pnpm-workspace.yaml
    - package.json
    - tsconfig.base.json
    - packages/core/package.json
    - packages/core/tsconfig.json
    - packages/core/tsup.config.ts
    - packages/core/src/index.ts
    - packages/server/package.json
    - packages/server/tsconfig.json
    - packages/server/tsup.config.ts
    - packages/server/src/index.ts
    - eslint.config.js
    - .prettierrc
    - .prettierignore
    - .gitignore (extended)
  modified: []
decisions:
  - "Used TypeScript 6.0.2 (latest stable) instead of ^5.4 per CLAUDE.md — RESEARCH.md confirmed 6.0.2 is GA since March 2026"
  - "Used zod 4.3.6 (latest stable) instead of ^3.23 per CLAUDE.md — RESEARCH.md recommends starting on v4 to avoid future migration"
  - "Added ignoreDeprecations:6.0 to tsconfig.base.json — TS6 deprecates baseUrl which tsup DTS builder injects internally"
  - "Added .prettierignore to exclude pnpm-lock.yaml (generated) from Prettier checks"
metrics:
  duration: "3 minutes"
  completed: "2026-04-05T21:50:25Z"
  tasks_completed: 2
  files_created: 14
  files_modified: 1
---

# Phase 01 Plan 01: Monorepo Scaffold Summary

**One-liner:** pnpm monorepo scaffolded with @deepidv/core and @deepidv/server packages building to dual ESM+CJS via tsup 8.5.1 with TypeScript 6.0.2 strict mode.

## What Was Built

A complete pnpm workspace monorepo with two packages:

- **@deepidv/core** (`packages/core/`) — internal shared package (private), stub index.ts, builds with tsup to `dist/index.{js,cjs,d.ts,d.cts}`
- **@deepidv/server** (`packages/server/`) — public developer-facing package, stub index.ts, builds identically, depends on `@deepidv/core` via `workspace:*`

Both packages have correct `exports` maps with `import`/`require` conditional paths pointing to `.js`/`.cjs` outputs and their respective `.d.ts`/`.d.cts` type declarations.

ESLint v9 flat config uses `typescript-eslint.configs.strictTypeChecked` with `@typescript-eslint/no-explicit-any: error`. Prettier configured with single quotes, trailing commas, 100 char print width.

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm install` | Exits 0 — 315 packages resolved |
| `pnpm -r build` | Exits 0 — both packages produce ESM, CJS, .d.ts, .d.cts |
| `pnpm lint` | Exits 0 — no ESLint errors |
| `pnpm format:check` | Exits 0 — all files formatted |
| ESM dynamic import test | `import('./packages/core/dist/index.js')` → `VERSION: 0.0.0` |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: Monorepo scaffold | `299f3b4` | feat(01-01): scaffold pnpm monorepo with @deepidv/core and @deepidv/server |
| Task 2: ESLint + Prettier | `d91c00c` | chore(01-01): configure ESLint flat config and Prettier |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript 6.0 deprecates `baseUrl` used internally by tsup DTS builder**

- **Found during:** Task 1 (first `pnpm -r build` attempt)
- **Issue:** tsup's DTS build passes `baseUrl` to TypeScript compiler; TypeScript 6.0 treats `baseUrl` as deprecated and throws a hard error (not a warning): `TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0`
- **Fix:** Added `"ignoreDeprecations": "6.0"` to `tsconfig.base.json` — this is the TypeScript-recommended migration path per the TS6 migration docs linked in the error message
- **Files modified:** `tsconfig.base.json`
- **Commit:** `299f3b4`

**2. [Rule 2 - Missing critical functionality] .prettierignore not in plan but required for clean `pnpm format:check`**

- **Found during:** Task 2 (Prettier check reported pnpm-lock.yaml formatting issues)
- **Issue:** `pnpm-lock.yaml` is a generated file not suitable for Prettier formatting; the plan acceptance criterion requires `pnpm format:check` exits without error
- **Fix:** Added `.prettierignore` to exclude `pnpm-lock.yaml` and `**/dist/**` from Prettier checks
- **Files modified:** `.prettierignore` (new)
- **Commit:** `d91c00c`

### Version Deviations (intentional, per RESEARCH.md)

- TypeScript: `^5.4` in CLAUDE.md → used `^6.0.2` (GA March 2026, RESEARCH.md confirmed)
- Zod: `^3.23` in CLAUDE.md → used `^4.3.6` (v4 is `latest` tag; RESEARCH.md recommends v4 to avoid migration)
- pnpm: `^9.x` in CLAUDE.md → using `10.28.0` (v10 is current)

## Known Stubs

Both `packages/core/src/index.ts` and `packages/server/src/index.ts` export only `VERSION = '0.0.0'`. These are intentional stubs per the plan — real exports are added in Plans 02 and 03 (core internals) and Plan 04 (server client). No data flows to UI rendering; these are infrastructure-only files.

## Self-Check: PASSED
