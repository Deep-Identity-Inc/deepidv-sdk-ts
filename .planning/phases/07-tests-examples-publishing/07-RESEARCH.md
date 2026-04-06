# Phase 7: Tests, Examples & Publishing - Research

**Researched:** 2026-04-06
**Domain:** vitest test coverage, tsup bundling, changesets CI/CD, GitHub Actions
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Fill gaps in existing 10 test files to ensure every public method has at least one happy-path and one error-path test. No numeric coverage thresholds — coverage report generated but not gated.
- **D-02:** Consumer declaration-file validation (TEST-03) via inline tsc check: a `test/consumer/` folder with a `.ts` file that imports from `@deepidv/server` built output, verified by `tsc --noEmit`. No separate test project.
- **D-03:** Existing test patterns carried forward: real HttpClient + msw interception (not mocked HttpClient), `server.use()` per-test, `onUnhandledRequest: error`.
- **D-04:** Ship only `examples/node-basic/` for v1. Express and Next.js examples deferred.
- **D-05:** Example is a commented showcase (like Stripe's README examples) — a well-commented `.ts` file showing every SDK method with realistic inputs. Not runnable without a real API key.
- **D-06:** Changesets Release PR flow: merge `.changeset` files -> bot opens "Version Packages" PR -> merge that PR -> CI publishes to npm via `pnpm publish`.
- **D-07:** GitHub Actions test matrix: Node 18 + Node 22 (min supported + current LTS).
- **D-08:** CI runs tests on every PR. Publish workflow triggers on changesets release merge.
- **D-09:** Bundle `@deepidv/core` into `@deepidv/server` for v1 using tsup `noExternal`. Consumers install only `@deepidv/server`. Core is an internal implementation detail, not published separately.
- **D-10:** Inline both JS and type declarations — tsup with `dts: true` + `noExternal: ['@deepidv/core']`. Consumer sees only `@deepidv/server` types. No peer dependency on core.
- **D-11:** Split core out as a separate published package later if/when `@deepidv/web` is built.

### Claude's Discretion

- Whether to add lint/format checks to the CI workflow (natural addition)
- Whether to add npm provenance to the publish step
- Exact structure of the changesets config (commit, access, baseBranch)
- Whether to remove `passWithNoTests: true` from vitest config now that real tests exist
- Ordering and grouping of test files if any reorganization is needed

### Deferred Ideas (OUT OF SCOPE)

- Express example project (`examples/express-app/`) — future, not needed for v1
- Next.js example project (`examples/nextjs-app/`) — future, not needed for v1
- Extracting `@deepidv/core` as a published package — when `@deepidv/web` is built
- Coverage thresholds — revisit if test quality becomes a concern
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-01 | vitest + msw test suite with unit tests for HTTP client, retry logic, upload handler | 10 test files exist covering these; gaps identified in coverage audit below |
| TEST-02 | Integration tests for each module's request/response mapping against mocked API | sessions, document, face, identity test files exist; gap analysis reveals missing error-path tests |
| TEST-03 | Consumer declaration-file validation (import from built package in a test project) | `test/consumer/` + `tsc --noEmit` pattern documented; tsconfig path resolution requirements researched |
| PUB-01 | changesets for versioning and changelogs | `@changesets/cli ^2.30.0` already in root devDependencies; needs `changeset init` |
| PUB-02 | npm publish config with `"access": "public"` on `@deepidv/server` | Already present in `packages/server/package.json publishConfig`; no action needed |
| PUB-03 | GitHub Actions: test on PR, publish to npm on release | `.github/workflows/` directory does not exist; full workflow authoring required |
| PUB-04 | Example projects: node-basic only (express/next deferred per D-04) | `examples/node-basic/` does not exist; Stripe-style showcase pattern documented |
</phase_requirements>

---

## Summary

All 172 existing tests pass (`pnpm test` as of research date: 126 in core, 46 in server). The test infrastructure is fully operational — vitest v4.1.2, msw v2.12.14, established patterns in 10 files across both packages. Phase 7's test work is gap-filling (error paths, edge cases) plus two net-new additions: the consumer declaration validation (`test/consumer/`) and removing the `passWithNoTests: true` flag now that server tests exist.

The publishing pipeline starts from zero: no `.changeset/` directory, no `.github/workflows/` directory. The changesets CLI is already installed at root. The tsup config needs a single `noExternal: ['@deepidv/core']` addition to bundle core into the server output. Both of these are mechanical operations with well-understood patterns.

The `examples/node-basic/` showcase is purely additive — a `.ts` file with JSDoc-rich examples of every SDK method, not a runnable program (no API key injection, no test harness).

**Primary recommendation:** Execute in four discrete work units: (1) fill test gaps, (2) add consumer tsc check, (3) initialize changesets + tsup bundling, (4) author GitHub Actions workflows + node-basic example.

---

## Standard Stack

### Core (already installed — verified from package.json files)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | `^4.1.2` | Test runner | ESM-native, installed in root + both packages |
| msw | `^2.12.14` | HTTP mocking | Installed root + both packages; fetch-native interception |
| @changesets/cli | `^2.30.0` | Versioning + changelog | Root devDependency; standard monorepo publish flow |
| tsup | `^8.5.1` | Bundler | Root devDependency; handles `noExternal` bundling |
| typescript | `^6.0.2` | Language | Root devDependency |

### Supporting (for new work in this phase)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | — | All needed tools are already installed | — |

**No new dependencies required for Phase 7.**

---

## Existing Test Infrastructure Audit

### Current Coverage (Confirmed Passing — 2026-04-06)

| File | Tests | What's Covered |
|------|-------|----------------|
| `packages/core/src/__tests__/errors.test.ts` | 22 | All error classes, toJSON, cause chain, resolveConfig |
| `packages/core/src/__tests__/retry.test.ts` | 28 | buildHeaders, buildUrl, isRetryable, extractRetryAfter, computeDelay, withRetry |
| `packages/core/src/__tests__/client.test.ts` | 33 | HttpClient: happy path, auth headers, error mapping, timeout, AbortController, custom fetch, network failure, lifecycle events, retry integration, convenience methods |
| `packages/core/src/__tests__/uploader.test.ts` | 28 | toUint8Array, detectContentType, mapZodError, UploadOptionsSchema, FileUploader (presign, S3 PUT, timeout, retry, stream, events) |
| `packages/core/src/__tests__/events.test.ts` | 15 | TypedEmitter subscription, unsubscribe, multi-listener, error isolation |
| `packages/server/src/deepidv.test.ts` | 8 | DeepIDV constructor, module namespaces, ValidationError cases, on() method |
| `packages/server/src/__tests__/sessions.test.ts` | 13 | Sessions.create, retrieve, list, updateStatus — happy paths + validation errors |
| `packages/server/src/__tests__/document.test.ts` | 6 | Document.scan — happy path, documentType, field stripping, validation errors |
| `packages/server/src/__tests__/face.test.ts` | 9 | Face.detect, compare (batch presign), estimateAge — happy paths + validation |
| `packages/server/src/__tests__/identity.test.ts` | 11 | Identity.verify — happy path, batch presign, field forwarding, field stripping, verified:false, validation errors |

**Total: 172 tests passing (126 core, 46 server)**

### Gap Analysis: Missing Tests per D-01

These are the gaps that D-01 requires filling. Every public method needs at least one happy-path AND one error-path.

**`packages/server/src/__tests__/sessions.test.ts` — GAPS:**
- `Sessions.retrieve` has no 404 error-path test (API returns 404 for unknown session)
- `Sessions.list` has no server error (500) path test
- `Sessions.updateStatus` has no 404/server error test
- `Sessions.create` has no 401/server error test

**`packages/server/src/__tests__/document.test.ts` — GAPS:**
- `Document.scan` has no 401 error-path test
- `Document.scan` has no 500 server error test

**`packages/server/src/__tests__/face.test.ts` — GAPS:**
- `Face.detect` has no 401/500 error-path test
- `Face.compare` has no source or target image validation-error-only test (missing target is tested; missing source is not)
- `Face.estimateAge` has no 401/500 error-path test

**`packages/server/src/__tests__/identity.test.ts` — GAPS:**
- `Identity.verify` has no 401/500 server error test

**`packages/server/src/deepidv.test.ts` — GAPS:**
- No test for `maxRetries: 0` (zero is valid, should not throw)
- No test confirming `uploadTimeout` config field is accepted without error

**`packages/core/src/__tests__/uploader.test.ts` — GAPS:**
- File path input on edge runtime cannot be directly tested in Node environment (documented in file as intentional skip — acceptable)

**Existing gap total: ~12-15 test cases to add**

### `passWithNoTests: true` — Should Be Removed

The `packages/server/vitest.config.ts` has `passWithNoTests: true` — a Phase 1 workaround for when the server package had no tests. The server now has 46 tests. This flag should be removed as part of Phase 7 cleanup (Claude's discretion from CONTEXT.md).

---

## Architecture Patterns

### Pattern 1: Consumer Declaration Validation (TEST-03 / D-02)

**What:** A `test/consumer/` directory at the repo root containing a TypeScript file that imports from `@deepidv/server`'s built output (not source). Validated by `tsc --noEmit` without using vitest.

**Key constraint:** The consumer tsconfig must use `moduleResolution: bundler` or `node16`/`nodenext` to exercise the `exports` map. Using `moduleResolution: node` would bypass the exports map and miss resolution errors.

**Recommended directory structure:**
```
test/
└── consumer/
    ├── tsconfig.json    ← moduleResolution: bundler, paths pointing to packages/server/dist
    └── index.ts         ← imports all public exports, uses every type
```

**Consumer tsconfig.json:**
```json
{
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "bundler",
    "module": "esnext",
    "target": "es2022",
    "noEmit": true,
    "paths": {
      "@deepidv/server": ["../../packages/server/dist/index.js"]
    }
  },
  "include": ["index.ts"]
}
```

**Important:** The consumer test must run AFTER `pnpm build` has produced `packages/server/dist/`. In CI, add a build step before the consumer tsc check. Locally, developers must run `pnpm build` first.

**Script in root package.json:**
```json
"test:types": "cd test/consumer && tsc --noEmit"
```

**What consumer/index.ts should import:**
- `DeepIDV` class (instantiate with a fake key)
- `DeepIDVConfigSchema` (Zod schema)
- All error classes
- All type imports: `SessionCreateInput`, `DocumentScanResult`, `FaceCompareResult`, `IdentityVerificationResult`, etc.
- All Zod schema exports
- `SDKEventMap` type

**Why this catches real problems:** Validates that the `exports` map resolves, that `.d.ts` files are correctly generated, that re-exported core types surface properly, and that `noExternal` bundling did not break type visibility.

### Pattern 2: tsup `noExternal` Core Bundling (D-09, D-10)

**What:** Add `noExternal: ['@deepidv/core']` to `packages/server/tsup.config.ts`. This inlines all `@deepidv/core` code and types directly into `@deepidv/server`'s output. Consumers install only `@deepidv/server`.

**Updated tsup.config.ts:**
```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  target: 'es2022',
  outDir: 'dist',
  noExternal: ['@deepidv/core'],
});
```

**What changes in the build output:**
- `dist/index.js` will grow (currently 32.23 KB — will include core code)
- `dist/index.d.ts` will include all core types inline — `DeepIDVConfig`, error classes, `SDKEventMap`
- Consumer no longer needs `@deepidv/core` in their `node_modules`
- The `exports` re-export of `@deepidv/core` error classes in `packages/server/src/index.ts` will resolve correctly because core is bundled

**Verify after build:** Run `node -e "require('./packages/server/dist/index.cjs').DeepIDV"` to confirm CJS resolution works.

### Pattern 3: Changesets Initialize and Configure (PUB-01)

**Initialization:**
```bash
cd /path/to/repo && npx changeset init
```

This creates:
- `.changeset/config.json`
- `.changeset/README.md`

**Recommended `.changeset/config.json`:**
```json
{
  "$schema": "https://unpkg.com/@changesets/config/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@deepidv/core"]
}
```

**Key fields explained:**
- `"commit": false` — changesets bot creates a PR, not a direct commit
- `"access": "public"` — all published packages are public (aligns with `publishConfig.access: "public"` in server package.json)
- `"ignore": ["@deepidv/core"]` — `@deepidv/core` is private and should never be published (its `package.json` has `"private": true`)
- `"baseBranch": "main"` — base for version comparison

### Pattern 4: GitHub Actions Workflows (PUB-03)

**Two workflow files needed:**

#### `.github/workflows/ci.yml` — Run on every PR
```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    name: Test (Node ${{ matrix.node-version }})
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm test
      - run: pnpm lint
      - run: pnpm format:check
      - name: Consumer type check
        run: cd test/consumer && tsc --noEmit
```

#### `.github/workflows/publish.yml` — Changesets release publish
```yaml
name: Publish

on:
  push:
    branches: [main]

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
  publish:
    name: Publish to npm
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
          registry-url: 'https://registry.npmjs.org'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - name: Create Release Pull Request or Publish
        uses: changesets/action@v1
        with:
          publish: pnpm publish -r --no-git-checks
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Key details:**
- Uses `pnpm/action-setup@v4` — the correct action for pnpm v10 in GHA (v3 does not support pnpm v10)
- `--frozen-lockfile` prevents lockfile mutations in CI
- `pnpm publish -r --no-git-checks` publishes all non-private packages recursively; `--no-git-checks` is required in CI because changesets/action runs in a detached HEAD state
- `NPM_TOKEN` must be set as a repository secret — planner must flag this as a manual step
- `changesets/action@v1` handles both: creating the "Version Packages" PR (when changesets exist) and running publish (when the version PR is merged)

**npm provenance (Claude's discretion):** Add `--provenance` flag to the publish command and add `id-token: write` permission to the job for npm provenance attestation. This links the published package to the exact GitHub Actions run that built it — strongly recommended for public SDKs.

### Pattern 5: `examples/node-basic/` Showcase (PUB-04 / D-04, D-05)

**What it is:** A single `.ts` file in `examples/node-basic/index.ts` demonstrating every SDK method with realistic inputs and descriptive JSDoc. Not executable without a real API key (like Stripe's README examples). No `package.json` needed for v1.

**Recommended structure:**
```
examples/
└── node-basic/
    └── index.ts       ← showcases all SDK methods with comments
```

**Content template (to be filled by implementer):**
```typescript
/**
 * @deepidv/server — Basic Node.js Example
 *
 * This file demonstrates every method of the @deepidv/server SDK.
 * Replace 'your_api_key_here' with a real API key from https://dashboard.deepidv.com
 *
 * Run: npx tsx examples/node-basic/index.ts
 */
import { DeepIDV } from '@deepidv/server';
import { readFileSync } from 'fs';

const client = new DeepIDV({
  apiKey: process.env.DEEPIDV_API_KEY ?? 'your_api_key_here',
});

// --- Sessions ---
// Create a hosted verification session link to send to a user
const session = await client.sessions.create({
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  phone: '+15192223333',
});
console.log('Session URL:', session.sessionUrl);

// ... (all other SDK methods with inline comments)
```

**Import path:** Since examples are not a workspace package, the import `from '@deepidv/server'` will not resolve unless either (a) there's a `package.json` with a local path dependency, or (b) the example uses a relative path. For a showcase that is not executed in CI, a comment explaining this is sufficient. Do NOT add a full workspace `package.json` to examples — that adds CI complexity for no v1 benefit. The file exists for documentation value.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| npm publish lifecycle | Manual `npm publish` scripts | `changesets/action@v1` + `pnpm publish -r` | Handles Version PR creation, CHANGELOG generation, tag creation atomically |
| Declaration file validation | Custom script to parse `.d.ts` | `tsc --noEmit` against built output | tsc IS the TypeScript compiler — no better source of truth |
| pnpm in GitHub Actions | Manual install | `pnpm/action-setup@v4` | Official action, handles caching correctly |
| Test HTTP calls | `fetch-mock`, `nock`, manual stubs | msw v2 (already installed) | Already used throughout codebase — consistency |

---

## Common Pitfalls

### Pitfall 1: Consumer tsc Resolves Source, Not Build Output
**What goes wrong:** The consumer tsconfig uses a paths alias that points to `src/index.ts` instead of `dist/index.js`. The check passes, but it validates source types — not what consumers actually receive.
**Why it happens:** TypeScript paths resolution picks up the nearest matching entry. If the workspace is visible, TypeScript may resolve `@deepidv/server` through the workspace rather than the dist.
**How to avoid:** Point `paths["@deepidv/server"]` explicitly to `../../packages/server/dist/index.js` in `test/consumer/tsconfig.json`. Use a standalone tsconfig not extending the root tsconfig (which may have workspace-level paths).
**Warning signs:** Consumer check passes even without running `pnpm build` first.

### Pitfall 2: `pnpm publish` Without `--no-git-checks` Fails in CI
**What goes wrong:** `pnpm publish` checks that the working directory is clean and that you're on a tagged commit. In CI, `changesets/action` runs in a state that fails this check.
**Why it happens:** pnpm's publish guards against accidental publishes — but CI runs are intentional.
**How to avoid:** Use `pnpm publish -r --no-git-checks` in the publish workflow command.
**Warning signs:** CI fails at the publish step with "Unclean working directory" or "Not on a tagged commit" error.

### Pitfall 3: `pnpm/action-setup@v3` Does Not Support pnpm v10
**What goes wrong:** The workflow uses `pnpm/action-setup@v3` which caps at pnpm v9.x. The project uses pnpm v10.28.0 (confirmed in `package.json` `packageManager` field).
**Why it happens:** Outdated action version.
**How to avoid:** Use `pnpm/action-setup@v4` which supports pnpm v10.
**Warning signs:** CI fails with "pnpm version X not found" or package manager mismatch error.

### Pitfall 4: `@deepidv/core` Published by Changesets
**What goes wrong:** Changeset picks up `@deepidv/core` as a publishable package and tries to publish it to npm. Core is private and should never be published.
**Why it happens:** Changesets scans all workspace packages unless explicitly ignored.
**How to avoid:** Set `"ignore": ["@deepidv/core"]` in `.changeset/config.json`. Verify `@deepidv/core`'s `package.json` has `"private": true` (it does — confirmed from source).
**Warning signs:** Changesets reports `@deepidv/core` in the "Packages to be published" list.

### Pitfall 5: `noExternal` Causes Type Import Errors in Consumer Test
**What goes wrong:** After adding `noExternal: ['@deepidv/core']`, the bundled `.d.ts` may inline types but lose some re-export paths, causing the consumer tsc check to fail for types that were originally from `@deepidv/core`.
**Why it happens:** tsup's DTS bundler with `noExternal` sometimes has edge cases with re-exported types that are also exported by name.
**How to avoid:** Run the consumer tsc check immediately after adding `noExternal` to catch this early. If types fail to resolve, inspect the generated `dist/index.d.ts` for missing exports.
**Warning signs:** Consumer `index.ts` gets "Module has no exported member 'DeepIDVError'" after bundling.

### Pitfall 6: Tests Fail in Node 18 Matrix Due to Missing Web APIs
**What goes wrong:** Some Web APIs used in tests (e.g., `ReadableStream`, `structuredClone`) may not be in the Node 18 global scope or behave differently than in Node 22.
**Why it happens:** Node 18 introduced some Web APIs as experimental; full stabilization came in Node 20+.
**How to avoid:** The existing tests use `ReadableStream` (from uploader.test.ts) — verify CI Node 18 matrix does not regress these tests. Run `pnpm test` locally first with Node 18 if possible, or check CI results.
**Warning signs:** `ReferenceError: ReadableStream is not defined` on Node 18 CI run.

---

## Code Examples

### tsup.config.ts After noExternal Addition
```typescript
// Source: tsup docs — noExternal inlines the package into the bundle
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  target: 'es2022',
  outDir: 'dist',
  noExternal: ['@deepidv/core'],
});
```

### Consumer test/consumer/tsconfig.json
```json
{
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "bundler",
    "module": "esnext",
    "target": "es2022",
    "noEmit": true,
    "paths": {
      "@deepidv/server": ["../../packages/server/dist/index.js"]
    }
  },
  "include": ["index.ts"]
}
```

### .changeset/config.json
```json
{
  "$schema": "https://unpkg.com/@changesets/config/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@deepidv/core"]
}
```

### Verifying CJS and ESM resolution after noExternal build
```bash
# CJS resolution check
node -e "const { DeepIDV } = require('./packages/server/dist/index.cjs'); console.log(typeof DeepIDV);"

