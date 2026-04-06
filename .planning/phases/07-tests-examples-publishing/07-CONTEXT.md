# Phase 7: Tests, Examples & Publishing - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete test suite (fill gaps in existing vitest + msw tests, add consumer declaration-file validation), one example project (node-basic), and a changesets-based CI/CD pipeline that publishes `@deepidv/server` to npm with `@deepidv/core` bundled in. No new SDK features, no new modules, no UI components.

</domain>

<decisions>
## Implementation Decisions

### Test Coverage Scope
- **D-01:** Fill gaps in existing 10 test files to ensure every public method has at least one happy-path and one error-path test. No numeric coverage thresholds — coverage report generated but not gated.
- **D-02:** Consumer declaration-file validation (TEST-03) via inline tsc check: a `test/consumer/` folder with a `.ts` file that imports from `@deepidv/server` built output, verified by `tsc --noEmit`. No separate test project.
- **D-03:** Existing test patterns carried forward: real HttpClient + msw interception (not mocked HttpClient), `server.use()` per-test, `onUnhandledRequest: error`.

### Example Projects
- **D-04:** Ship only `examples/node-basic/` for v1. Express and Next.js examples deferred — they're the same SDK calls wrapped in route handlers.
- **D-05:** Example is a commented showcase (like Stripe's README examples) — a well-commented `.ts` file showing every SDK method with realistic inputs. Not runnable without a real API key.

### CI/CD Pipeline
- **D-06:** Changesets Release PR flow: merge `.changeset` files -> bot opens "Version Packages" PR -> merge that PR -> CI publishes to npm via `pnpm publish`.
- **D-07:** GitHub Actions test matrix: Node 18 + Node 22 (min supported + current LTS).
- **D-08:** CI runs tests on every PR. Publish workflow triggers on changesets release merge.

### Package Bundling
- **D-09:** Bundle `@deepidv/core` into `@deepidv/server` for v1 using tsup `noExternal`. Consumers install only `@deepidv/server`. Core is an internal implementation detail, not published separately.
- **D-10:** Inline both JS and type declarations — tsup with `dts: true` + `noExternal: ['@deepidv/core']`. Consumer sees only `@deepidv/server` types. No peer dependency on core.
- **D-11:** Split core out as a separate published package later if/when `@deepidv/web` is built. Avoids premature complexity for v1.

### Claude's Discretion
- Whether to add lint/format checks to the CI workflow (natural addition)
- Whether to add npm provenance to the publish step
- Exact structure of the changesets config (commit, access, baseBranch)
- Whether to remove `passWithNoTests: true` from vitest config now that real tests exist
- Ordering and grouping of test files if any reorganization is needed

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Build Guide
- `deepidv-sdk-build-guide.md` — Full type definitions, presigned upload flow, session response shapes, architectural decisions

### Existing Test Infrastructure
- `packages/core/src/__tests__/client.test.ts` — HTTP client tests (msw pattern reference)
- `packages/core/src/__tests__/retry.test.ts` — Retry logic tests
- `packages/core/src/__tests__/uploader.test.ts` — Upload handler tests
- `packages/server/src/__tests__/sessions.test.ts` — Sessions module tests (msw + real HttpClient pattern)
- `packages/server/src/__tests__/document.test.ts` — Document module tests
- `packages/server/src/__tests__/face.test.ts` — Face module tests
- `packages/server/src/__tests__/identity.test.ts` — Identity module tests
- `packages/server/src/deepidv.test.ts` — DeepIDV entry point tests

### Package Configuration
- `packages/server/package.json` — Already has `publishConfig.access: "public"`, tsup build, vitest
- `packages/server/tsup.config.ts` — Current build config (needs `noExternal` addition for core bundling)
- `package.json` (root) — `@changesets/cli` already in devDependencies

### Requirements
- `.planning/REQUIREMENTS.md` §Testing & Publishing — TEST-01, TEST-02, TEST-03, PUB-01, PUB-02, PUB-03, PUB-04

### Blockers (STATE.md)
- Core bundling decision is now resolved (D-09, D-10) — bundle into server for v1

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- 10 existing test files across core + server packages — pattern is established
- msw v2 already installed and configured in both packages
- vitest v4 already installed with run config
- `@changesets/cli` v2 already in root devDependencies (not yet initialized)

### Established Patterns
- Tests use real `HttpClient` + msw interception — not mocked HttpClient
- `server.use()` per-test with `onUnhandledRequest: error`
- Each module test file creates its own msw `setupServer` and handler set
- Zod schemas used for both input validation and response parsing

### Integration Points
- `packages/server/tsup.config.ts` — needs `noExternal: ['@deepidv/core']` for bundling
- `.changeset/config.json` — needs initialization (`npx changeset init`)
- `.github/workflows/` — new directory for CI + publish workflows
- `examples/node-basic/` — new directory for example project
- `test/consumer/` — new directory for declaration-file validation

</code_context>

<specifics>
## Specific Ideas

- Stripe SDK referenced as pattern for example code style (commented showcase, not runnable mock)
- "Bundle now, split later" explicitly chosen to avoid premature complexity
- Node 18 + 22 CI matrix chosen for min-supported + current-LTS coverage

</specifics>

<deferred>
## Deferred Ideas

- Express example project (`examples/express-app/`) — future, not needed for v1
- Next.js example project (`examples/nextjs-app/`) — future, not needed for v1
- Extracting `@deepidv/core` as a published package — when `@deepidv/web` is built
- Coverage thresholds — revisit if test quality becomes a concern

</deferred>

---

*Phase: 07-tests-examples-publishing*
*Context gathered: 2026-04-06*
