# Technology Stack

**Project:** deepidv Server SDK (`@deepidv/server`)
**Researched:** 2026-04-05
**Confidence note:** External search tools (WebSearch, WebFetch, npm registry) were unavailable during this research session. Version numbers are based on training data (cutoff August 2025). All versions should be confirmed at `npmjs.com` before pinning in `package.json`. Confidence levels reflect this constraint explicitly.

---

## Recommended Stack

### Core Build Tooling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TypeScript | `^5.4` | Language | Strict mode, `satisfies` operator, const type parameters. 5.4 is stable and widely supported as of mid-2025. |
| tsup | `^8.x` | Bundler | Wraps esbuild for fast dual ESM + CJS output with `.d.ts` generation. Zero-config path to `exports` map that satisfies Node, Deno, Bun, and CF Workers. Eliminates the rollup config complexity that is never justified for an SDK this size. |
| esbuild | (peer of tsup) | Transpiler | Not used directly; tsup delegates to it. Included here to note that `.d.ts` isolation requires `isolatedDeclarations` or `tsc --emitDeclarationOnly` as a secondary step — tsup handles this automatically with `dts: true`. |

**Why tsup over alternatives:**
- **vs rollup + dts-bundle-generator**: Rollup gives more control but requires 3-4 plugins and 80+ lines of config to reproduce what tsup does in 15. No benefit for a single-package SDK with no tree-shaking surface (consumers tree-shake, not the SDK itself).
- **vs unbuild (unjs)**: Unbuild uses rollup internally and is optimized for the Nuxt/unjs ecosystem. No advantage here; less documentation and community than tsup.
- **vs tsc alone**: `tsc` cannot produce CJS + ESM simultaneously without a second compilation pass. It also doesn't produce a proper `exports` map without manual `package.json` editing.
- **vs pkgroll**: Newer, less battle-tested. tsup has years of production use across high-profile SDKs (Prisma client, many Vercel/Cloudflare tooling packages).

### Runtime Validation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| zod | `^3.23` | Input validation + type inference | Schema-first approach: the schema IS the TypeScript type via `z.infer<>`. Zero transitive dependencies. Runs in all target runtimes (no Node-specific APIs). PROJECT.md mandates it as the single production dependency. |

**Zod version note (MEDIUM confidence):** As of August 2025, zod v3.23.x was the stable series. Zod v4 was in beta/RC. **Before pinning, check `npm show zod dist-tags`** to determine if v4 has shipped stable. If so, evaluate migration — v4 is a breaking API change but offers significantly better performance and smaller bundle size. For this SDK, the performance delta matters less than stability; start with v3 unless v4 is fully stable.

**Why zod over alternatives:**
- **vs valibot**: Valibot is modular/tree-shakeable and smaller per-import, but its API is more verbose for nested object schemas. Zod's developer experience is better for a public SDK where schema definitions also serve as documentation.
- **vs io-ts**: Functional programming style (`Either` types) is unfamiliar to most backend developers. Poor DX for a public-facing SDK.
- **vs arktype**: Excellent type inference, but smaller community and less documentation than zod as of mid-2025.
- **vs yup**: yup infers types less precisely than zod and has weaker TypeScript integration.

### Testing Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| vitest | `^1.6` or `^2.x` | Test runner | ESM-native, esbuild-powered, Jest-compatible API with zero config in a tsup project. Runs tests in Node, and with the `edge-runtime` pool can approximate Cloudflare Workers. |
| msw | `^2.x` | HTTP mocking | Service Worker-based interception that works in Node (via `@mswjs/interceptors`). No mock server to start/stop — declare handlers declaratively. v2 is a rewrite of v1 with a cleaner API. |

**Why vitest over jest:**
- Jest requires `babel-jest` or `ts-jest` to handle TypeScript + ESM, adding config surface. Vitest uses the same esbuild pipeline as tsup — tests run against the same transpilation that ships. No transformation mismatch.
- Vitest's watch mode is faster for iterative development.
- For an ESM-first codebase targeting 2025+, Jest's ESM support (experimental) is a friction point that vitest eliminates.

**Why msw over nock / fetch-mock:**
- `nock` patches Node's `http` module — incompatible with the native `fetch` this SDK uses.
- `fetch-mock` patches the global `fetch` — works, but msw's handler model is more maintainable and mirrors how real API contracts are expressed (method + path + response).
- msw v2 works identically in Node and browsers, which matters if `@deepidv/web` is added later.

### Monorepo Tooling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| pnpm | `^9.x` | Package manager + workspace host | Native workspaces (`pnpm-workspace.yaml`), strict dependency isolation by default (hoisting opt-in), fast installs via content-addressable store. PROJECT.md mandates pnpm workspaces for `@deepidv/core` + `@deepidv/server`. |

