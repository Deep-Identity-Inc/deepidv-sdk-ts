---
phase: 1
slug: core-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `packages/core/vitest.config.ts` (Wave 0 creates) |
| **Quick run command** | `pnpm --filter @deepidv/core test` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @deepidv/core test`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TBD | TBD | TBD | TBD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Note: Task mappings will be populated after PLAN.md files are created.*

---

## Wave 0 Requirements

- [ ] `packages/core/vitest.config.ts` — vitest configuration
- [ ] `packages/core/src/__tests__/` — test directory structure
- [ ] vitest + msw dev dependencies installed in workspace root

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Deno import compatibility | COMPAT-02 | Deno not installed locally | `deno run --allow-net test-import.ts` in CI or manual env |
| Cloudflare Workers import | COMPAT-03 | Wrangler not installed locally | `wrangler dev` with test worker importing @deepidv/core |
| Bun import compatibility | COMPAT-04 | Bun not installed locally | `bun run test-import.ts` in CI or manual env |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
