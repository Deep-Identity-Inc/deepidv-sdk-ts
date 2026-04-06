# Phase 7: Tests, Examples & Publishing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 07-tests-examples-publishing
**Areas discussed:** Test coverage scope, Example projects, CI/CD pipeline, Package bundling

---

## Test Coverage Scope

### Consumer Declaration-File Test (TEST-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Inline tsc check | test/consumer/ folder with .ts importing built output, tsc --noEmit | ✓ |
| Separate test project | Standalone project with own package.json, installs from tarball | |
| Both | Inline for CI, tarball project as manual smoke test | |

**User's choice:** Inline tsc check
**Notes:** Lightweight, no extra project to maintain.

### Coverage Thresholds

| Option | Description | Selected |
|--------|-------------|----------|
| No thresholds | Every public method has happy + error test. Report generated, not gated. | ✓ |
| Soft threshold (80%) | Warn but don't fail below 80% | |
| Hard threshold (90%) | Fail CI below 90% | |

**User's choice:** No thresholds
**Notes:** None.

---

## Example Projects

### Which Examples to Ship

| Option | Description | Selected |
|--------|-------------|----------|
| Node basic only | Single examples/node-basic/ showing all SDK methods | ✓ |
| Node + Express | Node basic plus Express app with API routes | |
| All three | Node basic, Express, Next.js | |

**User's choice:** Node basic only
**Notes:** Express and Next.js deferred — same SDK calls wrapped in route handlers.

### Example Style

| Option | Description | Selected |
|--------|-------------|----------|
| Commented showcase | Well-commented .ts showing every method, not runnable without API key | ✓ |
| Runnable with mock | Includes local msw mock server for end-to-end execution | |
| Both modes | Runs against real API, falls back to mock if no key | |

**User's choice:** Commented showcase
**Notes:** Like Stripe's README examples.

---

## CI/CD Pipeline

### Publish Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Changesets Release PR | Standard changesets flow: bot opens Version Packages PR, merge publishes | ✓ |
| Git tag trigger | Push v*.*.* tag, CI builds and publishes | |
| Manual dispatch | workflow_dispatch button in GitHub Actions | |

**User's choice:** Changesets Release PR
**Notes:** None.

### Node CI Matrix

| Option | Description | Selected |
|--------|-------------|----------|
| 18 + 22 | Min supported + current LTS | ✓ |
| 18 + 20 + 22 | All active LTS versions | |
| 22 only | Just current LTS | |

**User's choice:** 18 + 22
**Notes:** None.

---

## Package Bundling

### Core Bundling Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Bundle into server | tsup noExternal bundles core into server dist. Consumers install only @deepidv/server. | |
| Publish both packages | Publish core and server separately, server declares core as npm dep. | |
| Bundle now, split later | Bundle for v1, extract core when @deepidv/web is built. | ✓ |

**User's choice:** Bundle now, split later
**Notes:** Avoids premature complexity for v1.

### DTS Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Inline everything | tsup dts: true + noExternal inlines both JS and type declarations | ✓ |
| Separate core types | Bundle JS but keep core as types-only peer dependency | |

**User's choice:** Inline everything
**Notes:** Cleanest consumer experience.

---

## Claude's Discretion

- Whether to add lint/format checks to CI
- Whether to add npm provenance
- Changesets config details
- Removing passWithNoTests flag
- Test file reorganization

## Deferred Ideas

- Express example project — future
- Next.js example project — future
- Publishing @deepidv/core separately — when @deepidv/web is built
- Coverage thresholds — revisit if needed
