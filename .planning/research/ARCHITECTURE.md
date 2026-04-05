# Architecture Patterns

**Domain:** TypeScript SDK wrapping a REST identity-verification API
**Researched:** 2026-04-05
**Confidence:** HIGH — primary source is the repo's own `deepidv-sdk-build-guide.md`, which specifies every architectural decision already made by the team

---

## Recommended Architecture

### Package Topology (Monorepo)

```
deepidv-sdk/                       ← pnpm workspace root
├── packages/
│   ├── core/    (@deepidv/core)   ← private internals; never installed by end users
│   └── server/  (@deepidv/server) ← public API; what developers npm install
├── examples/
├── tsconfig.base.json
└── pnpm-workspace.yaml
```

`@deepidv/core` is a dependency of `@deepidv/server`. Future packages
(`@deepidv/web`, `@deepidv/react`) will also depend on `@deepidv/core`,
which is why the split exists.

---

### Component Map

```
@deepidv/core
├── config.ts          Config types + defaults (DeepIDVConfig)
├── auth.ts            Auth middleware (x-api-key header injection)
├── client.ts          HTTP client (native fetch wrapper)
├── errors.ts          Error class hierarchy
├── retry.ts           Exponential backoff + jitter engine
├── uploader.ts        Presigned URL upload handler (FileUploader)
├── events.ts          Typed event emitter (~30 lines, no deps)
└── index.ts           Core public exports

@deepidv/server
├── deepidv.ts         Main entry point class (DeepIDV)
├── modules/
│   ├── sessions.ts    Hosted session CRUD
│   ├── document.ts    Document primitives (scan)
│   ├── face.ts        Face primitives (detect, compare, estimateAge)
│   └── identity.ts    Orchestrated verification (verify)
├── types/
│   ├── common.types.ts
│   ├── sessions.types.ts
│   ├── document.types.ts
│   ├── face.types.ts
│   └── identity.types.ts
└── index.ts           Package public exports
```

---

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `DeepIDVConfig` (config.ts) | Holds apiKey, baseUrl, timeout, retries, version; provides validated defaults | Consumed by HttpClient, FileUploader, all modules |
| `AuthMiddleware` (auth.ts) | Attaches `x-api-key` header to every outbound request | Consumed by HttpClient |
| `HttpClient` (client.ts) | Native `fetch` wrapper: base URL resolution, JSON serialisation/deserialisation, response status checking, timeout via `AbortController` | Uses AuthMiddleware, RetryEngine, ErrorFactory; called by all modules |
| `ErrorFactory` / hierarchy (errors.ts) | Maps HTTP status codes to typed error subclasses; carries status code, error code, human message | Consumed by HttpClient; surfaced to end user |
| `RetryEngine` (retry.ts) | Exponential backoff with jitter; retries only 429 and 5xx; never retries 4xx | Invoked by HttpClient per-attempt |
| `FileUploader` (uploader.ts) | Accepts Buffer / Uint8Array / ReadableStream / file-path / base64; requests presigned URL; PUTs to S3; returns fileKey; supports batch parallel uploads | Uses HttpClient (for presign call); uses native `fetch` directly (for S3 PUT); called by document.ts, face.ts, identity.ts |
| `EventEmitter` (events.ts) | Typed lifecycle events: request-start, upload-progress, response-received, error | Subscribed to by HttpClient and FileUploader; exposed optionally to end user |
| `DeepIDV` (deepidv.ts) | Public client class; takes config; instantiates HttpClient + FileUploader + all module groups as properties | Owns all module instances; entry point for developers |
| `SessionsModule` (sessions.ts) | CRUD for hosted verification sessions; pure HTTP, no file uploads | Uses HttpClient |
| `DocumentModule` (document.ts) | `scan()` — presigned upload + OCR endpoint call | Uses FileUploader + HttpClient |
| `FaceModule` (face.ts) | `detect()`, `compare()` (parallel dual upload), `estimateAge()` | Uses FileUploader + HttpClient |
| `IdentityModule` (identity.ts) | `verify()` — orchestrates document.scan + face.detect + face.compare via single API endpoint | Uses FileUploader + HttpClient |

---

## Data Flow

### Simple Synchronous Call (sessions.create, document.scan, face.detect)

