# Requirements: deepidv Server SDK

**Defined:** 2026-04-05
**Core Value:** Developers pass images in and get typed verification results back — all presigned URL orchestration, retry logic, and error handling is invisible.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Monorepo & Build

- [x] **BUILD-01**: pnpm monorepo with `@deepidv/core` (internal) and `@deepidv/server` (public) packages
- [x] **BUILD-02**: TypeScript strict mode, ES2022 target, path aliases via `tsconfig.base.json`
- [x] **BUILD-03**: tsup builds dual ESM + CJS output with `.d.ts` generation per package
- [x] **BUILD-04**: Package `exports` map correctly exposes `.mjs`, `.cjs`, and `.d.ts` for all entry points
- [x] **BUILD-05**: ESLint + Prettier configured at workspace root, shared by all packages

### HTTP Client & Auth

- [x] **HTTP-01**: Base HTTP client using native `fetch` with configurable base URL, JSON parsing, content-type handling
- [x] **HTTP-02**: API key authentication via `x-api-key` header on every request
- [x] **HTTP-03**: Configurable timeout per request using `AbortController` with global default override
- [x] **HTTP-04**: Retry logic with exponential backoff + jitter on 429 and 5xx only, never 4xx, configurable max retries

### Error Handling

- [x] **ERR-01**: `DeepIDVError` base class with status code, error code, and human-readable message
- [x] **ERR-02**: `AuthenticationError` (401) with API key redaction in error output
- [x] **ERR-03**: `RateLimitError` (429) with retry-after extraction
- [x] **ERR-04**: `ValidationError` (400) with field-level detail from Zod
- [x] **ERR-05**: `NetworkError` for connection failures and `TimeoutError` for request timeouts
- [x] **ERR-06**: All errors chain `cause` for stack trace preservation

### Input Validation

- [x] **VAL-01**: Zod schemas validate all public method inputs before network calls
- [x] **VAL-02**: Clear error messages with param name and expected type (e.g., "expected Buffer, got string at param `image`")
- [x] **VAL-03**: Zod schemas infer TypeScript types (single source of truth for runtime + compile-time)

### File Uploads

- [x] **UPL-01**: Presigned URL upload handler: POST `/v1/uploads/presign` → PUT to S3 → return `fileKey`
- [x] **UPL-02**: Accept `Buffer`, `Uint8Array`, `ReadableStream`, file path string, and base64 string as file inputs
- [x] **UPL-03**: Content-type detection from input (JPEG, PNG, WebP) and alignment with presign request
- [x] **UPL-04**: Parallel batch presigned uploads for multi-file operations via `Promise.all`
- [x] **UPL-05**: Separate configurable timeout for S3 uploads (independent of API request timeout)
- [x] **UPL-06**: ReadableStream materialization before upload (prevent double-read zero-byte bug)
- [x] **UPL-07**: Zero AWS SDK dependency — all S3 interaction via native `fetch` with presigned URLs

### Typed Event Emitter

- [x] **EVT-01**: Typed event emitter for request lifecycle: request start, upload progress, response received, retry, error
- [x] **EVT-02**: Non-blocking (does not intercept return path), allows caller-controlled logging/APM

### Sessions Module

- [x] **SESS-01**: `client.sessions.create()` — create hosted verification session with typed input/output
- [x] **SESS-02**: `client.sessions.retrieve()` — retrieve full session with all analysis data and presigned resource URLs
- [x] **SESS-03**: `client.sessions.list()` — list sessions with pagination (limit, offset) and status filter
- [x] **SESS-04**: `client.sessions.updateStatus()` — update session status (VERIFIED, REJECTED, VOIDED)

### Document Module

- [x] **DOC-01**: `client.document.scan()` — upload document image via presigned URL flow, return structured OCR data
- [x] **DOC-02**: Typed `DocumentScanResult` with fullName, dateOfBirth, documentNumber, expirationDate, issuingCountry, confidence, rawFields
- [x] **DOC-03**: Optional `documentType` parameter (passport, drivers_license, national_id, auto)

### Face Module

- [x] **FACE-01**: `client.face.detect()` — upload image, return face detection confidence + bounding box + landmarks
- [x] **FACE-02**: `client.face.compare()` — upload two images in parallel, return match confidence + threshold + pass/fail
- [x] **FACE-03**: `client.face.estimateAge()` — upload image, return estimated age, age range, gender, confidence
- [x] **FACE-04**: All face methods use the presigned URL upload flow

### Identity Module

- [x] **IDV-01**: `client.identity.verify()` — orchestrated compound call: document.scan + face.detect + face.compare
- [x] **IDV-02**: Upload document + face images in parallel where possible
- [x] **IDV-03**: Return unified `IdentityVerificationResult` with document, faceDetection, faceMatch, overallConfidence, verified boolean

### Public API Surface

- [x] **API-01**: `DeepIDV` client class as main entry point, takes config (apiKey, baseUrl, timeout, retries)
- [x] **API-02**: Grouped module access: `client.sessions`, `client.document`, `client.face`, `client.identity`
- [x] **API-03**: Full JSDoc on every public method, parameter, and return type
- [x] **API-04**: Zero `any` in the entire codebase
- [x] **API-05**: Explicit named exports (no wildcard re-exports)

### Runtime Compatibility

- [x] **COMPAT-01**: Works on Node 18+ without polyfills
- [x] **COMPAT-02**: Works on Deno and Bun using native web APIs
- [x] **COMPAT-03**: Works on Cloudflare Workers and edge runtimes (no Node-specific APIs in core)
- [x] **COMPAT-04**: File path input uses conditional runtime detection; edge runtimes must pass Buffer/Uint8Array

