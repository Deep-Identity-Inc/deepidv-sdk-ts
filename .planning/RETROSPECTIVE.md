# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — deepidv Server SDK

**Shipped:** 2026-04-06
**Phases:** 7 | **Plans:** 18 | **Tasks:** 25

### What Was Built
- Complete TypeScript SDK wrapping deepidv identity verification API
- 9 public methods across 4 module namespaces (sessions, document, face, identity)
- Presigned URL upload handler with parallel batch uploads and content-type detection
- Native fetch HTTP client with typed error hierarchy and exponential backoff retry
- 185-test suite (vitest + msw) with consumer type-check validation
- CI/CD pipeline via GitHub Actions and changesets

### What Worked
- Inside-out build order (core infra → upload handler → modules → entry point → tests) prevented rework — each phase built on verified foundations
- Zod-first schema design gave compile-time types AND runtime validation from a single source
- msw handler-based HTTP mocking was clean and maintainable across all module test suites
- Phase verification caught real bugs: 07-VERIFICATION found 6 incorrect field names in examples before they shipped
- noExternal bundling (@deepidv/core inlined into @deepidv/server) eliminated workspace:* resolution issues for consumers

### What Was Inefficient
- Phase 02 had DTS build errors (Uint8Array/BodyInit and process/Deno/Bun globals) that required iteration to resolve — runtime type declarations for edge runtimes need a pattern upfront
- Some SUMMARY.md one-liners were malformed (blocking rules instead of descriptions) — template compliance varied across executor runs
- Phase 07 gap closure (07-04) was needed because examples used wrong field names — could have been caught by a type-check step in the example creation plan itself

### Patterns Established
- Grouped module API (`client.face.detect()`) over flat (`client.detectFace()`) — matches API structure, better autocomplete
- Independent schemas per module (identity doesn't reuse document/face types) — decoupled evolution
- DeepIDV class as single entry point with eager module wiring — simple DI, no lazy loading complexity
- Consumer type-check as a build validation step (import from built package, not source)

### Key Lessons
1. Example projects should be type-checked against built output as part of the plan that creates them — don't defer validation to a later phase
2. Batch presign API design should accept per-file content types from the start, not just the first file's type — this is now tech debt
3. Phase verification is high-value even when all tests pass — it caught documentation-level bugs that tests don't cover

### Cost Observations
- Model mix: ~20% opus (orchestration, verification), ~80% sonnet (execution, research, planning)
- Full milestone completed in 2 days (2026-04-05 → 2026-04-06)
- 112 commits across 7 phases
- Notable: Worktree isolation for executor agents prevented git conflicts in parallel execution

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 7 | 18 | Initial milestone — established inside-out build pattern |

### Cumulative Quality

| Milestone | Tests | LOC | Dependencies |
|-----------|-------|-----|-------------|
| v1.0 | 185 | 6,730 | 1 (zod) |

### Top Lessons (Verified Across Milestones)

1. Type-check examples against built output, not source
2. Phase verification catches bugs that unit tests miss