# ESM resolution check (Node 22 supports --input-type flag)
node --input-type=module -e "import { DeepIDV } from './packages/server/dist/index.js'; console.log(typeof DeepIDV);"
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Test matrix (min version) | Yes | v22.18.0 (local) | — |
| pnpm | All build/test/publish | Yes | v10.28.0 | — |
| @changesets/cli | PUB-01 | Yes (in root devDeps) | ^2.30.0 | — |
| GitHub Actions | PUB-03 | Depends on repo | — | N/A — requires GitHub remote |
| NPM_TOKEN secret | PUB-03 publish job | Not set (new) | — | Manual setup required by developer |
| `changeset init` | PUB-01 config file | Runnable via `npx changeset init` | — | — |
| `.github/workflows/` dir | PUB-03 | Does not exist yet | — | Must be created |
| Node 18 (CI matrix) | D-07 | Not on local machine | — | Node 18 is available on `ubuntu-latest` GHA runner |

**Missing dependencies with no fallback:**
- `NPM_TOKEN` secret: Must be manually created at `https://www.npmjs.com/settings/<user>/tokens` with Automation type, then added to GitHub repo secrets as `NPM_TOKEN`. This is a manual developer step; the planner must include it as an instruction, not an automated task.

**Missing dependencies with fallback:**
- None — all required tools are installed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest v4.1.2 |
| Config file | `packages/core/vitest.config.ts`, `packages/server/vitest.config.ts` |
| Quick run command | `pnpm --filter @deepidv/server test` |
| Full suite command | `pnpm test` (runs both core + server) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | HTTP client, retry logic, upload handler unit tests | unit | `pnpm --filter @deepidv/core test` | Yes — 5 core test files |
| TEST-02 | Module integration tests (sessions, document, face, identity) | integration | `pnpm --filter @deepidv/server test` | Yes — 4 module test files |
| TEST-03 | Consumer declaration-file validation | type-check | `cd test/consumer && tsc --noEmit` | No — Wave 0 gap |
| PUB-01 | changeset init + config | manual verify | `ls .changeset/config.json` | No — Wave 0 gap |
| PUB-02 | publishConfig.access: public | already done | `cat packages/server/package.json \| grep access` | Yes |
| PUB-03 | GitHub Actions workflows exist and pass | CI (external) | Manual review | No — Wave 0 gap |
| PUB-04 | examples/node-basic/index.ts exists | static file check | `ls examples/node-basic/index.ts` | No — Wave 0 gap |

