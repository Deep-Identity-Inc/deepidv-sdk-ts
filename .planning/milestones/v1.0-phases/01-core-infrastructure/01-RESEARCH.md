# Phase 1: Core Infrastructure - Research

**Researched:** 2026-04-05
**Domain:** pnpm monorepo scaffold, native-fetch HTTP client, TypeScript error hierarchy, typed event emitter, runtime compatibility
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Timeout scope:** Per-attempt. Each individual request gets the full timeout window (e.g., 30s per try x 3 retries = up to 90s total). Simpler mental model, matches Stripe/OpenAI SDKs.

**D-02 — Retry-After header:** Honor with a 60-second cap. If the API sends `Retry-After: 5`, wait 5s instead of computed backoff. If `Retry-After` exceeds 60s, cap at 60s — prevents a rogue server header from making an SDK call wait indefinitely.

**D-03 — Default retry config:** 3 retries, 500ms initial delay. Industry standard, matches Stripe SDK.

**D-04 — Retry event timing:** Fire before sleeping — "about to retry in 2s" pattern. Allows callers to log or act before the wait happens.

**D-05 — API key redaction:** Last 4 chars only — `"sk_...a1b2"`. Enough to identify which key without exposing it. Matches Stripe pattern.

**D-06 — Error `.response` property:** Errors carry the raw response — includes status, headers, and body. Invaluable for debugging API issues.

**D-07 — Error cause chaining:** Native `Error.cause` (ES2022 standard). Target is Node 18+ so fully supported.

**D-08 — `toJSON()` on errors:** `DeepIDVError` implements `toJSON()` for structured logging — `JSON.stringify(error)` produces a clean object with type, message, status, code.

**D-09 — Event listener execution:** Synchronous, fire-and-forget. Keeps emitter non-blocking per EVT-02.

**D-10 — Listener error handling:** If a listener throws, swallow the error and emit a warning event. Never let a listener crash the SDK call.

**D-11 — `once()` support:** Emitter supports `once()` — standard pattern, developers expect it.

**D-12 — `on()` return value:** `on()` returns an unsubscribe function — `const unsub = client.on('retry', fn); unsub();`. Modern pattern, no need to pass the same function reference back via `off()`.

**D-13 — Custom fetch injection:** `HttpClient` accepts an optional custom `fetch` in config — `new DeepIDV({ apiKey, fetch: myFetch })`. Essential for testing, Cloudflare Workers service bindings, and proxy setups.

**D-14 — No interceptors in v1:** No request/response interceptors. The event emitter covers observability. Defer to v2 if needed.

**D-15 — URL joining:** Simple string concat with normalization — strip trailing slash from base, ensure leading slash on path. No URL constructor edge cases.

**D-16 — No debug mode:** Advanced debugging covered by event emitter lifecycle events and error `.response` property.

### Claude's Discretion

None — all areas discussed and decided.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BUILD-01 | pnpm monorepo with `@deepidv/core` (internal) and `@deepidv/server` (public) packages | pnpm workspaces, pnpm-workspace.yaml, workspace:* protocol |
| BUILD-02 | TypeScript strict mode, ES2022 target, path aliases via `tsconfig.base.json` | TypeScript 6.0 now defaults strict=true; ES2022 target confirmed correct |
| BUILD-03 | tsup builds dual ESM + CJS output with `.d.ts` generation per package | tsup 8.5.1, `format: ['esm', 'cjs'], dts: true` |
| BUILD-04 | Package `exports` map correctly exposes `.mjs`, `.cjs`, and `.d.ts` for all entry points | Conditional exports pattern with `import`/`require`/`types` keys |
| BUILD-05 | ESLint + Prettier configured at workspace root, shared by all packages | ESLint 10.2.0 flat config, Prettier 3.8.1 |
| HTTP-01 | Base HTTP client using native `fetch` with configurable base URL, JSON parsing, content-type handling | Native fetch in Node 18+, Deno, Bun, CF Workers — no polyfill needed |
| HTTP-02 | API key authentication via `x-api-key` header on every request | Header injection in request wrapper |
| HTTP-03 | Configurable timeout per request using `AbortController` with global default override | `AbortController` + `AbortSignal.timeout()` — per-attempt scope (D-01) |
| HTTP-04 | Retry logic with exponential backoff + jitter on 429 and 5xx only, never 4xx, configurable max retries | Exponential backoff formula with Math.random() jitter; Retry-After cap at 60s (D-02, D-03) |
| ERR-01 | `DeepIDVError` base class with status code, error code, human-readable message | Custom Error subclass with `toJSON()` (D-08) and `.response` property (D-06) |
| ERR-02 | `AuthenticationError` (401) with API key redaction in error output | Last-4-chars redaction pattern (D-05) |
| ERR-03 | `RateLimitError` (429) with retry-after extraction | Parse `Retry-After` header from `.response` |
| ERR-04 | `ValidationError` (400) with field-level detail from Zod | Phase 2 concern for Zod schemas; Phase 1 just needs the class shell |
| ERR-05 | `NetworkError` for connection failures and `TimeoutError` for request timeouts | Catch `AbortError` → `TimeoutError`; catch network errors → `NetworkError` |
| ERR-06 | All errors chain `cause` for stack trace preservation | Native `Error.cause` (ES2022, D-07) |
| EVT-01 | Typed event emitter for request lifecycle: request start, upload progress, response received, retry, error | Generic typed emitter using Map of listener arrays — no external dep |
| EVT-02 | Non-blocking (does not intercept return path), allows caller-controlled logging/APM | Synchronous fire-and-forget listeners (D-09); listener throw swallowed (D-10) |
| COMPAT-01 | Works on Node 18+ without polyfills | Node 22.18.0 available locally; fetch/AbortController/ReadableStream all native in Node 18+ |
| COMPAT-02 | Works on Deno and Bun using native web APIs | Web Standards only — no Node-specific APIs in core |
| COMPAT-03 | Works on Cloudflare Workers and edge runtimes (no Node-specific APIs in core) | CF Workers has native fetch, AbortController, AbortSignal — confirmed |
| COMPAT-04 | File path input uses conditional runtime detection; edge runtimes must pass Buffer/Uint8Array | Phase 2 concern (uploader). Phase 1 core only needs Buffer/Uint8Array support |

