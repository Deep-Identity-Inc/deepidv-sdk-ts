---
phase: 2
slug: presigned-upload-handler
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.2 |
| **Config file** | `packages/core/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @deepidv/core test` |
| **Full suite command** | `pnpm --filter @deepidv/core test --run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @deepidv/core test --run`
- **After every plan wave:** Run `pnpm --filter @deepidv/core test --run && pnpm --filter @deepidv/core build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | UPL-01 | unit | `pnpm --filter @deepidv/core test uploader` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | UPL-02 | unit | `pnpm --filter @deepidv/core test uploader` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | UPL-03 | unit | `pnpm --filter @deepidv/core test uploader` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 1 | UPL-04 | unit | `pnpm --filter @deepidv/core test uploader` | ❌ W0 | ⬜ pending |
| 02-01-05 | 01 | 1 | UPL-05 | unit | `pnpm --filter @deepidv/core test uploader` | ❌ W0 | ⬜ pending |
| 02-01-06 | 01 | 1 | UPL-06 | unit | `pnpm --filter @deepidv/core test uploader` | ❌ W0 | ⬜ pending |
| 02-01-07 | 01 | 1 | UPL-07 | unit | verify import graph + msw handler assertion | ❌ W0 | ⬜ pending |
| 02-01-08 | 01 | 1 | VAL-01 | unit | `pnpm --filter @deepidv/core test uploader` | ❌ W0 | ⬜ pending |
| 02-01-09 | 01 | 1 | VAL-02 | unit | `pnpm --filter @deepidv/core test uploader` | ❌ W0 | ⬜ pending |
| 02-01-10 | 01 | 1 | VAL-03 | compile-time | `pnpm --filter @deepidv/core build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/core/src/__tests__/uploader.test.ts` — stubs for UPL-01 through UPL-07, VAL-01, VAL-02
- [ ] Reuse existing msw setup from `packages/core/src/__tests__/setup.ts`

*No new framework config or shared fixture changes needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No `fs`, `path`, or Node globals in built output | UPL-07/COMPAT | Bundle analysis requires runtime import | `import('@deepidv/core')` in CF Workers miniflare |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