### Sampling Rate

- **Per task commit:** `pnpm test`
- **Per wave merge:** `pnpm test && pnpm build && cd test/consumer && tsc --noEmit`
- **Phase gate:** Full suite green + consumer tsc green + build succeeds before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `test/consumer/tsconfig.json` — needed for TEST-03 consumer type check
- [ ] `test/consumer/index.ts` — imports all public exports; validates declaration files
- [ ] `.changeset/config.json` — created by `npx changeset init` then modified
- [ ] `.github/workflows/ci.yml` — PR test workflow
- [ ] `.github/workflows/publish.yml` — changesets publish workflow

*(No test framework gaps — vitest infrastructure is complete)*

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pnpm/action-setup@v3` | `pnpm/action-setup@v4` | 2024 | v4 supports pnpm v10+; v3 caps at v9 |
| changesets with `commit: true` | `commit: false` + PR flow | Standard practice | PR flow gives reviewability; direct commit skips review |
| `actions/setup-node@v3` | `actions/setup-node@v4` | 2024 | v4 has improved caching and Node 22 support |

---

## Open Questions

1. **NPM_TOKEN must be manually created**
   - What we know: The publish workflow requires `secrets.NPM_TOKEN`. This cannot be automated.
   - What's unclear: Whether the developer has an existing npm organization token or needs to create a new automation token.
   - Recommendation: Planner should add an explicit manual step: "Create npm automation token and add as GitHub secret `NPM_TOKEN`." This is not a code task — it's documentation.

2. **Node 18 Web API compatibility for ReadableStream in tests**
   - What we know: `packages/core/src/__tests__/uploader.test.ts` uses `ReadableStream` extensively. Node 18 supports `ReadableStream` globally (added in Node 18.0.0 via `--experimental-fetch`, stabilized in 18.x).
   - What's unclear: Whether msw v2.12.14 has any Node 18-specific issues.
   - Recommendation: Include Node 18 in the test matrix as planned (D-07) and let CI reveal any regressions. If failures occur, the fix is `globalThis.ReadableStream` polyfill in the vitest setup file — not likely needed.

3. **Whether `examples/node-basic/index.ts` should use relative import or `@deepidv/server`**
   - What we know: D-05 says "not runnable without a real API key." The import `from '@deepidv/server'` won't resolve unless there's a `package.json` with a local dep or the package is installed globally.
   - Recommendation: Use a comment at the top of the file explaining that this file requires `@deepidv/server` to be installed. The file itself uses `import { DeepIDV } from '@deepidv/server'` — standard import for a showcase. Do not add a `package.json` to `examples/` for v1. TypeScript `tsc --noEmit` on this file is NOT part of TEST-03 (the consumer check uses built output, not examples).

---

## Sources

### Primary (HIGH confidence)

- Codebase: `packages/server/package.json`, `packages/core/package.json`, `package.json` (root) — version verification
- Codebase: All 10 test files — gap analysis performed via direct read
- Codebase: `packages/server/vitest.config.ts` — `passWithNoTests: true` confirmed
- Codebase: `packages/server/tsup.config.ts` — current config read; `noExternal` not yet present
- Build run: `pnpm build` output — dist files verified, current sizes documented
- Test run: `pnpm test` output — 172 passing tests confirmed

### Secondary (MEDIUM confidence)

- tsup docs (https://tsup.egoist.dev/#externals) — `noExternal` config option behavior
- changesets docs (https://github.com/changesets/changesets/blob/main/docs/config-file-options.md) — config.json options
- pnpm/action-setup GitHub (https://github.com/pnpm/action-setup) — v4 supports pnpm v10
- changesets/action GitHub (https://github.com/changesets/action) — `publish` param usage

### Tertiary (LOW confidence — flag for validation)

- Node 18 ReadableStream global availability — training data; recommend validating against CI Node 18 matrix result

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions confirmed from package.json files in codebase
- Test gap analysis: HIGH — performed by reading all 10 test files directly
- tsup noExternal pattern: HIGH — well-documented feature, single-line change
- changesets config: HIGH — official docs pattern; ignore field is standard
- GitHub Actions workflow: MEDIUM — `pnpm/action-setup@v4` + `changesets/action@v1` are current; exact pnpm publish flags verified against known gotchas
- Consumer tsc check: HIGH — `tsc --noEmit` with explicit paths is standard TypeScript

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable tooling domain — changesets/tsup APIs do not change frequently)
