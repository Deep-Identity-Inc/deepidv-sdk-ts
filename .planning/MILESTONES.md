# Milestones

## v1.0 deepidv Server SDK (Shipped: 2026-04-06)

**Phases completed:** 7 phases, 18 plans, 25 tasks

**Key accomplishments:**

- One-liner:
- Six-class error hierarchy with instanceof, toJSON, and API key redaction; typed event emitter with unsubscribe-function pattern; config types with defaults — all TDD-tested with 42 passing tests.
- Native fetch HttpClient with x-api-key auth, per-attempt AbortController timeout, exponential backoff retry honoring Retry-After with 60s cap, typed error mapping, and lifecycle events — 102 tests passing
- Explicit named barrel exports wired for both packages with verified ESM + CJS Node imports and 102 passing tests confirming Phase 1 core infrastructure is complete
- 1. [Rule 3 - Blocking] TypeScript DTS build errors for process/Deno/Bun globals
- 1. [Rule 3 - Blocking] TypeScript 6 DTS error: Uint8Array not assignable to BodyInit
- Sessions class with CRUD methods injecting HttpClient, full Zod schema depth for all API shapes, and typed PaginatedResponse wrapper for list normalization
- 14 tests across 4 describe blocks covering all SESS CRUD requirements using real HttpClient + msw interception, including happy paths and ValidationError cases for all four methods
- One-liner:
- Face class with detect/compare/estimateAge methods, Zod schemas for all three operations, and batch parallel upload for face comparison via FileUploader array input
- Document and Face barrel exports wired to @deepidv/server with 15-test msw suite covering scan, detect, compare, and estimateAge including batch presign verification, unknown field stripping, and pre-network ValidationError checks
- Identity class with verify() method using batch presign for parallel document+face upload to single POST /v1/identity/verify, returning unified IdentityVerificationResult with all sub-results required
- 9-test Identity.verify() suite with msw: happy path, batch presign count:2, field forwarding, unknown field stripping, verified:false, and 3 ValidationError cases
- Task 1 (TDD): DeepIDV class (`packages/server/src/deepidv.ts`)
- Two GitHub Actions workflows: CI runs full test suite on Node 18 + 22 matrix for every PR; publish workflow uses changesets/action to create Version PRs and publish to npm with provenance attestation.
- Fixed 6 runtime field name errors in node-basic and created express-app and nextjs-app examples satisfying PUB-04

---
