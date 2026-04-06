# deepidv Server SDK

## What This Is

A backend-first TypeScript SDK (`@deepidv/server`) that wraps the deepidv identity verification API. Developers install it on their server (Node 18+, Deno, Bun, Cloudflare Workers, edge runtimes) and programmatically create verification sessions, scan IDs, compare faces, estimate age, and verify identities. The SDK handles file uploads to S3 via presigned URLs under the hood — developers just pass image buffers and get typed results back. This is not a UI kit.

## Core Value

Developers pass images in and get typed verification results back — all presigned URL orchestration, retry logic, and error handling is invisible.

## Requirements

### Validated

- [x] Monorepo scaffolding with pnpm workspace (`@deepidv/core` + `@deepidv/server`) — Validated in Phase 1: Core Infrastructure
- [x] TypeScript strict mode, ES2022 target, tsup dual ESM + CJS build — Validated in Phase 1: Core Infrastructure
- [x] HTTP client using native fetch with base URL, auth (x-api-key header), JSON parsing — Validated in Phase 1: Core Infrastructure
- [x] Error classes: DeepIDVError, AuthenticationError (401), RateLimitError (429), ValidationError (400), NetworkError, TimeoutError — Validated in Phase 1: Core Infrastructure
- [x] Retry logic with exponential backoff + jitter (429 and 5xx only, never 4xx) — Validated in Phase 1: Core Infrastructure
- [x] Typed event emitter for request lifecycle events — Validated in Phase 1: Core Infrastructure
- [x] Presigned URL upload handler — accepts Buffer, Uint8Array, ReadableStream, file path, base64; handles single and batch uploads — Validated in Phase 2: Presigned Upload Handler
- [x] Zod-based runtime input validation on all public methods — Validated in Phase 2: Presigned Upload Handler
- [x] `client.sessions.create()` — create hosted verification session — Validated in Phase 3: Sessions Module
- [x] `client.sessions.retrieve()` — retrieve full session with analysis data — Validated in Phase 3: Sessions Module
- [x] `client.sessions.list()` — list sessions with filtering — Validated in Phase 3: Sessions Module
- [x] `client.sessions.updateStatus()` — update session status — Validated in Phase 3: Sessions Module

### Active
- [ ] `client.document.scan()` — upload document image, get structured OCR data
- [ ] `client.face.detect()` — upload image, get face detection confidence
- [ ] `client.face.compare()` — upload two images, get face match confidence (parallel presigned uploads)
- [ ] `client.face.estimateAge()` — upload image, get estimated age and gender
- [ ] `client.identity.verify()` — orchestrated: document.scan + face.detect + face.compare in one call
- [ ] Full JSDoc on every public method and field, zero `any` in codebase
- [ ] Tests (vitest + msw), examples, and npm publishing pipeline

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
| Zod for runtime validation | Type inference from schemas + runtime validation in one library, zero-dep itself | — Pending |
| tsup for bundling | Dual ESM + CJS output, .d.ts generation, tree-shaking — minimal config | Validated Phase 1 |
| Presigned URL upload pattern | Keeps file uploads out of our API servers, leverages S3 directly, supports large files | — Pending |
| Grouped module API (client.face.detect) over flat (client.detectFace) | Better discoverability, autocomplete groups related methods, matches API structure | — Pending |

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
*Last updated: 2026-04-05 after Phase 1 completion — core infrastructure validated*
