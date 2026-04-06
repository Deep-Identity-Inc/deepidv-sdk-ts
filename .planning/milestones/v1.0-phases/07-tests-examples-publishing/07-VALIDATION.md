---
phase: 7
slug: tests-examples-publishing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest v4.1.2 |
| **Config file** | `packages/core/vitest.config.ts`, `packages/server/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @deepidv/server test` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test`
- **After every plan wave:** Run `pnpm test && pnpm build && cd test/consumer && tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | TEST-01 | unit | `pnpm --filter @deepidv/core test` | ✅ | ⬜ pending |
| 07-01-02 | 01 | 1 | TEST-02 | integration | `pnpm --filter @deepidv/server test` | ✅ | ⬜ pending |
| 07-01-03 | 01 | 1 | TEST-03 | type-check | `cd test/consumer && tsc --noEmit` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 2 | PUB-01 | manual verify | `ls .changeset/config.json` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 2 | PUB-02 | already done | `grep access packages/server/package.json` | ✅ | ⬜ pending |
| 07-02-03 | 02 | 2 | PUB-03 | CI (external) | Manual review | ❌ W0 | ⬜ pending |
| 07-02-04 | 02 | 2 | PUB-04 | static file | `ls examples/node-basic/index.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/consumer/tsconfig.json` — needed for TEST-03 consumer type check
- [ ] `test/consumer/index.ts` — imports all public exports; validates declaration files
- [ ] `.changeset/config.json` — created by `npx changeset init` then modified
- [ ] `.github/workflows/ci.yml` — PR test workflow
- [ ] `.github/workflows/publish.yml` — changesets publish workflow

*No test framework gaps — vitest infrastructure is complete*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| NPM_TOKEN secret exists | PUB-03 | GitHub secret cannot be verified in CI dry-run | Create npm automation token, add as `NPM_TOKEN` repo secret |
| Publish workflow triggers on release | PUB-03 | Requires actual changeset merge to test | Verify workflow YAML triggers on push to main with changeset |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
