---
phase: 07-tests-examples-publishing
plan: 03
subsystem: ci, publishing
tags: [github-actions, ci, changesets, npm-provenance, pnpm]

requires:
  - phase: 07-tests-examples-publishing
    plan: 02
    provides: changesets config, consumer type-check, tsup noExternal bundle

provides:
  - "CI workflow: Node 18 + 22 matrix, build, test, lint, format:check, consumer type-check on every PR"
  - "Publish workflow: changesets/action Version PR + npm publish with provenance on push to main"

affects:
  - publishing pipeline
  - PR automation
  - npm release flow

tech-stack:
  added:
    - "github-actions/checkout@v4"
    - "pnpm/action-setup@v4"
    - "actions/setup-node@v4"
    - "changesets/action@v1"
  patterns:
    - "Node matrix testing: [18, 22] per D-07 minimum supported + current LTS"
    - "pnpm/action-setup@v4 with version: 10 — v4 required for pnpm v10 support"
    - "Changesets PR-flow: changesets/action handles both Version PR creation and publish"
    - "npm provenance via id-token:write + --provenance flag links package to GitHub Actions run"
    - "concurrency guard prevents parallel publish runs on rapid pushes to main"

key-files:
  created:
    - .github/workflows/ci.yml
    - .github/workflows/publish.yml
  modified: []

key-decisions:
  - "pnpm/action-setup@v4 (not v3) — v3 does not support pnpm v10; project uses pnpm@10.28.0"
  - "Node matrix [18, 22]: Node 18 is minimum supported runtime per project constraints; Node 22 is current LTS"
  - "id-token:write permission enables npm provenance attestation — strongly recommended for public SDKs"
  - "concurrency: github.workflow-github.ref prevents parallel publish runs when multiple pushes land in quick succession"
  - "pnpm build runs before pnpm test in CI — consumer type-check and msw setup depend on build output"
  - "Publish workflow uses Node 22 only (not matrix) — only one node version needed to publish"
  - "NPM_TOKEN must be set as GitHub repo secret manually — documented here as user setup requirement"

requirements-completed: [PUB-03]

duration: 3min
completed: 2026-04-06
---

# Phase 07 Plan 03: GitHub Actions CI and Publish Workflows Summary

**Two GitHub Actions workflows: CI runs full test suite on Node 18 + 22 matrix for every PR; publish workflow uses changesets/action to create Version PRs and publish to npm with provenance attestation.**

## Performance

- **Duration:** ~3 minutes
- **Started:** 2026-04-06
- **Completed:** 2026-04-06
- **Tasks:** 2 completed
- **Files created:** 2

## Accomplishments

- Created `.github/workflows/ci.yml` — triggers on PR and push to main; tests Node 18 + 22 via matrix; runs pnpm install (frozen-lockfile), build, test, lint, format:check, and consumer type-check (tsc --noEmit)
- Created `.github/workflows/publish.yml` — triggers on push to main only; uses changesets/action@v1 for dual-mode operation (creates Version PR when changesets exist; runs publish when Version PR is merged); publishes with npm provenance via `--provenance` flag and `id-token: write` permission

## Task Commits

1. **Task 1: Create CI workflow for PR testing** - `b0dae2e` (feat)
2. **Task 2: Create publish workflow for changesets release** - `551d4d6` (feat)

## Files Created

- `.github/workflows/ci.yml` — Node 18 + 22 matrix CI: install, build, test, lint, format:check, consumer type-check
- `.github/workflows/publish.yml` — changesets/action release flow with npm provenance, concurrency guard, NPM_TOKEN secret

## User Setup Required

Before the publish workflow can publish to npm, a GitHub repository secret must be set:

- **Secret name:** `NPM_TOKEN`
- **Value:** An npm access token with publish rights to the `@deepidv` scope
- **Where to set:** GitHub repo → Settings → Secrets and variables → Actions → New repository secret

The `GITHUB_TOKEN` secret is automatically provided by GitHub Actions — no manual setup needed.

## Deviations from Plan

None — plan executed exactly as written. Both workflow files match the exact content specified in the plan.

## Known Stubs

None. Both workflows reference real scripts (`pnpm test`, `pnpm build`, etc.) that are wired in `package.json` and tested by prior plans.

## Self-Check: PASSED

- `.github/workflows/ci.yml` exists — FOUND
- `.github/workflows/publish.yml` exists — FOUND
- ci.yml contains `node-version: [18, 22]` — FOUND
- ci.yml contains `pnpm/action-setup@v4` — FOUND
- ci.yml contains `pnpm install --frozen-lockfile` — FOUND
- ci.yml contains `tsc --noEmit` — FOUND
- publish.yml contains `changesets/action` — FOUND
- publish.yml contains `NPM_TOKEN` — FOUND
- publish.yml contains `pnpm/action-setup@v4` — FOUND
- publish.yml contains `concurrency:` — FOUND
- Commit b0dae2e exists — FOUND
- Commit 551d4d6 exists — FOUND
