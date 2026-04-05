# Project Research Summary

**Project:** deepidv Server SDK (`@deepidv/server`)
**Domain:** TypeScript SDK — server-side identity verification, presigned S3 uploads, cross-runtime, dual ESM/CJS, pnpm monorepo
**Researched:** 2026-04-05
**Confidence:** HIGH

## Executive Summary

The deepidv server SDK is a TypeScript npm package that wraps a REST identity-verification API. Experts build this class of SDK using a thin public surface over a fat internal core: cross-cutting concerns (auth, retry, timeout, error mapping, event emission) live entirely in a private `@deepidv/core` package, while `@deepidv/server` exposes only the grouped resource modules (`sessions`, `document`, `face`, `identity`) and the main client class. The most technically distinctive requirement — presigned S3 uploads — means the SDK must hide a three-call flow (presign → parallel PUT → process) behind simple method calls, and must handle every input type (Buffer, Uint8Array, ReadableStream, base64, file path) without any Node-specific global leaking into the edge-runtime path. The architecture is already specified in the repo's build guide; this is an implementation project, not a design discovery project.

The recommended approach is a 7-phase build following strict dependency order: monorepo scaffolding and core infrastructure first (config, errors, auth, retry, HTTP client, event emitter), then the upload handler (the highest-risk single component), then the sessions module as a first end-to-end integration proof, then document and face primitives, then the orchestrated `identity.verify` compound call, and finally the public entry point assembly, test suite, and publishing pipeline. tsup handles dual ESM/CJS output with a single config, zod is the only production dependency (used for runtime validation and type inference simultaneously), and vitest + msw handle testing without Jest/Babel overhead.

The key risks are all well-understood and preventable. The three most dangerous: a wrong `exports` field in `package.json` (breaks ESM consumers silently at install time), Content-Type mismatch on S3 PUT (causes 403 with XML body that looks like an auth failure), and ReadableStream single-consumption (causes silent data corruption where uploads succeed but results are empty). All three have deterministic prevention strategies documented in research. The architecture's edge-runtime constraint (no Node-specific globals in `@deepidv/core`) is the cross-cutting discipline that must be enforced from day one — it cannot be retrofitted.

---

## Key Findings

### Recommended Stack

The stack is essentially fully specified by the project's own constraints and is well-supported by established community patterns. tsup wraps esbuild to produce dual ESM + CJS output with TypeScript declaration files in a single 15-line config — the only bundler choice that achieves this without multi-plugin complexity. zod v3 is the sole production dependency: schema definitions serve as both runtime validators and TypeScript type sources via `z.infer<>`, eliminating schema/type drift. vitest with msw provides ESM-native testing with no transformation configuration, which is critical for an ESM-first codebase. pnpm workspaces with strict hoisting provides phantom-dependency protection that npm workspaces cannot match. Changesets manages versioning with explicit developer control over semver increments, avoiding the "commit-message-drives-major-bump" problem of semantic-release.

Version numbers (TypeScript `^5.4`, zod `^3.23`, vitest `^1.6`/`^2.x`) should be confirmed at npmjs.com before pinning — web search was unavailable during research. Zod v4 may have shipped stable; if so, evaluate migration before starting rather than mid-build.