```
Developer code
  │
  ▼
DeepIDV (deepidv.ts)
  │  exposes module as property (client.sessions, client.document, etc.)
  ▼
Module (sessions.ts / document.ts / face.ts)
  │  validates input via Zod schema
  │  emits "request-start" event
  ▼
[FileUploader — only for file-bearing calls]
  │
  ├─► POST /v1/uploads/presign  ──► deepidv API  ──► { uploadUrl, fileKey }
  │
  └─► PUT <presigned S3 URL>   ──► S3 directly   ──► 200 OK
         (raw bytes, native fetch)
  │
  │  returns fileKey to module
  ▼
HttpClient (client.ts)
  │  builds Request: base URL + path + auth header + JSON body
  │  applies AbortController timeout
  │  passes through RetryEngine if attempt fails with 429 / 5xx
  ▼
deepidv API  (https://api.deepidv.com)
  │
  ▼
HttpClient
  │  checks status, parses JSON
  │  on error: maps to typed error class, re-throws
  │  emits "response-received" event
  ▼
Module
  │  returns typed result object
  ▼
Developer code
```

### Orchestrated Call (identity.verify)

```
Developer code
  │
  ▼
IdentityModule.verify({ documentImage, faceImage })
  │
  ├─► FileUploader.uploadBatch([documentImage, faceImage])
  │     POST /v1/uploads/presign  (count: 2)
  │     PUT <url1> + PUT <url2>   (Promise.all — parallel)
  │     returns [fileKey1, fileKey2]
  │
  ▼
HttpClient → POST /v1/identity/verify  { documentFileKey, faceFileKey }
  │
  ▼
deepidv API  (internally: document OCR + face detect + face compare)
  │
  ▼
HttpClient → typed combined result
  ▼
Developer code
```

### Error Path

```
HttpClient receives non-2xx response
  │
  ├── 400 → ValidationError (never retried)
  ├── 401 → AuthenticationError (never retried)
  ├── 429 → RateLimitError → RetryEngine (exponential backoff + jitter)
  ├── 5xx → DeepIDVError  → RetryEngine (exponential backoff + jitter)
  └── Network failure → NetworkError (optionally retried)

AbortController fires → TimeoutError (not retried)

All errors extend DeepIDVError base class:
  .statusCode  .errorCode  .message  .requestId
```

---

## Patterns to Follow

### Pattern 1: Thin Module — Fat Core

Modules (sessions.ts, document.ts, face.ts, identity.ts) contain only:
1. Zod schema for input validation
2. Call to FileUploader (if file-bearing)
3. Single call to HttpClient
4. Return of typed result

All cross-cutting concerns (auth, retry, timeout, error mapping, events) live exclusively in `@deepidv/core`. Modules never touch `fetch` directly.

```typescript
// document.ts — illustrative pattern
export class DocumentModule {
  constructor(
    private readonly http: HttpClient,
    private readonly uploader: FileUploader,
  ) {}

  async scan(input: DocumentScanInput): Promise<DocumentScanResult> {
    const validated = DocumentScanInputSchema.parse(input);
    const { fileKey } = await this.uploader.upload(validated.image, 'image/jpeg');
    return this.http.post<DocumentScanResult>('/v1/document/scan', { fileKey });
  }
}
```

### Pattern 2: FileUploader Abstracts All Input Types

Callers pass any of: `Buffer | Uint8Array | ReadableStream | string` (file path or base64). FileUploader normalises to `Uint8Array` before the S3 PUT. Runtime detection gates the `fs.readFile` path — edge runtimes never reach that branch.

```typescript
async function normaliseInput(input: ImageInput): Promise<Uint8Array> {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (input instanceof ReadableStream) return streamToUint8Array(input);
  if (typeof input === 'string') {
    if (isBase64(input)) return base64ToUint8Array(input);
    // file path — Node/Deno/Bun only; detected at runtime
    return readFileAsUint8Array(input);
  }
  throw new ValidationError('Unsupported image input type');
}
```

### Pattern 3: Batch Presigning for Multi-File Ops

`face.compare` and `identity.verify` need two images. Request both presigned URLs in one API call (`count: 2`), then upload in parallel:

```typescript
const [{ uploadUrl: url1, fileKey: key1 }, { uploadUrl: url2, fileKey: key2 }]
  = await this.uploader.uploadBatch([sourceImage, targetImage]);
// Both PUTs run via Promise.all internally
```

### Pattern 4: Typed Error Hierarchy

All errors extend a single `DeepIDVError` base. Developers can catch broadly or narrowly:

