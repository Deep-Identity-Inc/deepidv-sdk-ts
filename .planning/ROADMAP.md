# Roadmap: deepidv Server SDK

## Overview

Seven phases build the SDK from the inside out, following strict component dependencies. Core infrastructure (HTTP client, auth, retry, errors, event emitter) ships first because every module depends on it. The presigned upload handler ships second because it is the highest-risk component — all file-bearing modules build on top of it. Sessions proves the end-to-end HTTP path before file uploads are involved. Document and face primitives follow, then the orchestrated identity module, then public entry point assembly, and finally the full test suite and publishing pipeline.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Core Infrastructure** - Monorepo scaffold, HTTP client, auth, retry, errors, event emitter, runtime compat
- [ ] **Phase 2: Presigned Upload Handler** - File input normalization, presign flow, parallel S3 uploads, Zod validation
- [ ] **Phase 3: Sessions Module** - First end-to-end HTTP integration: session CRUD with typed input/output
- [ ] **Phase 4: Document & Face Primitives** - document.scan, face.detect, face.compare, face.estimateAge
- [ ] **Phase 5: Identity Module** - Orchestrated compound call: document scan + face detect + face compare in one method
- [ ] **Phase 6: Public Entry Point** - DeepIDV class assembly, explicit exports, full JSDoc on public surface
- [ ] **Phase 7: Tests, Examples & Publishing** - Full test suite, example projects, changesets, CI/CD publish pipeline

## Phase Details

### Phase 1: Core Infrastructure
**Goal**: A working pnpm monorepo with two packages, a native-fetch HTTP client with auth and retry, a typed error hierarchy, a typed event emitter, and runtime compatibility across Node 18+, Deno, Bun, and Cloudflare Workers
**Depends on**: Nothing (first phase)
**Requirements**: BUILD-01, BUILD-02, BUILD-03, BUILD-04, BUILD-05, HTTP-01, HTTP-02, HTTP-03, HTTP-04, ERR-01, ERR-02, ERR-03, ERR-04, ERR-05, ERR-06, EVT-01, EVT-02, COMPAT-01, COMPAT-02, COMPAT-03, COMPAT-04
**Success Criteria** (what must be TRUE):
  1. `pnpm install && pnpm build` completes with zero errors, producing ESM and CJS output with `.d.ts` files in both packages
  2. An HTTP request from `@deepidv/core` HttpClient includes the `x-api-key` header, applies exponential-backoff retry on 429/5xx, and never retries 4xx
  3. Throwing `new AuthenticationError(...)` produces an instance of `DeepIDVError` with `cause` chain intact and no API key in the serialized output
  4. The built `@deepidv/core` package imports without error in a Node 18 script, a Deno script, and a Cloudflare Workers `wrangler dev` session
  5. Lifecycle events (request start, retry, error) fire on an `EventEmitter` subscriber without blocking the return path
**Plans:** 4/4 plans executed

Plans:
- [x] 01-01-PLAN.md — Monorepo scaffold, TypeScript configs, tsup build, ESLint + Prettier
- [x] 01-02-PLAN.md — Config types, error hierarchy, typed event emitter with tests
- [x] 01-03-PLAN.md — HTTP client with auth, retry logic, and tests
- [x] 01-04-PLAN.md — Barrel exports, server shell, build verification, runtime compat

### Phase 2: Presigned Upload Handler
**Goal**: A `FileUploader` in `@deepidv/core` that accepts any supported input type, detects content type, requests presigned URLs, PUTs files to S3, and returns `fileKey`s — with Zod validation on all public method inputs
**Depends on**: Phase 1
**Requirements**: UPL-01, UPL-02, UPL-03, UPL-04, UPL-05, UPL-06, UPL-07, VAL-01, VAL-02, VAL-03
**Success Criteria** (what must be TRUE):
  1. Passing a `Buffer`, `Uint8Array`, file path string, base64 string, and `ReadableStream` each produce a non-empty `fileKey` after a successful presign + S3 PUT cycle
  2. A `ReadableStream` is materialized to `Uint8Array` exactly once at the SDK boundary — the same stream cannot be passed twice without error
  3. Calling a public method with a missing required field throws a `ValidationError` with the parameter name and expected type in the message, before any network call is made
  4. A two-file batch presign issues one presign request (`count: 2`) and two parallel S3 PUTs, completing faster than two sequential uploads would
  5. The `FileUploader` imports and runs on Cloudflare Workers without referencing `fs`, `path`, or any Node-specific global
**Plans:** 1/2 plans executed

Plans:
- [x] 02-01-PLAN.md — Config extensions, event types, input normalization, content detection, Zod validation
- [x] 02-02-PLAN.md — FileUploader class, presign + S3 PUT flow, barrel exports, integration tests

