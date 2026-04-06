# deepidv Server SDK

## What This Is

A backend-first TypeScript SDK (`@deepidv/server`) that wraps the deepidv identity verification API. Developers install it on their server (Node 18+, Deno, Bun, Cloudflare Workers, edge runtimes) and programmatically create verification sessions, scan IDs, compare faces, estimate age, and verify identities. The SDK handles file uploads to S3 via presigned URLs under the hood — developers just pass image buffers and get typed results back. This is not a UI kit.

## Core Value

Developers pass images in and get typed verification results back — all presigned URL orchestration, retry logic, and error handling is invisible.

## Requirements

### Validated (v1.0)

All 57 requirements shipped and verified. Full list in `.planning/milestones/v1.0-REQUIREMENTS.md`.

**Infrastructure (Phase 1)**
- [x] pnpm monorepo, TypeScript strict, tsup dual ESM+CJS, ESLint+Prettier
- [x] Native fetch HTTP client with x-api-key auth, timeout, exponential backoff retry
- [x] 6-class typed error hierarchy with cause chaining and API key redaction
- [x] Typed event emitter for request lifecycle events

**File Uploads (Phase 2)**
- [x] Presigned URL upload handler — Buffer, Uint8Array, ReadableStream, file path, base64
- [x] Content-type detection, parallel batch uploads, separate upload timeout
- [x] Zod-based runtime input validation on all public methods

**API Modules (Phases 3-5)**
- [x] Sessions CRUD: create, retrieve, list (paginated), updateStatus
- [x] Document scan with structured OCR data and optional documentType
- [x] Face detect, compare (parallel uploads), estimateAge
- [x] Identity verify — orchestrated document+face in one call with parallel uploads

**Public Surface (Phase 6)**
- [x] DeepIDV class as single entry point with Zod config validation
- [x] Grouped module namespaces, full JSDoc, zero `any`, explicit named exports

**Quality (Phase 7)**
- [x] 185-test suite (vitest + msw) with consumer type-check validation
- [x] 3 example projects: node-basic, express-app, nextjs-app
- [x] Changesets CI/CD with GitHub Actions (CI on PR, publish on release)

### Active

(none — planning next milestone)

### Recently Validated

(merged into Validated after v1.0 milestone completion)

### Out of Scope

- Financial / bank statement analysis — future module
- Workflows (create/manage) — future module
- Silent screening (PEP, sanctions, adverse media, title check) — future module
- Address verification (session-based) — future module
- Phone verification (session-based) — future module
- UI components (`@deepidv/web`) — future package
- iOS/Android native SDKs — future packages
- OAuth/token-based auth — x-api-key is sufficient for v1
- AWS SDKs — all AWS orchestration lives in the API backend

## Current State

Shipped v1.0 with 6,730 LOC TypeScript across 2 packages. 185 tests passing. Ready for npm publish via changesets.

## Context

- **API base URL:** https://api.deepidv.com
- **API docs:** https://docs.deepidv.com/api-reference
- **Brand:** "deepidv" (all lowercase). PascalCase `DeepIDV` only for TypeScript class/type names.
- **Build reference:** `deepidv-sdk-build-guide.md` in repo root contains full type definitions for every module input/output, presigned upload flow, session response shapes, and all architectural decisions.
- **Three service tiers:**
  1. Synchronous (simple) — one call, one result (document.scan, face.detect, face.compare, face.estimateAge)
  2. Orchestrated (compound synchronous) — one call running multiple services internally (identity.verify)
  3. Session-based (multi-step, future) — create session, interact over time, get result
- **Presigned upload flow:** SDK calls POST /v1/uploads/presign → gets { uploadUrl, fileKey } → PUTs file to S3 → calls processing endpoint with fileKey → returns typed result. Multi-file ops batch presigned URLs and upload in parallel.
- **Module structure:** `client.sessions`, `client.document`, `client.face`, `client.identity` — grouped, not flat.
- **Only dependency:** zod. Everything else uses native web APIs (fetch, Blob, AbortController, ReadableStream, crypto.subtle) for universal runtime support.
- **Known tech debt:** 5 minor items tracked in `.planning/milestones/v1.0-MILESTONE-AUDIT.md` (batch presign contentType, example documentation inaccuracies)

## Constraints

- **Runtime compatibility**: Must work on Node 18+, Deno, Bun, Cloudflare Workers, and edge runtimes — no Node-specific APIs in core
- **Zero AWS SDKs**: SDK only talks to api.deepidv.com over HTTPS — never directly to AWS services
- **Minimal dependencies**: Only zod. Everything else via native web APIs
- **TypeScript strictness**: `strict: true`, zero `any`, full JSDoc on all public API surface
- **Auth**: x-api-key header on every request
- **Retry policy**: Exponential backoff with jitter on 429 and 5xx only, never retry 4xx
- **Build output**: Dual ESM + CJS via tsup with .d.ts generation

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| pnpm monorepo with @deepidv/core + @deepidv/server | Core internals shared across future packages (web, react, etc.) without exposing to developers | Validated Phase 1 |
| Native fetch over axios/got | Universal runtime support (Node 18+, Deno, Bun, Workers) with zero HTTP deps | Validated Phase 1 |
| Zod for runtime validation | Type inference from schemas + runtime validation in one library, zero-dep itself | Validated Phase 4 |
| tsup for bundling | Dual ESM + CJS output, .d.ts generation, tree-shaking — minimal config | Validated Phase 1 |
| Presigned URL upload pattern | Keeps file uploads out of our API servers, leverages S3 directly, supports large files | Validated Phase 4 |
| Grouped module API (client.face.detect) over flat (client.detectFace) | Better discoverability, autocomplete groups related methods, matches API structure | Validated Phase 4 |
| Independent identity schemas over reusing Phase 4 types | Identity module decoupled from document/face modules — API can evolve response shapes independently | Validated Phase 5 |
| DeepIDV class as single entry point over direct module instantiation | Consumers use `new DeepIDV({ apiKey })` — module classes are internal, config validation is centralized, shared infrastructure (HttpClient, FileUploader, emitter) is wired once | Validated Phase 6 |
| noExternal core into server bundle | `@deepidv/core` inlined into `@deepidv/server` — consumers install one package, no workspace:* resolution needed at runtime | Validated Phase 7 |
| Changesets over semantic-release | Explicit version control — developer decides patch/minor/major, not commit message parsing | Validated Phase 7 |
| msw over nock/fetch-mock | Handler-based HTTP interception compatible with native fetch; isomorphic for future `@deepidv/web` | Validated Phase 7 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-06 after v1.0 milestone — shipped SDK with 57 requirements validated, 185 tests, 6,730 LOC TypeScript*