```typescript
class DeepIDVError extends Error {
  statusCode: number;
  errorCode: string;
  requestId?: string;
}
class AuthenticationError extends DeepIDVError {}   // 401
class RateLimitError extends DeepIDVError {}        // 429 — retried
class ValidationError extends DeepIDVError {}       // 400 — never retried
class NetworkError extends DeepIDVError {}          // connection failure
class TimeoutError extends DeepIDVError {}          // AbortController fired
```

### Pattern 5: RetryEngine — Only 429 and 5xx

```
shouldRetry(statusCode):
  if 429 or 5xx → YES
  otherwise      → NO (includes all 4xx, network errors by default)

backoffMs(attempt, baseMs = 500, maxMs = 30_000):
  delay = min(baseMs * 2^attempt, maxMs)
  jitter = random(0, delay * 0.2)
  return delay + jitter
```

### Pattern 6: Grouped Namespace API (not flat)

```typescript
// DO: grouped, discoverable
client.face.detect()
client.face.compare()
client.face.estimateAge()

// DON'T: flat, loses grouping signal
client.detectFace()
client.compareFaces()
client.estimateFaceAge()
```

Module instances are set as properties on the `DeepIDV` class constructor. This enables autocomplete to surface groups, matching the API's own URL structure (`/v1/face/...`).

### Pattern 7: Config Defaults with Optional Overrides

```typescript
interface DeepIDVConfig {
  apiKey: string;           // required
  baseUrl?: string;         // default: 'https://api.deepidv.com'
  timeout?: number;         // default: 30_000 ms
  retries?: number;         // default: 3
  version?: string;         // default: 'v1'
}
```

Validated at construction time (fail fast on missing apiKey), not per-request.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Node-Specific APIs in Core

**What:** Using `require('fs')`, `require('crypto')`, `require('http')`, or `Buffer` constructor directly in `@deepidv/core`.
**Why bad:** Breaks Cloudflare Workers, Deno, and edge runtimes — the environments where security-sensitive SDKs are most commonly deployed.
**Instead:** Use `fetch`, `Blob`, `ReadableStream`, `crypto.subtle`, `AbortController` throughout. Gate `fs.readFile` behind a runtime detection check in `uploader.ts`, and document that file-path inputs require Node/Deno/Bun.

### Anti-Pattern 2: Retrying 4xx Errors

**What:** Including 400, 401, 403, 404, 422 in the retry-eligible set.
**Why bad:** 4xx errors reflect bad input or auth failures — retrying them wastes quota, delays error surfacing, and can trigger rate limiting.
**Instead:** Retry only 429 (rate limit) and 5xx (server error). Throw immediately on all 4xx.

### Anti-Pattern 3: Modules Calling fetch Directly

**What:** Individual modules building and executing fetch calls without going through HttpClient.
**Why bad:** Auth headers, retry logic, timeout, and event emission are bypassed. Duplicate code. Silent failures.
**Instead:** All HTTP (including the S3 PUT) flows through a deliberate boundary: processing calls through HttpClient; S3 PUTs isolated to FileUploader which manages its own fetch with no auth header.

### Anti-Pattern 4: Mixing Public and Internal Exports

**What:** Exporting internal helpers (normaliseInput, buildPresignRequest, etc.) from `@deepidv/server`'s index.ts.
**Why bad:** Locks internal implementation details into the public API surface, making refactoring a semver-breaking change.
**Instead:** `@deepidv/core/index.ts` exports only what `@deepidv/server` needs. `@deepidv/server/index.ts` exports only what developers need (`DeepIDV` class, error types, public interfaces). Never re-export core internals through server.

### Anti-Pattern 5: Eager File Reading

**What:** Reading file bytes at the point the developer passes a file path, before validation.
**Why bad:** Fails early with a filesystem error rather than a typed SDK error. Hides intent.
**Instead:** Validate input shape first (Zod), then resolve the image bytes inside FileUploader as part of the upload flow. If reading fails, throw `ValidationError` with a clear message.

### Anti-Pattern 6: Single Presign + Single Upload Per File in Multi-File Ops

**What:** For `face.compare`, making two sequential presign calls and two sequential PUTs.
**Why bad:** Doubles latency for no reason. Face compare and identity.verify are already the slowest calls.
**Instead:** Request `count: 2` in one presign call, then `Promise.all` both PUTs.

---

## Build Order (Phase Dependencies)