**Core technologies:**
- **TypeScript `^5.4`** — language; strict mode + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` enforces zero-`any` requirement
- **tsup `^8.x`** — bundler; dual ESM + CJS + `.d.ts` in one pass, zero plugin config
- **zod `^3.23`** — runtime validation + type inference; single production dependency; works in all target runtimes
- **vitest `^1.6`/`^2.x`** — test runner; ESM-native, same esbuild pipeline as tsup, no transformation mismatch
- **msw `^2.x`** — HTTP mocking; native `fetch`-compatible, declarative handler model
- **pnpm `^9.x`** — monorepo host; strict dependency isolation, `workspace:*` protocol
- **@changesets/cli `^2.x`** — versioning + changelog; explicit changeset per PR, safe for public SDK semver

### Expected Features

Research cross-referenced five major SDK providers (Stripe Identity, Onfido, Jumio, Veriff, Persona). The patterns are highly stable — every table-stakes item is consistent across all five.

**Must have (table stakes):**
- Full TypeScript types with no `any` — expected by all consumers, hardest to retrofit after publish
- Named error classes (`AuthenticationError`, `RateLimitError`, `ValidationError`, `NetworkError`, `TimeoutError`) — Stripe set this pattern; consumers rely on `instanceof` checks
- Retry on 429 and 5xx only, never 4xx — hard contract that must be correct from day one
- Buffer/Uint8Array file input — server-side code never has a `File` object; this is baseline
- JSDoc on every public method — IDE hover docs are the primary API reference for most developers
- Session CRUD (create, retrieve, list, updateStatus) — standard hosted verification workflow
- `document.scan()` — single-call OCR returning structured typed result
- `face.detect()` and `face.compare()` — core KYC primitives
- Runtime input validation (Zod) before any network call — developer-friendly errors locally
- Configurable timeout per request — ML inference can exceed short HTTP timeouts
- API key authentication via `x-api-key` header — standard server-to-server auth
- Presigned URL upload abstraction — hide 3-call S3 flow behind simple method signature

**Should have (competitive differentiators):**
- Multi-input type polymorphism (Buffer, Uint8Array, ReadableStream, base64 string, file path) — eliminates caller boilerplate; no competitor accepts all formats
- Parallel batch presigned uploads for multi-file calls — halves latency for `face.compare` and `identity.verify`
- Typed event emitter for request lifecycle (`onRequest`, `onResponse`, `onRetry`, `onError`) — enables APM/logging without stdout pollution
- `identity.verify()` orchestrated compound call — single method wrapping document scan + face detect + face compare; no competitor offers this as a first-class SDK method
- Zero AWS SDK dependency for S3 — native `fetch` + presigned URLs; edge-runtime compatible; competitors break on Cloudflare Workers
- `face.estimateAge()` — age estimation as first-class method; not surfaced by Stripe, Onfido, or Veriff
- Discriminated union `DocumentScanResult` by `documentType` — typed fields per document variant; eliminates defensive null-checking

**Defer (v2+):**
- Exported Zod schemas for consumer integration testing — novel, validate demand first
- Workflow management — explicitly out of scope in PROJECT.md
- Silent screening (PEP/sanctions), address verification, phone verification — future modules
- UI components / drop-in widgets — belongs in a separate `@deepidv/web` package

### Architecture Approach

The architecture follows a thin-module, fat-core pattern across a two-package pnpm monorepo. `@deepidv/core` (private, not published directly) owns all cross-cutting concerns: HTTP client, auth middleware, retry engine, presigned upload handler, typed event emitter, and error class hierarchy. `@deepidv/server` (public) contains only thin modules — each module is three operations: Zod validation, FileUploader call (if file-bearing), HttpClient call, return typed result. The `DeepIDV` class assembles all modules as named namespace properties (`client.face.detect()`, `client.sessions.create()`), mirroring the API URL structure and matching the Stripe/Twilio namespace convention. All HTTP — including S3 PUTs — flows through deliberate boundaries: processing calls through `HttpClient`, S3 PUTs isolated in `FileUploader` with no auth header.

**Major components:**
1. **`@deepidv/core/client.ts` (HttpClient)** — native `fetch` wrapper handling base URL, auth header injection, JSON serialization, AbortController timeout, retry dispatch, and response-to-typed-error mapping
2. **`@deepidv/core/uploader.ts` (FileUploader)** — normalizes all input types to `Uint8Array`, requests presigned URLs, PUTs to S3 with matching Content-Type, supports `count: N` batch presigning with `Promise.allSettled` parallel uploads
3. **`@deepidv/core/errors.ts`** — `DeepIDVError` base class hierarchy; all errors carry `statusCode`, `errorCode`, `requestId`, and `cause` (original error chain preserved)
4. **`@deepidv/core/retry.ts`** — allowlist of 429 and 5xx only; full jitter exponential backoff; honors `Retry-After` header on 429
5. **`@deepidv/server/modules/`** — thin wrappers for `sessions`, `document`, `face`, `identity`; each is Zod validate → upload (if needed) → HTTP call → return typed result
6. **`@deepidv/server/deepidv.ts` (DeepIDV)** — public client class; instantiates all modules as namespace properties; validates config at construction time

### Critical Pitfalls

1. **Wrong `exports` field in `package.json`** — ESM consumers receive `ERR_PACKAGE_PATH_NOT_EXPORTED`, CJS consumers get wrong file, TypeScript consumers see `Cannot find module`. Prevention: write the complete `exports` map with `import`/`require`/`types` conditions (with `types` before `default` in each condition) before writing any module code. Test against a consumer project before Phase 2.

2. **S3 Content-Type mismatch → 403 `SignatureDoesNotMatch`** — the presigned URL signature includes the expected Content-Type; sending a different value (or omitting it) returns a 403 with XML body that developers mistake for an auth failure. Prevention: detect MIME type via magic bytes or extension before the presign call; send the identical Content-Type on the PUT; parse S3 error responses as text (not JSON).

3. **ReadableStream consumed twice → silent data corruption** — reading a stream once for content-type detection drains it; the upload PUTs zero bytes; S3 accepts it; the API returns garbage results with no error. Prevention: materialize any ReadableStream to `Uint8Array` once at the SDK boundary; require explicit `mimeType` from callers passing streams; never read a stream more than once.

4. **Retry logic retrying 4xx errors** — retrying `ValidationError` (400) burns quota and delays developer feedback through exponential backoff delays. Prevention: allowlist only 429 + 5xx; write the retry test before the HTTP client is used anywhere; hard-code this as a named constant, not a magic number.

5. **`workspace:*` protocol in published `package.json`** — publishing with `npm publish` instead of `pnpm publish` leaves `workspace:*` dependency specifiers that are invalid on npm; consumer installs fail. Prevention: always publish through `pnpm publish` (which rewrites workspace protocol); or use `noExternal: ['@deepidv/core']` in tsup to bundle core into server output, eliminating the runtime dependency entirely.

---

## Implications for Roadmap

The build order is fully determined by component dependencies. Nothing in `@deepidv/server` can be built before the `@deepidv/core` component it depends on. The architecture research already provides a 7-phase dependency graph; the roadmap should follow it directly.

### Phase 1: Monorepo Scaffolding and Core Infrastructure

**Rationale:** Every subsequent phase depends on this. The `exports` map must be correct before any module code is written — it is invisible until a consumer installs. TypeScript config, ESLint, error class hierarchy, and retry logic must all be established as patterns before any module inherits them.
**Delivers:** Working pnpm workspace with two packages, correct dual ESM/CJS `exports` maps, TypeScript base config, ESLint with `typescript-eslint` recommended-type-checked, `DeepIDVError` hierarchy with `cause` chaining, `RetryEngine` (429 + 5xx only, full jitter), `HttpClient` (fetch wrapper with auth, timeout, retry dispatch, error mapping), `EventEmitter` (typed lifecycle events).
**Addresses features:** API key auth, configurable timeout, retry on 429/5xx, named error classes.
**Avoids:** Pitfalls 1 (exports map), 2 (declaration files), 5 (retry 4xx), 6 (internal type leakage), 7 (workspace protocol), 8 (edge runtime globals), 9 (AbortController cleanup), 12 (Zod/type drift pattern), 14 (error cause chaining), 15 (moduleResolution).

### Phase 2: Presigned Upload Handler

**Rationale:** `FileUploader` is the highest-risk single component. Every file-bearing module (document, face, identity) depends on it being correct. Validating it in isolation — with the S3 Content-Type contract and stream materialization — before building modules on top prevents cascading rework.
**Delivers:** `FileUploader` accepting `Buffer | Uint8Array | ReadableStream | string` (file path, base64, data URL); MIME type detection via magic bytes; single and batch presign (`count: N`); `Promise.allSettled` parallel PUTs to S3; separate `uploadTimeout` config; XML error response parsing for S3 403s; dynamic `fs` import for file path support (edge-safe).
**Addresses features:** Buffer/Uint8Array file input, multi-input type polymorphism, parallel batch uploads, presigned URL abstraction, zero AWS SDK dependency.
**Avoids:** Pitfalls 3 (Content-Type mismatch), 4 (ReadableStream double-read), 8 (edge runtime fs), 11 (parallel upload error propagation), 13 (separate upload timeout), 16 (base64 vs data URL).

### Phase 3: Sessions Module (First End-to-End Integration Proof)

**Rationale:** Sessions uses only `HttpClient` — no file uploads. Building it before document/face modules proves the HTTP client, auth, typing patterns, and event emission end-to-end with the simplest possible code. A passing `client.sessions.create()` integration test confirms the core plumbing before adding presigned URL complexity.
**Delivers:** `SessionsModule` with `create()`, `retrieve()`, `list()` (paginated), `updateStatus()`; full Zod input validation; typed session result objects; JSDoc on all methods; session module tests with msw handlers.
**Addresses features:** Session CRUD.
**Uses stack:** HttpClient, zod, vitest, msw.

### Phase 4: Document and Face Primitives

**Rationale:** Both modules use `FileUploader` + `HttpClient` and can be built in parallel. `face.compare()` introduces the parallel dual-upload pattern (`Promise.allSettled`). These are the core verification primitives that `identity.verify` will orchestrate.
**Delivers:** `DocumentModule.scan()` returning typed discriminated-union `DocumentScanResult` by `documentType`; `FaceModule.detect()`, `FaceModule.compare()` (parallel two-image upload), `FaceModule.estimateAge()`; full Zod validation; JSDoc; msw-mocked tests for all methods.
**Addresses features:** `document.scan`, `face.detect`, `face.compare`, `face.estimateAge`, structured discriminated-union OCR results.
**Avoids:** Pitfall 11 (parallel upload error propagation in `face.compare`).

### Phase 5: Orchestrated Identity Module

**Rationale:** `identity.verify` orchestrates document scan + face detect + face compare as a single compound call. It is the highest-value feature but depends on all Phase 4 primitives being correct. Building it last in the feature sequence avoids rework if primitives change.
**Delivers:** `IdentityModule.verify()` accepting document image + face image; batch presigns both in one call (`count: 2`); parallel PUT uploads; single POST to `/v1/identity/verify`; unified typed `IdentityVerificationResult` return.
**Addresses features:** Orchestrated `identity.verify`, parallel batch uploads at maximum concurrency.

### Phase 6: Public Entry Point Assembly

**Rationale:** `DeepIDV` class can only be assembled after all modules exist. This phase wires everything together and establishes the final public API surface.
**Delivers:** `DeepIDV` class with `client.sessions`, `client.document`, `client.face`, `client.identity` namespace properties; config validation at construction time; explicit enumerated exports in `packages/server/src/index.ts` (no wildcard re-exports from core); full JSDoc on `DeepIDV` constructor and config interface.
**Avoids:** Pitfall 6 (internal type leakage through wildcard re-exports).

### Phase 7: Test Suite, Examples, and Publishing Pipeline

**Rationale:** Full integration test suite, examples demonstrating real usage patterns, and the changesets publishing pipeline. This phase has no functional dependencies within the SDK itself but depends on the full API surface being stable.
**Delivers:** Complete vitest + msw test suite with coverage; `examples/` demonstrating `document.scan`, `face.compare`, `identity.verify`, and session CRUD; changesets config; CI publish workflow using `pnpm publish`; bundle analysis confirming `"sideEffects": false`; consumer test project validating declaration files under `moduleResolution: bundler`.
**Avoids:** Pitfalls 2 (declaration file consumer test), 10 (sideEffects tree-shaking), 17 (core/server version mismatch — evaluate `noExternal` bundling).

### Phase Ordering Rationale

- The dependency graph is strict: `errors` → `retry` → `client` → `uploader` → modules → `DeepIDV`. No phase can be reordered without breaking imports.
- Sessions before document/face (Phase 3 before Phase 4) is a deliberate integration checkpoint — it proves the full HTTP path with zero file-handling complexity, making it easier to isolate upload-related bugs in Phase 4.
- The upload handler as its own phase (Phase 2) reflects its risk profile: it is the single most error-prone component (Content-Type contract, stream materialization, parallel error propagation) and must be validated before anything builds on top of it.
- Publishing (Phase 7) is last because the `exports` map shape must be validated against a real consumer project — this cannot be done until the full package output exists.

### Research Flags

Phases with well-documented patterns (skip research-phase — research is already done):
- **Phase 1:** All patterns (monorepo setup, exports map, TypeScript config, error hierarchy, retry engine) are fully specified in ARCHITECTURE.md and PITFALLS.md with exact code patterns.
- **Phase 3:** Session CRUD over HTTP is a standard REST module — no novel patterns. HttpClient already designed in Phase 1.
- **Phase 6:** Entry point assembly is mechanical — wire modules to class, enumerate exports. No design decisions remaining.
- **Phase 7:** changesets + pnpm publish pipeline is well-documented. vitest + msw patterns are established in earlier phases.

Phases that may benefit from targeted research during planning:
- **Phase 2 (FileUploader):** The presigned URL API contract (what fields the deepidv API returns in the presign response, what error codes S3 returns for specific failures) should be confirmed against the actual API documentation before implementation. The research documents the prevention strategies but cannot confirm the exact presign request/response shape.
- **Phase 4/5 (module response types):** The exact shape of `DocumentScanResult`, `FaceCompareResult`, and `IdentityVerificationResult` as returned by the deepidv API must be confirmed against the API reference. These are typed assumptions in the research — the actual API response shapes drive the Zod schemas.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Tooling choices (tsup, zod, vitest, msw, pnpm, changesets) are mandated by PROJECT.md and well-established. Version numbers need live confirmation — web search unavailable during research session. |
| Features | HIGH | Table stakes patterns cross-confirmed across Stripe, Onfido, Veriff, Jumio, Persona in training data. Differentiators assessed as genuine market gaps with MEDIUM confidence (market may have moved since August 2025 cutoff). Anti-features are well-documented SDK design mistakes with HIGH confidence. |
| Architecture | HIGH | Primary source is the repo's own `deepidv-sdk-build-guide.md`. Architecture is already decided; research validated and documented it. Component boundaries and data flow are specified precisely. |
| Pitfalls | HIGH | All 17 pitfalls are reproducible, documented problems in the TypeScript SDK ecosystem with deterministic prevention strategies. S3 Content-Type and ReadableStream pitfalls are the most project-specific; all others are universal SDK patterns. |

**Overall confidence:** HIGH

### Gaps to Address

- **Exact API response shapes:** The Zod schemas for `DocumentScanResult`, `FaceCompareResult`, `SessionCreateResult`, and `IdentityVerificationResult` must be derived from the actual deepidv API reference documentation, not inferred. These are the load-bearing types for the whole SDK.
- **Presign API contract:** The exact request and response shape for `POST /v1/uploads/presign` (field names, whether `count: N` returns an array or a map, what `fileKey` is called, what S3-related fields are returned) must be confirmed against the API docs before Phase 2 implementation.
- **Zod v4 stability:** Check `npm show zod dist-tags` before starting. If v4 is stable, evaluate migration before writing any schemas — migrating mid-build is costly.
- **Package version confirmation:** Run `npm show typescript version`, `npm show tsup version`, `npm show vitest version` to confirm current stable versions before pinning in `package.json`.
- **`@deepidv/core` publish strategy:** The research recommends evaluating `noExternal: ['@deepidv/core']` in tsup to bundle core into server output, eliminating the runtime dependency and the workspace protocol stripping risk (Pitfall 7). This decision should be made in Phase 1 before the publishing pipeline is designed.

---

## Sources

### Primary (HIGH confidence)
- `deepidv-sdk-build-guide.md` (repo root) — architecture, component map, build order, data flow
- `.planning/PROJECT.md` — project constraints, mandated tools, scope boundaries
- ARCHITECTURE.md (`.planning/research/`) — detailed component boundaries, patterns, anti-patterns, phase dependencies
- PITFALLS.md (`.planning/research/`) — 17 pitfalls with prevention code patterns, phase-specific warnings

### Secondary (MEDIUM confidence)
- STACK.md (`.planning/research/`) — technology rationale; version numbers need live verification
- FEATURES.md (`.planning/research/`) — competitor patterns from Stripe, Onfido, Veriff, Jumio, Persona (training data, August 2025 cutoff)
- Stripe Node SDK (github.com/stripe/stripe-node) — namespace pattern, error hierarchy, thin-module design
- Twilio Node SDK (github.com/twilio/twilio-node) — namespace pattern

### Tertiary (needs live verification before use)
- npmjs.com — version confirmation for all dependencies (web search unavailable during research)
- deepidv API reference — exact response shapes for `DocumentScanResult`, `FaceCompareResult`, `IdentityVerificationResult`, and presign endpoint contract

---
*Research completed: 2026-04-05*
*Ready for roadmap: yes*