### Phase 3: Sessions Module
**Goal**: Developers can create, retrieve, list, and update verification sessions through `client.sessions` with fully typed inputs and outputs
**Depends on**: Phase 1
**Requirements**: SESS-01, SESS-02, SESS-03, SESS-04
**Success Criteria** (what must be TRUE):
  1. `client.sessions.create({ ... })` returns a typed `SessionCreateResult` with at least `sessionId`, `status`, and `sessionUrl`
  2. `client.sessions.retrieve(id)` returns the full session object including analysis data and presigned resource URLs
  3. `client.sessions.list({ limit, offset, status })` returns a paginated list of sessions, with TypeScript enforcing valid status filter values
  4. `client.sessions.updateStatus(id, "VERIFIED")` rejects non-enumerated status values at compile time and returns the updated session
**Plans**: TBD

### Phase 4: Document & Face Primitives
**Goal**: Developers can call document.scan and all three face methods, passing image files in any supported format and receiving typed structured results
**Depends on**: Phase 2
**Requirements**: DOC-01, DOC-02, DOC-03, FACE-01, FACE-02, FACE-03, FACE-04
**Success Criteria** (what must be TRUE):
  1. `client.document.scan({ image: buffer, documentType: "passport" })` returns a `DocumentScanResult` with typed `fullName`, `dateOfBirth`, `documentNumber`, `expirationDate`, `issuingCountry`, `confidence`, and `rawFields`
  2. `client.face.detect({ image: buffer })` returns face detection confidence, bounding box coordinates, and facial landmarks
  3. `client.face.compare({ image1: buffer, image2: buffer })` uploads both images in parallel and returns `matchConfidence`, `threshold`, and a boolean `passed`
  4. `client.face.estimateAge({ image: buffer })` returns `estimatedAge`, `ageRange`, `gender`, and `confidence`
  5. All four methods trigger the presigned upload flow internally — the caller never constructs a presigned URL or calls S3 directly
**Plans**: TBD

### Phase 5: Identity Module
**Goal**: Developers can run a full document + face identity verification in one method call, with parallel uploads and a single unified result
**Depends on**: Phase 4
**Requirements**: IDV-01, IDV-02, IDV-03
**Success Criteria** (what must be TRUE):
  1. `client.identity.verify({ documentImage: buffer, faceImage: buffer })` returns an `IdentityVerificationResult` containing `document`, `faceDetection`, `faceMatch`, `overallConfidence`, and a boolean `verified`
  2. The document and face image uploads are dispatched in parallel (single batch presign call with `count: 2`) rather than sequentially
  3. A failure in any sub-operation (document scan, face detect, or face compare) surfaces as a typed `DeepIDVError` subclass, not an untyped exception
**Plans**: TBD

### Phase 6: Public Entry Point
**Goal**: The `DeepIDV` class is the single public entry point with grouped module namespaces, config validation, full JSDoc, zero `any`, and explicit named exports
**Depends on**: Phase 3, Phase 5
**Requirements**: API-01, API-02, API-03, API-04, API-05
**Success Criteria** (what must be TRUE):
  1. `new DeepIDV({ apiKey: "..." })` instantiates successfully and provides `client.sessions`, `client.document`, `client.face`, and `client.identity` as typed namespace properties
  2. Constructing `DeepIDV` without `apiKey` throws a `ValidationError` synchronously before any network call
  3. Every public method, parameter, and return type has JSDoc visible in IDE hover tooltips
  4. TypeScript reports zero errors with `strict: true` and `noImplicitAny: true` across the entire codebase, with no `any` in source or generated `.d.ts` files
  5. The `@deepidv/server` package index uses explicit named exports only — importing a non-exported internal symbol fails at compile time
**Plans**: TBD

### Phase 7: Tests, Examples & Publishing
**Goal**: The SDK has a complete vitest + msw test suite, example projects demonstrating real usage, and a changesets CI/CD pipeline that publishes to npm on release
**Depends on**: Phase 6
**Requirements**: TEST-01, TEST-02, TEST-03, PUB-01, PUB-02, PUB-03, PUB-04
**Success Criteria** (what must be TRUE):
  1. `pnpm test` passes with unit tests covering HTTP client, retry logic, and upload handler, plus integration tests for each module against msw-mocked API responses
  2. A consumer test project imports `@deepidv/server` from the built package (not source) and TypeScript resolves all types correctly under `moduleResolution: bundler`
  3. Running `node examples/node-basic/index.js`, `examples/express-app/app.js`, and `examples/nextjs-app/` each execute without runtime errors against the mocked API
  4. A GitHub Actions workflow runs tests on every PR and publishes to npm via `pnpm publish` (not `npm publish`) when a release is cut via changesets
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Infrastructure | 4/4 | Complete |  |
| 2. Presigned Upload Handler | 1/2 | In Progress|  |
| 3. Sessions Module | 0/TBD | Not started | - |
| 4. Document & Face Primitives | 0/TBD | Not started | - |
| 5. Identity Module | 0/TBD | Not started | - |
| 6. Public Entry Point | 0/TBD | Not started | - |
| 7. Tests, Examples & Publishing | 0/TBD | Not started | - |