</phase_requirements>

---

## Summary

Phase 1 establishes the entire infrastructure layer that all subsequent SDK phases depend upon: the pnpm monorepo scaffold, TypeScript + tsup build pipeline, a native-fetch HTTP client with auth and retry, a typed error hierarchy, and a typed event emitter. There is no network traffic to a real API in this phase — all behavior is testable with msw v2 mocking native fetch in Node.

The most critical insight for planning is the **version shift**: TypeScript is now 6.0.2 (GA March 2026, not the `^5.4` in CLAUDE.md), and Zod is now at 4.3.6 (not `^3.23`). Both changes require explicit version decisions before writing a single file. TypeScript 6.0 now enables `strict: true` by default, which aligns with BUILD-02 but means the tsconfig no longer needs explicit `"strict": true`. Zod v4 has string format validators moved to top-level functions (`z.email()` not `z.string().email()`), which affects every schema written later.

ESLint 10.2.0 is the current stable (v9 is now in maintenance); however, since ESLint 10 only reached GA in April 2026 and the ecosystem is still catching up, using ESLint 9.x (currently `9.39.4` in maintenance channel) is the lower-risk choice for a new project if plugin compatibility is uncertain.

**Primary recommendation:** Scaffold the monorepo in one wave, implement core modules (`config.ts`, `auth.ts`, `errors.ts`, `retry.ts`, `events.ts`, `client.ts`) in parallel tasks, then verify cross-runtime compatibility. Tests for each module run with vitest + msw. All six source files in `packages/core/src/` can be written independently; `client.ts` depends on the others and must be last.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | `^6.0.2` | Language | Current stable (GA March 2026). Defaults strict=true. ES2022 target covers private fields, top-level await, Error.cause. |
| tsup | `^8.5.1` | Bundler | Dual ESM + CJS + `.d.ts` in one config. The locked choice from CLAUDE.md. |
| zod | `^4.3.6` | Runtime validation | Current stable v4. CLAUDE.md specified `^3.23` but v4 is now latest. See note below. |
| pnpm | `^10.x` | Package manager + workspace host | npm show pnpm version returns 10.x line. v9 still works but v10 is current. |
| vitest | `^4.1.2` | Test runner | Current stable. ESM-native, zero config for tsup projects. |
| msw | `^2.12.14` | HTTP mocking | v2 intercepts native fetch in Node via @mswjs/interceptors. No server to start/stop. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ESLint | `^9.39.4` (maintenance) | Linting | v9 is proven stable. v10 (10.2.0) just released April 2026; defer to v10 once typescript-eslint catches up. Use v9 for now. |
| typescript-eslint | `^8.58.0` | TypeScript rules | Flat config native support. `recommended-type-checked` enforces zero-any. |
| Prettier | `^3.8.1` | Formatting | Opinionated, no debates. |
| @changesets/cli | `^2.30.0` | Versioning + changelog | Monorepo-native. Explicit patch/minor/major control. |

> **Zod v3 vs v4 decision required:** CLAUDE.md says `^3.23`. npm registry now shows `4.3.6` as `latest`. Since Phase 1 does not write any Zod schemas (schemas are Phase 2+), the safer approach is to **install zod `^4.3.6` now** and adopt v4 APIs from the start, rather than pinning to v3 only to migrate later. Key v4 change to know: string format validators are now top-level (`z.email()`, `z.uuid()`) not chained methods. The `z.infer<>` pattern is unchanged.