### Testing & Publishing

- [x] **TEST-01**: vitest + msw test suite with unit tests for HTTP client, retry logic, upload handler
- [x] **TEST-02**: Integration tests for each module's request/response mapping against mocked API
- [x] **TEST-03**: Consumer declaration-file validation (import from built package in a test project)
- [x] **PUB-01**: changesets for versioning and changelogs
- [x] **PUB-02**: npm publish config with `"access": "public"` on `@deepidv/server`
- [x] **PUB-03**: GitHub Actions: test on PR, publish to npm on release
- [x] **PUB-04**: Example projects: node-basic, express-app, nextjs-app

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Schema Exports

- **SCHEMA-01**: Export Zod schemas for consumer integration testing (e.g., `SessionSchema`, `DocumentResultSchema`)

### Session-Based Services

- **SESSION-01**: `SessionBase` class with `createSession`, `submitData`, `getResult`, `waitForResult` pattern
- **SESSION-02**: Address verification module (`client.address`)
- **SESSION-03**: Phone verification module (`client.phone`)

### Additional Modules

- **FIN-01**: Bank statement analysis module (`client.financial`)
- **WF-01**: Workflow management module (`client.workflows`)
- **SCR-01**: Silent screening module (`client.screening`) — PEP, sanctions, adverse media, title check

### Advanced Features

- **ADV-01**: Document fraud check (`client.document.fraudCheck()`)
- **ADV-02**: Deepfake detection (`client.face.deepfakeCheck()`)
- **ADV-03**: Face liveness session (`client.face.liveness()`)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| UI components / drop-in widgets | Server SDK only. Defer to `@deepidv/web` package |
| iOS/Android native SDKs | Separate packages (`deepidvSDK`, `me.deepidv.sdk`) |
| AWS SDK dependency | Presigned URLs handle S3 auth; zero AWS SDK in this package |
| OAuth / token rotation | x-api-key sufficient for server-to-server auth |
| Polling / webhook listener | v1 services are synchronous; defer to future session-based module |
| File type detection / conversion | Not image processing. Throw ValidationError if format is wrong |
| Image resizing | Caller responsibility. Document maximum dimensions |
| Mutable client state / singletons | New instance per use; constructor is cheap |
| Logging to stdout by default | Use typed event emitter; caller decides what to log |
| Silent error swallowing | Always throw typed errors; never return null for failure |
| Retry on 4xx | Never — 4xx are caller bugs, not transient failures |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUILD-01 | Phase 1 | Complete |
| BUILD-02 | Phase 1 | Complete |
| BUILD-03 | Phase 1 | Complete |
| BUILD-04 | Phase 1 | Complete |
| BUILD-05 | Phase 1 | Complete |
| HTTP-01 | Phase 1 | Complete |
| HTTP-02 | Phase 1 | Complete |
| HTTP-03 | Phase 1 | Complete |
| HTTP-04 | Phase 1 | Complete |
| ERR-01 | Phase 1 | Complete |
| ERR-02 | Phase 1 | Complete |
| ERR-03 | Phase 1 | Complete |
| ERR-04 | Phase 1 | Complete |
| ERR-05 | Phase 1 | Complete |
| ERR-06 | Phase 1 | Complete |
| EVT-01 | Phase 1 | Complete |
| EVT-02 | Phase 1 | Complete |
| COMPAT-01 | Phase 1 | Complete |
| COMPAT-02 | Phase 1 | Complete |
| COMPAT-03 | Phase 1 | Complete |
| COMPAT-04 | Phase 1 | Complete |
| VAL-01 | Phase 2 | Complete |
| VAL-02 | Phase 2 | Complete |
| VAL-03 | Phase 2 | Complete |
| UPL-01 | Phase 2 | Complete |
| UPL-02 | Phase 2 | Complete |
| UPL-03 | Phase 2 | Complete |
| UPL-04 | Phase 2 | Complete |
| UPL-05 | Phase 2 | Complete |
| UPL-06 | Phase 2 | Complete |
| UPL-07 | Phase 2 | Complete |
| SESS-01 | Phase 3 | Complete |
| SESS-02 | Phase 3 | Complete |
| SESS-03 | Phase 3 | Complete |
| SESS-04 | Phase 3 | Complete |
| DOC-01 | Phase 4 | Complete |
| DOC-02 | Phase 4 | Complete |
| DOC-03 | Phase 4 | Complete |
| FACE-01 | Phase 4 | Complete |
| FACE-02 | Phase 4 | Complete |
| FACE-03 | Phase 4 | Complete |
| FACE-04 | Phase 4 | Complete |
| IDV-01 | Phase 5 | Complete |
| IDV-02 | Phase 5 | Complete |
| IDV-03 | Phase 5 | Complete |
| API-01 | Phase 6 | Complete |
| API-02 | Phase 6 | Complete |
| API-03 | Phase 6 | Complete |
| API-04 | Phase 6 | Complete |
| API-05 | Phase 6 | Complete |
| TEST-01 | Phase 7 | Complete |
| TEST-02 | Phase 7 | Complete |
| TEST-03 | Phase 7 | Complete |
| PUB-01 | Phase 7 | Complete |
| PUB-02 | Phase 7 | Complete |
| PUB-03 | Phase 7 | Complete |
| PUB-04 | Phase 7 | Complete |

**Coverage:**
- v1 requirements: 57 total
- Mapped to phases: 57
- Unmapped: 0

**Note:** The original coverage count of 46 in REQUIREMENTS.md was a miscalculation during initialization. The actual count is 57 requirements across 14 categories.

---
*Requirements defined: 2026-04-05*
*Last updated: 2026-04-05 — traceability populated after roadmap creation*