**Why pnpm over alternatives:**
- **vs npm workspaces**: npm hoists everything to root by default — packages can accidentally import undeclared dependencies (phantom dependencies). pnpm's strict hoisting prevents this and catches missing `dependencies` entries at install time rather than at runtime.
- **vs yarn berry (PnP)**: Yarn Plug'n'Play has compatibility issues with many tools (native addons, certain bundlers). The zero-installs feature is not relevant for a dev-time monorepo. pnpm's workspace protocol (`workspace:*`) is simpler.
- **vs Turborepo**: Turborepo is a task runner on top of a package manager, not a replacement. Can be layered onto pnpm later if build caching becomes valuable. Not needed at this scale (2 packages).
- **vs Nx**: Nx is heavyweight for 2 packages. Adds a large config surface with minimal benefit at this scale.

**Workspace structure:**

```
deepidv-sdk-ts/
  pnpm-workspace.yaml
  packages/
    core/          # @deepidv/core — internal HTTP client, retry, error classes, upload handler
    server/        # @deepidv/server — public SDK surface, all resource modules
  package.json     # root — dev tooling only (vitest, tsup, changesets, typescript)
```

### Publishing Pipeline

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @changesets/cli | `^2.x` | Versioning + changelog | Semver-aware changeset workflow: developers write a `.changeset/*.md` describing the change, CI runs `changeset version` to bump `package.json` and generate `CHANGELOG.md`, then `changeset publish` to publish. Supports monorepos natively. |

**Why changesets over alternatives:**
- **vs semantic-release**: `semantic-release` is commit-message driven (Conventional Commits). It automates 100% of the decision. Changesets gives the developer explicit control over what is a patch vs minor vs major — appropriate for a public SDK where a minor internal refactor should never accidentally increment the minor version.
- **vs release-it**: Lower-level tool, less opinionated about monorepos. More manual setup required for linked versioning across packages.
- **vs manual versioning**: Leads to CHANGELOG drift and version mistakes. Changesets makes this process auditable (each `.changeset` file is reviewed in the PR).

### Linting + Formatting

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| ESLint | `^9.x` | Linting | v9 with flat config (`eslint.config.js`). `typescript-eslint` v8+ supports flat config natively. |
| typescript-eslint | `^8.x` | TypeScript rules | `@typescript-eslint/recommended-type-checked` ruleset catches `any` usage, unsafe assignments, and missing return types — enforces the PROJECT.md zero-`any` requirement. |
| Prettier | `^3.x` | Formatting | Opinionated formatter, no debates. Integrate via `eslint-plugin-prettier` or run as a separate step. |

---

## Package Configuration (`package.json` exports map)

A dual ESM + CJS package for CF Workers + Node requires a precise `exports` map. The pattern below satisfies all targets:

```json
{
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "files": ["dist"]
}
```

Cloudflare Workers resolves `import` condition. Node with `require()` resolves `require`. Bundlers (esbuild, rollup, webpack) resolve `import` for tree-shaking. TypeScript resolves `types`.

**tsup config (`tsup.config.ts`):**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
});
```

`splitting: false` prevents chunk files that break the simple exports map above. `target: 'es2022'` matches the TypeScript `target` in `tsconfig.json`.

---

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "declaration": true,
    "declarationMap": true,
    "skipLibCheck": true,
    "lib": ["ES2022"]
  }
}
```

`"module": "NodeNext"` with `"moduleResolution": "NodeNext"` is required for correct ESM resolution in Node 18+ while preserving CJS compatibility when tsup produces the CJS bundle. `"lib": ["ES2022"]` excludes DOM types, which is correct for a server SDK. `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` enforce the strictest practical TypeScript — both are justified given the zero-`any` requirement.

---

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

---

## Installation

```bash
# Install pnpm globally first
npm install -g pnpm@9

# Root dev dependencies
pnpm add -D -w typescript tsup vitest @vitest/coverage-v8 msw @changesets/cli eslint typescript-eslint prettier

# @deepidv/core
pnpm add --filter @deepidv/core zod

# @deepidv/server (depends on core)
pnpm add --filter @deepidv/server zod
pnpm add --filter @deepidv/server -D @deepidv/core
```

---

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

---

## Sources

- PROJECT.md (project-defined constraints): `C:/Users/omart/subprime/deepidv-sdk-ts/.planning/PROJECT.md`
- tsup documentation: https://tsup.egoist.dev (unable to fetch live during this session)
- Zod documentation: https://zod.dev (unable to fetch live during this session)
- Vitest documentation: https://vitest.dev (unable to fetch live during this session)
- MSW documentation: https://mswjs.io (unable to fetch live during this session)
- Changesets documentation: https://github.com/changesets/changesets (unable to fetch live during this session)
- **Note:** All version numbers should be independently verified via `npm show <package> version` before use. External tools were unavailable during this research session.