> **TypeScript v6 note:** CLAUDE.md says `^5.4`. Current stable is `6.0.2` (GA March 2026). Recommend using `^6.0.2` — it defaults to strict mode (aligning with BUILD-02) and adds ES2025 target support. The only meaningful tsconfig change: `"strict": true` can be omitted from tsconfig since it is now the default, but explicitly including it remains valid and self-documenting.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tsup 8.x | tsdown | tsdown is tsup's successor from the same author, but is newer and less battle-tested for SDK publishing |
| ESLint 9.x | ESLint 10.x | v10 just shipped; plugin ecosystem lag. v9 maintenance branch is safer for initial scaffold |
| zod 4.x | zod 3.x | v3 still works but `latest` tag points to v4. Starting on v3 means a migration later. |

**Installation:**

```bash
# Root dev dependencies
pnpm add -Dw typescript tsup eslint typescript-eslint prettier @changesets/cli vitest msw

# @deepidv/core
pnpm add --filter @deepidv/core zod
pnpm add -D --filter @deepidv/core vitest msw

# @deepidv/server  
pnpm add --filter @deepidv/server @deepidv/core@workspace:*
pnpm add -D --filter @deepidv/server vitest msw
```

**Version verification (run before writing package.json):**

```bash
npm show typescript version   # Verified: 6.0.2
npm show tsup version         # Verified: 8.5.1
npm show zod version          # Verified: 4.3.6 (v4 is latest)
npm show vitest version       # Verified: 4.1.2
npm show msw version          # Verified: 2.12.14
npm show pnpm version         # Verified: 10.x
npm show eslint version       # Verified: 10.2.0 (but use v9.39.4 maintenance)
```

---

## Architecture Patterns

### Recommended Project Structure

```
deepidv-sdk-ts/
├── packages/
│   ├── core/                        # @deepidv/core — never installed directly
│   │   ├── src/
│   │   │   ├── config.ts            # DeepIDVConfig interface + defaults
│   │   │   ├── auth.ts              # x-api-key injection
│   │   │   ├── errors.ts            # Error class hierarchy
│   │   │   ├── retry.ts             # Exponential backoff + jitter
│   │   │   ├── events.ts            # Typed event emitter (~40 lines)
│   │   │   ├── client.ts            # HttpClient (composes all above)
│   │   │   └── index.ts             # Named exports only
│   │   ├── tsconfig.json            # extends ../../tsconfig.base.json
│   │   ├── tsup.config.ts
│   │   └── package.json
│   └── server/                      # @deepidv/server — what developers install
│       ├── src/
│       │   └── index.ts             # Shell only in Phase 1
│       ├── tsconfig.json
│       ├── tsup.config.ts
│       └── package.json
├── tsconfig.base.json               # strict, ES2022, path aliases
├── eslint.config.js                 # Flat config, shared by all packages
├── .prettierrc
├── pnpm-workspace.yaml
└── package.json                     # Root — workspace scripts only
```

### Pattern 1: pnpm Workspace Configuration

**What:** Root `pnpm-workspace.yaml` declares the packages glob. Root `package.json` contains only dev tooling and workspace-level scripts.

**When to use:** Always — this is the monorepo entry point.

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
```

```json
// Root package.json (trimmed)
{
  "name": "deepidv-sdk",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "eslint .",
    "clean": "pnpm -r clean"
  },
  "devDependencies": {
    "typescript": "^6.0.2",
    "tsup": "^8.5.1",
    "eslint": "^9.39.4",
    "typescript-eslint": "^8.58.0",
    "prettier": "^3.8.1",
    "@changesets/cli": "^2.30.0"
  }
}
```

### Pattern 2: tsup Config for Dual ESM + CJS

**What:** Each package has its own `tsup.config.ts`. Produces `.mjs` (ESM), `.cjs` (CJS), and `.d.ts`.

**When to use:** Every package in the monorepo that publishes to npm.

```typescript
// packages/core/tsup.config.ts
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
});
```

```json
// packages/core/package.json (exports map)
{
  "name": "@deepidv/core",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    }
  },
  "scripts": {
    "build": "tsup",
    "clean": "rm -rf dist"
  }
}
```

> Note: tsup with `format: ['esm', 'cjs']` produces `.js` (ESM) and `.cjs` (CJS) by default when `package.json` has `"type": "module"`. Without `"type": "module"`, ESM gets `.mjs` and CJS gets `.js`. The exports map above uses the `"type": "module"` convention. Choose one and be consistent.

### Pattern 3: tsconfig Base + Package Extension

**What:** Root `tsconfig.base.json` holds shared compiler options. Each package extends it.

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true
  }
}
```

