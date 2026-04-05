---
phase: 3
slug: sessions-module
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (installed) |
| **Config file** | `packages/server/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @deepidv/server test` |
| **Full suite command** | `pnpm --filter @deepidv/server test` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @deepidv/server test`
- **After every plan wave:** Run `pnpm --filter @deepidv/server test && pnpm --filter @deepidv/server build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | SESS-01 | unit | `pnpm --filter @deepidv/server test -- sessions` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | SESS-02 | unit | `pnpm --filter @deepidv/server test -- sessions` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | SESS-03 | unit | `pnpm --filter @deepidv/server test -- sessions` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 1 | SESS-04 | unit | `pnpm --filter @deepidv/server test -- sessions` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | SESS-04 | compile-time | `pnpm --filter @deepidv/server build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/server/src/__tests__/setup.ts` — msw server setup (mirrors `packages/core/src/__tests__/setup.ts`)
- [ ] `packages/server/src/__tests__/sessions.test.ts` — test stubs for SESS-01 through SESS-04

*Existing infrastructure: vitest installed, `packages/server/vitest.config.ts` has `passWithNoTests: true`*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| TypeScript rejects `'PENDING'` in `updateStatus()` | SESS-04 | Compile-time check, not runtime | Write `sessions.updateStatus(id, 'PENDING')` in a `.ts` file and verify `tsc` reports a type error |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
