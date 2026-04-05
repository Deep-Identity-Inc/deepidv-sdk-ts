<!-- GSD:project-start source:PROJECT.md -->
## Project

**deepidv Server SDK**

A backend-first TypeScript SDK (`@deepidv/server`) that wraps the deepidv identity verification API. Developers install it on their server (Node 18+, Deno, Bun, Cloudflare Workers, edge runtimes) and programmatically create verification sessions, scan IDs, compare faces, estimate age, and verify identities. The SDK handles file uploads to S3 via presigned URLs under the hood — developers just pass image buffers and get typed results back. This is not a UI kit.

**Core Value:** Developers pass images in and get typed verification results back — all presigned URL orchestration, retry logic, and error handling is invisible.

### Constraints

- **Runtime compatibility**: Must work on Node 18+, Deno, Bun, Cloudflare Workers, and edge runtimes — no Node-specific APIs in core
- **Zero AWS SDKs**: SDK only talks to api.deepidv.com over HTTPS — never directly to AWS services
- **Minimal dependencies**: Only zod. Everything else via native web APIs
- **TypeScript strictness**: `strict: true`, zero `any`, full JSDoc on all public API surface
- **Auth**: x-api-key header on every request
- **Retry policy**: Exponential backoff with jitter on 429 and 5xx only, never retry 4xx
- **Build output**: Dual ESM + CJS via tsup with .d.ts generation
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Build Tooling
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TypeScript | `^5.4` | Language | Strict mode, `satisfies` operator, const type parameters. 5.4 is stable and widely supported as of mid-2025. |
| tsup | `^8.x` | Bundler | Wraps esbuild for fast dual ESM + CJS output with `.d.ts` generation. Zero-config path to `exports` map that satisfies Node, Deno, Bun, and CF Workers. Eliminates the rollup config complexity that is never justified for an SDK this size. |
| esbuild | (peer of tsup) | Transpiler | Not used directly; tsup delegates to it. Included here to note that `.d.ts` isolation requires `isolatedDeclarations` or `tsc --emitDeclarationOnly` as a secondary step — tsup handles this automatically with `dts: true`. |
- **vs rollup + dts-bundle-generator**: Rollup gives more control but requires 3-4 plugins and 80+ lines of config to reproduce what tsup does in 15. No benefit for a single-package SDK with no tree-shaking surface (consumers tree-shake, not the SDK itself).
- **vs unbuild (unjs)**: Unbuild uses rollup internally and is optimized for the Nuxt/unjs ecosystem. No advantage here; less documentation and community than tsup.
- **vs tsc alone**: `tsc` cannot produce CJS + ESM simultaneously without a second compilation pass. It also doesn't produce a proper `exports` map without manual `package.json` editing.
- **vs pkgroll**: Newer, less battle-tested. tsup has years of production use across high-profile SDKs (Prisma client, many Vercel/Cloudflare tooling packages).
### Runtime Validation
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| zod | `^3.23` | Input validation + type inference | Schema-first approach: the schema IS the TypeScript type via `z.infer<>`. Zero transitive dependencies. Runs in all target runtimes (no Node-specific APIs). PROJECT.md mandates it as the single production dependency. |
- **vs valibot**: Valibot is modular/tree-shakeable and smaller per-import, but its API is more verbose for nested object schemas. Zod's developer experience is better for a public SDK where schema definitions also serve as documentation.
- **vs io-ts**: Functional programming style (`Either` types) is unfamiliar to most backend developers. Poor DX for a public-facing SDK.
- **vs arktype**: Excellent type inference, but smaller community and less documentation than zod as of mid-2025.
- **vs yup**: yup infers types less precisely than zod and has weaker TypeScript integration.
### Testing Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| vitest | `^1.6` or `^2.x` | Test runner | ESM-native, esbuild-powered, Jest-compatible API with zero config in a tsup project. Runs tests in Node, and with the `edge-runtime` pool can approximate Cloudflare Workers. |
| msw | `^2.x` | HTTP mocking | Service Worker-based interception that works in Node (via `@mswjs/interceptors`). No mock server to start/stop — declare handlers declaratively. v2 is a rewrite of v1 with a cleaner API. |
- Jest requires `babel-jest` or `ts-jest` to handle TypeScript + ESM, adding config surface. Vitest uses the same esbuild pipeline as tsup — tests run against the same transpilation that ships. No transformation mismatch.
- Vitest's watch mode is faster for iterative development.
- For an ESM-first codebase targeting 2025+, Jest's ESM support (experimental) is a friction point that vitest eliminates.
- `nock` patches Node's `http` module — incompatible with the native `fetch` this SDK uses.
- `fetch-mock` patches the global `fetch` — works, but msw's handler model is more maintainable and mirrors how real API contracts are expressed (method + path + response).
- msw v2 works identically in Node and browsers, which matters if `@deepidv/web` is added later.
### Monorepo Tooling
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| pnpm | `^9.x` | Package manager + workspace host | Native workspaces (`pnpm-workspace.yaml`), strict dependency isolation by default (hoisting opt-in), fast installs via content-addressable store. PROJECT.md mandates pnpm workspaces for `@deepidv/core` + `@deepidv/server`. |
- **vs npm workspaces**: npm hoists everything to root by default — packages can accidentally import undeclared dependencies (phantom dependencies). pnpm's strict hoisting prevents this and catches missing `dependencies` entries at install time rather than at runtime.
- **vs yarn berry (PnP)**: Yarn Plug'n'Play has compatibility issues with many tools (native addons, certain bundlers). The zero-installs feature is not relevant for a dev-time monorepo. pnpm's workspace protocol (`workspace:*`) is simpler.
- **vs Turborepo**: Turborepo is a task runner on top of a package manager, not a replacement. Can be layered onto pnpm later if build caching becomes valuable. Not needed at this scale (2 packages).
- **vs Nx**: Nx is heavyweight for 2 packages. Adds a large config surface with minimal benefit at this scale.
### Publishing Pipeline
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @changesets/cli | `^2.x` | Versioning + changelog | Semver-aware changeset workflow: developers write a `.changeset/*.md` describing the change, CI runs `changeset version` to bump `package.json` and generate `CHANGELOG.md`, then `changeset publish` to publish. Supports monorepos natively. |
- **vs semantic-release**: `semantic-release` is commit-message driven (Conventional Commits). It automates 100% of the decision. Changesets gives the developer explicit control over what is a patch vs minor vs major — appropriate for a public SDK where a minor internal refactor should never accidentally increment the minor version.
- **vs release-it**: Lower-level tool, less opinionated about monorepos. More manual setup required for linked versioning across packages.
- **vs manual versioning**: Leads to CHANGELOG drift and version mistakes. Changesets makes this process auditable (each `.changeset` file is reviewed in the PR).
### Linting + Formatting
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| ESLint | `^9.x` | Linting | v9 with flat config (`eslint.config.js`). `typescript-eslint` v8+ supports flat config natively. |
| typescript-eslint | `^8.x` | TypeScript rules | `@typescript-eslint/recommended-type-checked` ruleset catches `any` usage, unsafe assignments, and missing return types — enforces the PROJECT.md zero-`any` requirement. |
| Prettier | `^3.x` | Formatting | Opinionated formatter, no debates. Integrate via `eslint-plugin-prettier` or run as a separate step. |
## Package Configuration (`package.json` exports map)
## TypeScript Configuration
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Build | tsup | rollup | Rollup requires 4+ plugins for equivalent output; zero additional capability for this use case |
| Build | tsup | unbuild | Nuxt-ecosystem bias, less documentation |
| Build | tsup | tsc | Cannot produce dual output in one pass |
| Validation | zod v3 | valibot | More verbose API; worse DX for public SDK schemas |
| Validation | zod v3 | arktype | Smaller community, less documentation |
| Testing | vitest | jest | Jest + ESM + TypeScript = multiple transformation plugins; vitest has zero config for this stack |
| HTTP mocking | msw v2 | nock | nock patches `http` module; incompatible with native `fetch` |
| HTTP mocking | msw v2 | fetch-mock | Less maintainable handler model; no isomorphic story |
| Monorepo | pnpm | npm workspaces | Phantom dependency problem; weaker isolation |
| Monorepo | pnpm | yarn berry | PnP compatibility issues; complexity without benefit |
| Publishing | changesets | semantic-release | Commit-driven automation is too coarse for a public SDK; changeset gives explicit control |
## Installation
# Install pnpm globally first
# Root dev dependencies
# @deepidv/core
# @deepidv/server (depends on core)
## Confidence Assessment
| Decision | Confidence | Basis | Verify Before Shipping |
|----------|------------|-------|------------------------|
| tsup as bundler | HIGH | PROJECT.md mandated; well-established for this use case | Confirm latest tsup version at npmjs.com |
| zod v3 as validator | HIGH | PROJECT.md mandated; only production dependency | Check if zod v4 stable shipped; evaluate migration |
| vitest as test runner | HIGH | PROJECT.md mandated; correct for ESM-first stack | Confirm v2.x is current stable |
| msw v2 for HTTP mocking | HIGH | PROJECT.md mandated; correct fetch-native choice | Confirm v2.x API unchanged |
| pnpm v9 + workspaces | HIGH | PROJECT.md mandated; correct for strict dependency isolation | Confirm v9.x is current |
| changesets for publishing | MEDIUM | Strongly implied by PROJECT.md; standard monorepo practice | No known alternatives superior for this use case |
| TypeScript `^5.4` | MEDIUM | Training data; 5.4 was stable at cutoff | Run `npm show typescript version` to confirm latest |
| ESLint flat config v9 | MEDIUM | Training data; v9 + flat config was current at cutoff | Confirm typescript-eslint v8 supports flat config |
| exports map shape | HIGH | Specified pattern is well-documented and runtime-tested | Test against Node `require()` and CF Workers resolver |
## Sources
- PROJECT.md (project-defined constraints): `C:/Users/omart/subprime/deepidv-sdk-ts/.planning/PROJECT.md`
- tsup documentation: https://tsup.egoist.dev (unable to fetch live during this session)
- Zod documentation: https://zod.dev (unable to fetch live during this session)
- Vitest documentation: https://vitest.dev (unable to fetch live during this session)
- MSW documentation: https://mswjs.io (unable to fetch live during this session)
- Changesets documentation: https://github.com/changesets/changesets (unable to fetch live during this session)
- **Note:** All version numbers should be independently verified via `npm show <package> version` before use. External tools were unavailable during this research session.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