The build order is dictated by dependency: nothing in `@deepidv/server` can be built before the `@deepidv/core` piece it depends on.

```
Phase 1 — Core Infrastructure (no prior dependencies)
  ├── config.ts         (types only, no deps)
  ├── errors.ts         (types only, no deps)
  ├── auth.ts           (depends on config.ts)
  ├── retry.ts          (depends on errors.ts)
  ├── client.ts         (depends on config, auth, retry, errors)
  └── events.ts         (standalone, ~30 lines)

Phase 2 — Upload Infrastructure (depends on Phase 1)
  └── uploader.ts       (depends on client.ts for presign call, errors.ts)

Phase 3 — Sessions Module (depends on Phase 1 only, no file uploads)
  ├── types/sessions.types.ts
  └── modules/sessions.ts    (uses HttpClient only)

  ← This is the first end-to-end path: proves HTTP client + auth + types
  ← Good phase boundary for early integration testing

Phase 4 — Document and Face Primitives (depends on Phase 2)
  ├── types/document.types.ts
  ├── types/face.types.ts
  ├── modules/document.ts    (uses FileUploader + HttpClient)
  └── modules/face.ts        (uses FileUploader + HttpClient, parallel upload for compare)

Phase 5 — Orchestrated Module (depends on Phase 4)
  ├── types/identity.types.ts
  └── modules/identity.ts    (uses FileUploader + HttpClient for compound call)

Phase 6 — DeepIDV Entry Point (depends on Phases 3–5)
  └── deepidv.ts             (assembles all modules, exposes client API)

Phase 7 — Testing, Examples, Publishing (depends on Phase 6)
  ├── vitest + msw test suite
  ├── examples/
  └── changesets + npm publish pipeline
```

The sessions module (Phase 3) intentionally precedes file-bearing modules (Phase 4) because it proves the HTTP client, auth, and typing patterns end-to-end with the simplest possible code — no file handling complexity. A working `client.sessions.create()` confirms the plumbing before adding the presigned URL layer.

---

## Scalability Considerations

This SDK runs on the developer's server — it does not scale with end-user traffic directly. Scalability concerns are about the SDK's own resource usage per server instance.

| Concern | Behaviour | Design Decision |
|---------|-----------|-----------------|
| Concurrent uploads | Each call is independent; no global connection pool | Native fetch handles concurrency at runtime level |
| Memory — large images | FileUploader streams where possible; no full-copy into memory for ReadableStream inputs | Streaming path avoids doubling image memory |
| Rate limit handling | RetryEngine backs off on 429 with jitter to spread retries across concurrent callers | Jitter prevents thundering herd |
| Timeout propagation | AbortController per request; timeout configurable at client construction | No request hangs indefinitely |
| Edge runtime bundle size | Zero non-zod deps; tree-shakeable tsup output; dual ESM + CJS | Cloudflare Workers 1MB limit is not a concern |
| Future concurrency | `identity.verify` batches two presign URLs and uploads in parallel; pattern extends to N files for future batch ops | `Promise.all` pattern is established from the start |

---

## Module Grouping: Namespaced vs Flat

**Decision: Namespaced (grouped).** Already decided in the build guide; this section documents why.

```typescript
client.face.detect()      // grouped
client.face.compare()
client.face.estimateAge()
// vs.
client.detectFace()       // flat — worse autocomplete signal
```

Reasons:
1. **Autocomplete discoverability** — typing `client.face.` shows only the three face methods, not all 10+ SDK methods.
2. **Mirrors the API URL structure** — `/v1/face/detect`, `/v1/face/compare`, `/v1/face/estimate-age` map directly to `client.face.detect/compare/estimateAge`.
3. **Scales cleanly** — adding `client.face.deepfakeCheck()` in a future phase is additive and obvious; adding `client.detectFaceDeepfake()` to a flat namespace is awkward.
4. **Matches industry precedent** — Stripe uses `stripe.customers.create()`, Twilio uses `client.messages.create()`.

---

## Sources

- `deepidv-sdk-build-guide.md` in repo root — primary authoritative source (HIGH confidence)
- `.planning/PROJECT.md` — cross-referenced for constraints and requirements (HIGH confidence)
- Industry precedent: Stripe Node SDK (github.com/stripe/stripe-node), Twilio Node SDK (github.com/twilio/twilio-node) — namespace patterns and thin-module design are consistent with both (MEDIUM confidence, training knowledge)