```json
// packages/core/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

### Pattern 4: Native Fetch HTTP Client

**What:** A class wrapping `fetch` with auth header injection, per-attempt timeout via `AbortController`, and retry delegation.

```typescript
// packages/core/src/client.ts (sketch)
export class HttpClient {
  constructor(private readonly config: ResolvedConfig) {}

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = buildUrl(this.config.baseUrl, path); // D-15: strip trailing slash + leading slash
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.timeout
    );

    try {
      const response = await (this.config.fetch ?? fetch)(url, {
        method,
        headers: buildHeaders(this.config.apiKey, body),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return parseResponse<T>(response);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new TimeoutError(`Request to ${path} timed out`, { cause: err });
      }
      throw new NetworkError(`Network failure on ${path}`, { cause: err as Error });
    }
  }
}
```

> Important: Create a new `AbortController` for each attempt. `AbortController` is single-use — once aborted, it cannot be reset. The retry loop must instantiate a fresh controller per retry.

### Pattern 5: Exponential Backoff with Jitter

**What:** Retry only on 429 and 5xx. Honor `Retry-After` with a 60s cap (D-02). Fire `retry` event before sleeping (D-04).

```typescript
// packages/core/src/retry.ts (sketch)
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  emitter: TypedEmitter,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetryable(err) || attempt === config.maxRetries) {
        throw err;
      }
      lastError = err;

      const delay = computeDelay(err, attempt, config);
      emitter.emit('retry', { attempt, delayMs: delay, error: err }); // D-04: fire before sleep
      await sleep(delay);
    }
  }

  throw lastError;
}

function computeDelay(err: unknown, attempt: number, config: RetryConfig): number {
  // Honor Retry-After header (D-02)
  const retryAfter = extractRetryAfter(err);
  if (retryAfter !== null) {
    return Math.min(retryAfter * 1000, 60_000); // 60s cap
  }
  // Exponential backoff with full jitter
  const exp = Math.min(config.initialDelayMs * Math.pow(2, attempt), 30_000);
  return Math.floor(Math.random() * exp);
}

function isRetryable(err: unknown): boolean {
  if (err instanceof DeepIDVError) {
    return err.status === 429 || (err.status >= 500 && err.status <= 599);
  }
  return err instanceof NetworkError || err instanceof TimeoutError;
}
```

### Pattern 6: Typed Event Emitter (Zero Dependencies)

**What:** Generic class parameterized on an event map. `on()` returns unsubscribe function (D-12). Listener throws are swallowed and re-emitted as `warning` (D-10).

```typescript
// packages/core/src/events.ts
type Listener<T> = (payload: T) => void;

export type SDKEventMap = {
  'request': { method: string; url: string };
  'response': { status: number; url: string };
  'retry': { attempt: number; delayMs: number; error: unknown };
  'error': { error: unknown };
  'warning': { message: string; error: unknown };
};

export class TypedEmitter<TMap extends Record<string, unknown> = SDKEventMap> {
  private readonly listeners = new Map<keyof TMap, Array<Listener<unknown>>>();

  on<K extends keyof TMap>(event: K, listener: Listener<TMap[K]>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(listener as Listener<unknown>);
    return () => this.off(event, listener);
  }

  once<K extends keyof TMap>(event: K, listener: Listener<TMap[K]>): () => void {
    const wrapper = (payload: TMap[K]) => {
      unsub();
      listener(payload);
    };
    const unsub = this.on(event, wrapper);
    return unsub;
  }

  emit<K extends keyof TMap>(event: K, payload: TMap[K]): void {
    const fns = this.listeners.get(event) ?? [];
    for (const fn of fns) {
      try {
        fn(payload);
      } catch (err) {
        if (event !== 'warning') {
          this.emit('warning', { message: 'Listener threw', error: err } as TMap['warning' & keyof TMap]);
        }
      }
    }
  }

  private off<K extends keyof TMap>(event: K, listener: Listener<TMap[K]>): void {
    const fns = this.listeners.get(event);
    if (!fns) return;
    const idx = fns.indexOf(listener as Listener<unknown>);
    if (idx !== -1) fns.splice(idx, 1);
  }
}
```

### Pattern 7: Error Hierarchy

**What:** Base `DeepIDVError` with `toJSON()`, `.response`, and native `Error.cause`. Subclasses for each HTTP failure mode.

```typescript
// packages/core/src/errors.ts (sketch)
export interface RawResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export class DeepIDVError extends Error {
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly response: RawResponse | undefined;

  constructor(
    message: string,
    options?: { status?: number; code?: string; response?: RawResponse; cause?: unknown }
  ) {
    super(message, { cause: options?.cause }); // D-07: native Error.cause
    this.name = this.constructor.name;
    this.status = options?.status;
    this.code = options?.code;
    this.response = options?.response;
    // Required for correct instanceof behavior when compiling to ES2015+
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() { // D-08
    return {
      type: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
    };
  }
}

export class AuthenticationError extends DeepIDVError {
  readonly redactedKey: string;

  constructor(message: string, apiKey: string, options?: { response?: RawResponse; cause?: unknown }) {
    super(message, { status: 401, code: 'authentication_error', ...options });
    this.redactedKey = redactApiKey(apiKey); // D-05: last 4 chars only
  }

  override toJSON() {
    return { ...super.toJSON(), redactedKey: this.redactedKey };
  }
}

function redactApiKey(key: string): string {
  if (key.length <= 4) return '****';
  return `sk_...${key.slice(-4)}`;
}

export class RateLimitError extends DeepIDVError {}
export class ValidationError extends DeepIDVError {}
export class NetworkError extends DeepIDVError {}
export class TimeoutError extends DeepIDVError {}
```

> **Critical:** `Object.setPrototypeOf(this, new.target.prototype)` is required when targeting ES2015+ in TypeScript to fix broken `instanceof` checks on classes that extend `Error`. With target `ES2022`, this is still needed unless `useDefineForClassFields` resolves it — include it unconditionally to be safe.

### Pattern 8: ESLint Flat Config (v9)

```javascript
// eslint.config.js (root)
import tseslint from 'typescript-eslint';

export default tseslint.config(
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./packages/*/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
```

### Anti-Patterns to Avoid

- **Retrying on 4xx errors:** Never retry 400, 401, 403, 404 — these are caller errors, not transient failures. Only 429 and 5xx are retryable.
- **Sharing AbortController across retries:** An aborted `AbortController` cannot be reset. Create a new one for each attempt.
- **Using Node-specific APIs in `@deepidv/core`:** No `require('fs')`, `require('crypto')`, `require('http')`, or `require('stream')`. Use `globalThis.fetch`, `globalThis.AbortController`, `Uint8Array`, `ReadableStream` only.
- **Wildcard re-exports (`export * from`):** BUILD-05 / API-05 mandate named explicit exports only. Use `export { X, Y } from './module'` everywhere.
- **Using `any` to skip typing:** ESLint strict rules will catch this. Use `unknown` + type narrowing instead.
- **Trusting `Error.stack` shape across runtimes:** Stack format differs between Node, Deno, and Bun. Do not parse stack strings.
- **Using `eventemitter3` or Node's `EventEmitter`:** The CLAUDE.md constraint is "everything else via native web APIs / no Node-specific APIs." The typed emitter must be custom-built (~40 lines).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP mocking in tests | Custom mock server, `nock` | `msw v2` via `setupServer()` | msw intercepts native fetch; `nock` patches Node's `http` module which doesn't apply to native fetch |
| Dual ESM+CJS build | Manual rollup config, two `tsc` passes | `tsup` | tsup handles format splitting, `.d.ts` gen, and `exports` map compatibility in ~15 lines |
| Runtime input validation | Manual type guards | `zod v4` | Zod's schemas ARE the types via `z.infer<>`. Single source of truth for compile-time + runtime. |
| Workspace versioning | Manual CHANGELOG + git tags | `changesets` | Changesets enforces explicit semver intent per change; prevents accidental major bumps |
| API key redaction | Regex replace in logs | Controlled redaction in `AuthenticationError.toJSON()` | Ensures the key is NEVER in any serialized output, not just logs |

**Key insight:** The only thing hand-rolled in this stack is the typed event emitter, and that is by design — the alternative (`eventemitter3` or Node's `EventEmitter`) would introduce a Node-specific dependency that breaks Cloudflare Workers and Deno compatibility.

---

## Common Pitfalls

### Pitfall 1: `instanceof` Breaks for Custom Error Subclasses

**What goes wrong:** `err instanceof AuthenticationError` returns `false` even when `err` was constructed as `new AuthenticationError(...)`.

**Why it happens:** TypeScript compiles `class X extends Error` to ES5/ES2015 prototype chain manipulation that breaks `instanceof` for built-in classes.

**How to avoid:** Add `Object.setPrototypeOf(this, new.target.prototype)` in every Error subclass constructor. Apply to `DeepIDVError` base class and all subclasses.

**Warning signs:** Tests asserting `expect(err).toBeInstanceOf(AuthenticationError)` fail even when error message is correct.

### Pitfall 2: AbortError Detection Varies Across Runtimes

**What goes wrong:** Timeout detection code checks `err.name === 'AbortError'` but CF Workers or Deno throws a differently-named error.

**Why it happens:** The `AbortError` name is standard, but some runtimes use `DOMException` with name `'AbortError'` while others throw a plain `Error`.

**How to avoid:** Check both: `(err instanceof DOMException && err.name === 'AbortError') || (err instanceof Error && err.name === 'AbortError')`.

**Warning signs:** Timeout errors surface as `NetworkError` instead of `TimeoutError` in CF Workers.

### Pitfall 3: Shared AbortController Across Retry Attempts

**What goes wrong:** After the first timeout, the controller's signal is permanently aborted. Subsequent fetch attempts fail immediately.

**Why it happens:** `AbortController.signal` is a one-way latch — once aborted, it cannot be reset.

**How to avoid:** Create a new `AbortController` inside the retry loop body, not outside it.

**Warning signs:** Second and third retry attempts fail instantly with `AbortError` even before the timeout window.

### Pitfall 4: `workspace:*` Stripped During `pnpm publish`

**What goes wrong:** `@deepidv/server` depends on `"@deepidv/core": "workspace:*"`. After `pnpm publish`, the published package.json has a literal `workspace:*` instead of a real semver.

**Why it happens:** `pnpm publish` automatically replaces `workspace:*` with the current local version — but only if the package is published through pnpm's publish lifecycle. Publishing directly with `npm publish` skips this.

**How to avoid:** Always use `pnpm publish` or `changeset publish` (which delegates to pnpm). Never use `npm publish` directly.

**Warning signs:** Consumers installing `@deepidv/server` get a resolution error: `workspace:*` is not a valid semver.

### Pitfall 5: tsup `.d.ts` Files Miss Named Re-exports

**What goes wrong:** `dist/index.d.ts` exists but doesn't export types from sub-modules, causing TypeScript errors in consumers.

**Why it happens:** tsup's `dts: true` sometimes struggles with re-exports through barrel files when `isolatedModules` is enabled.

**How to avoid:** Use explicit re-exports in `index.ts`: `export { HttpClient } from './client'` not `export * from './client'`. Verify built `.d.ts` after every build.

**Warning signs:** Consumer gets `Module '"@deepidv/core"' has no exported member 'HttpClient'` even though the source exports it.

### Pitfall 6: Retry-After Header Parsing Edge Cases

**What goes wrong:** `Retry-After` header is either a number (seconds) or an HTTP date string. Parsing only one format causes `NaN` → immediate retry or infinite wait.

**Why it happens:** RFC 7231 allows both `Retry-After: 120` and `Retry-After: Wed, 21 Oct 2025 07:28:00 GMT`.

**How to avoid:** Try `parseInt()` first; if `NaN`, try `new Date(header).getTime() - Date.now()`. Apply the 60s cap (D-02) to both paths.

**Warning signs:** Retry delay logs show `NaN ms` or extremely large delays for date-format `Retry-After` headers.

### Pitfall 7: ESLint `project` Path in Monorepo Flat Config

**What goes wrong:** `parserOptions.project` points to a single tsconfig, causing ESLint to fail on files in other packages.

**Why it happens:** Type-aware rules need the tsconfig for each package to resolve types correctly.

**How to avoid:** Use a glob: `project: ['./packages/*/tsconfig.json']` plus `tsconfigRootDir: import.meta.dirname`.

**Warning signs:** ESLint reports "Parsing error: Cannot read file 'tsconfig.json'" for any package other than the first.

---

## Code Examples

### vitest + msw Node Setup

```typescript
// packages/core/src/__tests__/setup.ts
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';

export const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

```typescript
// packages/core/src/__tests__/client.test.ts
import { http, HttpResponse } from 'msw';
import { server } from './setup';

test('attaches x-api-key header', async () => {
  server.use(
    http.post('https://api.deepidv.com/v1/test', ({ request }) => {
      expect(request.headers.get('x-api-key')).toBe('sk_test_key');
      return HttpResponse.json({ ok: true });
    }),
  );
  // ... invoke client
});
```

### URL Normalization (D-15)

```typescript
// Simple string concat — no URL constructor edge cases
function buildUrl(base: string, path: string): string {
  const cleanBase = base.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}
// buildUrl('https://api.deepidv.com/', '/v1/sessions') → 'https://api.deepidv.com/v1/sessions'
// buildUrl('https://api.deepidv.com', 'v1/sessions') → 'https://api.deepidv.com/v1/sessions'
```

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `zod v3` with chained validators (`z.string().email()`) | `zod v4` with top-level format fns (`z.email()`) | Zod v4 GA 2025 | All schema code uses v4 API from the start |
| TypeScript `^5.4` (CLAUDE.md) | TypeScript `6.0.2` (current stable) | March 2026 GA | strict is now default; ES2025 target support added |
| ESLint v9 flat config (CLAUDE.md) | ESLint v10 (April 2026) | April 2026 | Use v9 maintenance initially; v10 is too new for stable ecosystem |
| `eventemitter3` / Node's `EventEmitter` | Custom typed emitter (~40 lines) | N/A (design constraint) | Zero runtime deps in core; full type safety |

**Deprecated/outdated:**
- `nock`: Patches Node's `http` module. Incompatible with native `fetch`. Use msw v2 instead.
- `jest` + `babel-jest` + `ts-jest`: Three-package config for ESM+TS. vitest eliminates all of it.
- `axios`, `got`, `node-fetch`: Node-specific HTTP libs. Native fetch is universal.
- TypeScript `"target": "ES5"`: Dropped in TypeScript 6.0 (lowest supported target is now ES2015).

---

## Open Questions

1. **Zod v3 vs v4 decision**
   - What we know: CLAUDE.md says `^3.23`; npm `latest` is `4.3.6`. Phase 1 does not write any schemas (schemas are Phase 2+).
   - What's unclear: Whether the project owner wants to match CLAUDE.md exactly or adopt v4 from the start.
   - Recommendation: Install `zod@^4.3.6` now. Starting on v3 only to migrate to v4 later adds unnecessary work. Flag this to the user before executing Phase 1.

2. **TypeScript 6.0 adoption**
   - What we know: TypeScript 6.0.2 is stable; CLAUDE.md says `^5.4`. TS 6.0 defaults strict=true (aligned with BUILD-02). Only breaking change relevant here: ES5 target removed (irrelevant — we target ES2022).
   - What's unclear: Whether the project owner has a preference for conservatism.
   - Recommendation: Use `^6.0.2`. No meaningful breaking changes for this codebase.

3. **`@deepidv/core` bundle strategy for publishing**
   - What we know: STATE.md notes "decide whether to bundle `@deepidv/core` into `@deepidv/server` via tsup `noExternal`."
   - What's unclear: The publishing pipeline is Phase 7, but the build config must accommodate the chosen strategy.
   - Recommendation: Keep `@deepidv/core` as a separate published package (or private). Do NOT use `noExternal` in Phase 1 — keep this decision open. The Phase 1 build config is compatible with either approach.

4. **ESLint v9 vs v10**
   - What we know: ESLint v10.2.0 is the current `latest`. v9 is in maintenance. `typescript-eslint` 8.58.0 current stable.
   - What's unclear: Whether typescript-eslint 8.x fully supports ESLint 10 APIs.
   - Recommendation: Use ESLint `9.39.4` (maintenance channel) for Phase 1 scaffold. Upgrade to v10 in a later phase once the ecosystem stabilizes.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | COMPAT-01, all tests | Yes | v22.18.0 | — |
| pnpm | BUILD-01, all builds | Yes | 10.28.0 | — |
| Deno | COMPAT-02 runtime test | No | — | Document manual install step; skip Deno compat test in CI for Phase 1 |
| Bun | COMPAT-02 runtime test | No | — | Document manual install step; skip Bun compat test in CI for Phase 1 |
| Wrangler (CF Workers) | COMPAT-03 runtime test | No | — | Skip CF Workers `wrangler dev` test in Phase 1; verify in Phase 7 |

**Missing dependencies with no fallback:**
- None that block Phase 1 implementation.

**Missing dependencies with fallback:**
- **Deno, Bun, Wrangler:** Not installed locally. COMPAT-02, COMPAT-03, COMPAT-04 require these for runtime verification. Phase 1 success criterion #4 ("imports without error in a Node 18 script, a Deno script, and a Cloudflare Workers `wrangler dev` session") cannot be fully verified locally. Recommended approach: verify Node 18+ locally (achievable with v22.18.0), document Deno/Bun/CF Workers compat verification as a manual step or defer to CI with appropriate runners.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 |
| Config file | `packages/core/vitest.config.ts` (Wave 0 gap — does not exist yet) |
| Quick run command | `pnpm --filter @deepidv/core test --run` |
| Full suite command | `pnpm -r test --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUILD-01 | pnpm install and build complete zero errors | smoke | `pnpm install && pnpm -r build` | Wave 0 (scaffold) |
| BUILD-02 | TypeScript strict + ES2022 target enforced | static | `pnpm -r build` (tsc errors) | Wave 0 |
| BUILD-03 | tsup produces `.mjs`, `.cjs`, `.d.ts` | smoke | `ls packages/core/dist` after build | Wave 0 |
| BUILD-04 | exports map resolves correctly in Node CJS and ESM | smoke | `node -e "require('@deepidv/core')"` + `node --input-type=module` | ❌ Wave 0 |
| BUILD-05 | ESLint + Prettier pass on all source files | static | `pnpm lint` | ❌ Wave 0 |
| HTTP-01 | `HttpClient.request()` issues fetch to correct URL with JSON content-type | unit | `pnpm --filter @deepidv/core test --run` | ❌ Wave 0 |
| HTTP-02 | `x-api-key` header present on every request | unit | `pnpm --filter @deepidv/core test --run` | ❌ Wave 0 |
| HTTP-03 | Request aborts after timeout window | unit | `pnpm --filter @deepidv/core test --run` | ❌ Wave 0 |
| HTTP-04 | Retries on 429/5xx; never retries 4xx; max retries respected | unit | `pnpm --filter @deepidv/core test --run` | ❌ Wave 0 |
| ERR-01 | `DeepIDVError` has status, code, message, toJSON() | unit | `pnpm --filter @deepidv/core test --run` | ❌ Wave 0 |
| ERR-02 | `AuthenticationError.toJSON()` redacts API key | unit | `pnpm --filter @deepidv/core test --run` | ❌ Wave 0 |
| ERR-03 | `RateLimitError` exposes retry-after value | unit | `pnpm --filter @deepidv/core test --run` | ❌ Wave 0 |
| ERR-04 | `ValidationError` exists with correct class name | unit | `pnpm --filter @deepidv/core test --run` | ❌ Wave 0 |
| ERR-05 | `NetworkError` and `TimeoutError` thrown on correct failure modes | unit | `pnpm --filter @deepidv/core test --run` | ❌ Wave 0 |
| ERR-06 | All errors preserve `cause` chain | unit | `pnpm --filter @deepidv/core test --run` | ❌ Wave 0 |
| EVT-01 | `on('retry', fn)` fires before delay with correct payload | unit | `pnpm --filter @deepidv/core test --run` | ❌ Wave 0 |
| EVT-02 | Listener throw does not propagate to caller | unit | `pnpm --filter @deepidv/core test --run` | ❌ Wave 0 |
| COMPAT-01 | Built package imports in Node 18+ (v22 locally) | smoke | `node -e "import('@deepidv/core')"` | ❌ Wave 0 |
| COMPAT-02 | Works in Deno/Bun | manual | Install Deno/Bun, run test script | ❌ manual |
| COMPAT-03 | Works in CF Workers `wrangler dev` | manual | Install wrangler, create test worker | ❌ manual |
| COMPAT-04 | Edge runtimes: Buffer/Uint8Array only (file path deferred to Phase 2) | unit | `pnpm --filter @deepidv/core test --run` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @deepidv/core test --run`
- **Per wave merge:** `pnpm -r build && pnpm -r test --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`. Manual COMPAT-02 and COMPAT-03 documented as known gaps.

### Wave 0 Gaps

- [ ] `packages/core/vitest.config.ts` — vitest config for core
- [ ] `packages/core/src/__tests__/setup.ts` — msw server setup
- [ ] `packages/server/vitest.config.ts` — vitest config for server
- [ ] Framework install: `pnpm add -Dw vitest msw` + `pnpm add -D --filter @deepidv/core vitest msw`
- [ ] `packages/core/src/__tests__/errors.test.ts` — ERR-01 through ERR-06
- [ ] `packages/core/src/__tests__/client.test.ts` — HTTP-01 through HTTP-04
- [ ] `packages/core/src/__tests__/events.test.ts` — EVT-01, EVT-02
- [ ] `packages/core/src/__tests__/retry.test.ts` — HTTP-04 retry scenarios

---

## Project Constraints (from CLAUDE.md)

These directives are mandatory. Planner must verify all tasks comply.

| Constraint | Directive |
|------------|-----------|
| Runtime compatibility | No Node-specific APIs in core (`fs`, `crypto`, `http`, `stream` modules are forbidden in `packages/core/`) |
| Zero AWS SDKs | SDK only talks to `api.deepidv.com` over HTTPS — never directly to AWS |
| Minimal dependencies | Only `zod` as a production dependency. Everything else is native web APIs. |
| TypeScript strictness | `strict: true`, zero `any`, full JSDoc on all public API surface |
| Auth | `x-api-key` header on every request — no exceptions |
| Retry policy | Exponential backoff + jitter on 429 and 5xx ONLY. Never retry 4xx. |
| Build output | Dual ESM + CJS via tsup with `.d.ts` generation |
| GSD workflow | Do not make direct repo edits outside a GSD workflow |

---

## Sources

### Primary (HIGH confidence)

- npm registry (live queries run during research session) — verified all package versions
- CLAUDE.md (`C:/Users/omart/subprime/deepidv-sdk-ts/CLAUDE.md`) — project constraints and stack decisions
- `deepidv-sdk-build-guide.md` — canonical architecture reference for this project
- `.planning/phases/01-core-infrastructure/01-CONTEXT.md` — locked implementation decisions D-01 through D-16
- `.planning/REQUIREMENTS.md` — Phase 1 requirement specifications

### Secondary (MEDIUM confidence)

- [Cloudflare Workers: JavaScript and web standards](https://developers.cloudflare.com/workers/runtime-apis/web-standards/) — confirmed fetch, AbortController, AbortSignal native in CF Workers
- [TypeScript 6.0 Announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/) — confirmed GA, strict default, ES5 target removal
- [Zod v4 Migration Guide](https://zod.dev/v4/changelog) — confirmed v4 string format API changes
- [MSW Node Integration](https://mswjs.io/docs/integrations/node/) — confirmed msw v2 setup pattern for vitest
- [pnpm Workspaces](https://pnpm.io/workspaces) — workspace:* protocol and publish behavior
- [Vitest Request Mocking](https://vitest.dev/guide/mocking/requests) — vitest + msw setup confirmed

### Tertiary (LOW confidence)

- WebSearch findings on ESLint v10 ecosystem readiness — plugin compatibility unverified against official typescript-eslint changelog

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via npm registry during session
- Architecture: HIGH — directly specified in CLAUDE.md + build guide + CONTEXT.md locked decisions
- Pitfalls: MEDIUM-HIGH — `instanceof` fix and AbortController reuse are well-documented; Retry-After parsing edges verified against RFC; `workspace:*` stripping verified against pnpm docs
- Test infrastructure: HIGH — vitest + msw is the locked stack; gaps are mechanical (files not yet created)

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (30 days for core tooling; TypeScript/ESLint ecosystem changes more frequently — re-verify before Phase 7)
