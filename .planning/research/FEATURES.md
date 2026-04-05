# Feature Landscape

**Domain:** Server-side identity verification SDK (TypeScript)
**Researched:** 2026-04-05
**Confidence note:** Web search and WebFetch were unavailable during this research session. All findings are drawn from training knowledge of Stripe Identity, Onfido, Jumio, Veriff, and Persona SDKs (knowledge cutoff August 2025). Confidence levels are assigned per finding based on how well-documented and stable each pattern is.

---

## Table Stakes

Features that users (developers) expect. Missing = product feels incomplete, developers switch or open GitHub issues on day one.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Typed response objects (no `any`) | Every modern SDK ships TypeScript types. Stripe, Onfido, Veriff all provide full types. Untyped results send devs to `console.log` hell | Low | Zero `any` is non-negotiable. Full discriminated unions on status fields. Confidence: HIGH |
| Named error classes with error codes | Stripe's pattern — `AuthenticationError`, `RateLimitError`, `ValidationError` — is what all post-2020 SDKs copied. Developers `instanceof`-check errors in catch blocks | Low–Med | At minimum: auth, rate limit, validation, network, timeout classes. Codes for programmatic handling. Confidence: HIGH |
| Retry on 429 and 5xx, never 4xx | Any network-facing SDK must handle transient failures. Retrying 400s causes infinite loops and wasted quota | Med | Exponential backoff + jitter. Max retries configurable. Never retry 4xx — those are caller bugs. Confidence: HIGH |
| Buffer/Uint8Array file input | Server-side code almost never has a `File` object. Devs read images from disk, receive them from multipart forms, or generate them in memory — they all produce Buffers | Low | Must accept `Buffer`, `Uint8Array` at minimum. Confidence: HIGH |
| JSDoc on every public method | Developers rely on IDE hover docs. Without JSDoc, every call requires a browser tab to the API reference | Low | All params, return types, throws, and examples documented. Confidence: HIGH |
| Session CRUD (create, retrieve, list) | Session-based workflows are the standard verification pattern. Every major provider (Stripe, Onfido, Veriff) centers their SDK around sessions | Med | Create with config, retrieve with typed result, list with pagination. Confidence: HIGH |
| Synchronous single-call document scan | Developers building server-to-server workflows (e.g., processing uploaded IDs) need a single `document.scan(imageBuffer)` → typed OCR result pattern, not a multi-step dance | Med | Returns structured fields: name, DOB, document number, expiry, country, document type. Confidence: HIGH |
| Face comparison (two images → match score) | The core use case for liveness/identity confirmation. Every KYC flow compares selfie to document photo. Jumio, Onfido, and Veriff all surface this as a first-class API | Med | Returns confidence score + pass/fail threshold. Accept two images independently. Confidence: HIGH |
| Runtime input validation with clear messages | Passing a string where a Buffer is expected should throw immediately with "expected Buffer, got string at param `frontImage`" not an unintelligible 400 from the API | Low–Med | Zod or equivalent. Validate before network call so devs see useful errors locally. Confidence: HIGH |
| Configurable timeout per request | Long-running ML inference (face comparison, document OCR) can exceed default HTTP timeouts. SDK must let callers set per-request or global timeouts | Low | AbortController-based. Per-request override + global default. Confidence: HIGH |
| API key authentication | x-api-key is the standard for server-to-server SDK auth. OAuth adds complexity with no benefit in a server-only context | Low | Set at client construction, sent on every request. Never exposed in error messages. Confidence: HIGH |
| File upload abstraction (hide presigned URL flow) | S3 presigned URL patterns require 3 HTTP calls (presign, PUT, process). Exposing this to SDK consumers is an implementation detail leak. Stripe hides S3 from their Identity SDK users | High | Consumer passes image data, SDK handles presign + PUT + process internally. Confidence: HIGH |

---

## Differentiators

Features that set the SDK apart. Not expected based on the current market, but add real developer value when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Multi-input type polymorphism (Buffer, base64, file path, stream, URL) | Most SDKs accept one or two input formats. Accepting all common formats means zero pre-processing code on the caller side. Onfido's Node SDK only accepts streams; devs write boilerplate constantly | Med | Accept `Buffer`, `Uint8Array`, `ReadableStream`, `string` (file path or base64), `Blob`. Detect and normalise internally. Confidence: MEDIUM |
| Parallel batch presigned uploads | When a call needs multiple images (face.compare needs two, identity.verify needs three), uploading sequentially wastes 2–3x the latency. Uploading in parallel with `Promise.all` is a meaningful perf win | Med | Orchestrate all presign + PUT calls in parallel before calling the processing endpoint. Confidence: MEDIUM |
| Typed event emitter for request lifecycle | Logging, APM, and debugging all benefit from request lifecycle hooks (`onRequest`, `onResponse`, `onRetry`, `onError`). Stripe's Node SDK uses this pattern via middleware. Onfido does not | Med | Typed events with full request/response context. Non-blocking (doesn't intercept return path). Confidence: MEDIUM |
| Orchestrated compound call (`identity.verify`) | Running document scan + face detect + face compare as three separate SDK calls is the norm. A single `identity.verify()` that orchestrates all three internally and returns a unified typed result is a DX win no competitor offers as a first-class SDK method | High | Runs `document.scan` + `face.detect` + `face.compare` in optimal order (parallelise where possible). Returns unified `IdentityVerificationResult`. Confidence: MEDIUM |
| Zero AWS SDK dependency with S3 compatibility | SDKs that require `@aws-sdk/client-s3` add 400KB+ to bundle and break edge runtimes. Using native `fetch` for S3 PUTs with presigned URLs means zero AWS SDK needed | Med | Native fetch for S3 PUT (presigned URL handles auth). Works on Cloudflare Workers, Vercel Edge, Deno Deploy. Confidence: HIGH (this is a genuine gap in most competitors) |
| Zod schema export for integration testing | Exporting the Zod schemas used internally lets consumers validate mock API responses in tests without duplicating type definitions. No major competitor does this | Low | Export `SessionSchema`, `DocumentResultSchema`, `FaceCompareResultSchema`, etc. as named exports | Confidence: LOW (novel, unproven demand) |
| Edge runtime compatibility (Cloudflare Workers, Deno, Bun) | Onfido's Node SDK uses `node:https` and breaks on Workers. Jumio's SDK requires Node. Supporting edge runtimes is a genuine differentiator for the growing segment of devs deploying to Workers/Deno Deploy | High | Zero Node-specific APIs. Use `fetch`, `Blob`, `ReadableStream`, `AbortController`, `crypto.subtle` only. Confidence: HIGH (real gap in market) |
| Age estimation as first-class method | Most competitors only expose liveness + document verification. Face-based age estimation is a useful signal for age-gating flows and is not surfaced as a standalone method by Stripe, Onfido, or Veriff | Med | `face.estimateAge(image)` → `{ estimatedAge: number; ageRange: [number, number]; gender?: string; confidence: number }`. Confidence: MEDIUM |
| Structured document OCR with typed fields | Most SDKs return raw OCR text or loosely typed objects. Returning a discriminated union by `documentType` (passport vs. driver's licence vs. ID card) with typed fields per type eliminates defensive null-checking on the caller side | Med | `DocumentScanResult` discriminated on `documentType`, each variant has different guaranteed fields. Confidence: MEDIUM |

---

## Anti-Features

Features to explicitly NOT build in v1. Including them creates bloat, maintenance burden, and scope creep without proportional user value.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| UI components / drop-in widgets | This is a server SDK. Mixing UI concerns produces a split-focus product that does neither well. Stripe separates `stripe-js` from the Node SDK explicitly for this reason | Defer to `@deepidv/web` package. Keep this package server-only and document that clearly |
| AWS SDK dependency for S3 | Adds 400KB+, breaks edge runtimes, creates a version pinning headache, and is unnecessary when presigned URLs handle S3 auth entirely | Use native `fetch` for S3 PUT with presigned URLs. Zero AWS SDK in this package |
| OAuth / token rotation | API key is sufficient for server-to-server auth. OAuth adds token refresh complexity, expiry edge cases, and a client credentials dance that benefits no server-to-server use case | x-api-key header on every request. Document clearly |
| Polling / webhook listener | Verification results in v1 are synchronous. Building a webhook listener or polling loop around async status is scope creep. When async sessions are added, it belongs in a separate integration layer | Document the synchronous response model. Defer session-polling to a future module |
| File type detection / conversion | Detecting JPEG vs PNG vs WebP and converting between them is image processing, not identity verification. Forces a native dependency (sharp, jimp) that breaks edge runtimes | Document accepted formats. Return a clear ValidationError if format is wrong. Do not convert |
| Retry on 4xx errors | Retrying auth errors, validation errors, or bad request errors will loop infinitely, waste API quota, and confuse callers. Every production SDK burns someone with this mistake | Hard-code: retry only 429 and 5xx. Never 4xx. Document explicitly |
| Mutable client state / shared singletons | A singleton client pattern causes subtle bugs in serverless environments where the runtime is reused across requests. Stripe explicitly warns against this. Onfido's SDK was bitten by this | Create new client instances per use. Constructor is cheap. No global state |
| Silent error swallowing | Catching errors internally and returning `null` or `undefined` instead of throwing forces callers to check every response for nullability. This is the anti-Stripe pattern | Always throw typed errors. Never return null to indicate failure |
| Automatic image resizing | Resizing images introduces a native dependency and makes the SDK responsible for image quality decisions that belong to the caller | Document maximum dimensions. Throw a ValidationError if dimensions or file size exceeds limits |
| Logging to stdout by default | SDKs that write to stdout pollute application logs. Stripe, Onfido, and every post-2020 major SDK use event emitters or pluggable loggers | Use the typed event emitter. Let the caller decide what to log |

---

## Feature Dependencies

```
API Key Auth
└── All methods (every request requires auth)

Error Classes
├── All methods (all throw typed errors)
├── Retry Logic (RateLimitError triggers retry)
└── Runtime Validation (ValidationError on bad inputs)

Runtime Validation (Zod)
└── All public methods (validate before network call)

Presigned URL Upload Handler
├── document.scan (uploads front/back images)
├── face.detect (uploads selfie image)
├── face.compare (uploads two images in parallel)
├── face.estimateAge (uploads image)
└── identity.verify (uploads 3 images, uses all above)

Session CRUD
└── sessions.create → sessions.retrieve → sessions.list → sessions.updateStatus

document.scan + face.detect + face.compare
└── identity.verify (orchestrates all three)

Typed Event Emitter
└── HTTP Client (emits on request/response/retry/error)

Parallel Batch Upload
└── face.compare (2 images in parallel)
└── identity.verify (3 images, max parallelism)
```

---

## MVP Recommendation

**Prioritise (ship in v1):**

1. Error classes — everything else depends on these being right. Hard to change without semver major.
2. HTTP client with auth, timeout, and retry — foundation for all methods.
3. Presigned URL upload handler — the trickiest piece; get it right before building on it.
4. `document.scan` — highest-value single synchronous call. Validates the upload abstraction.
5. `face.detect` and `face.compare` — complete the core verification surface.
6. `face.estimateAge` — low marginal cost once `face.detect` is done.
7. `identity.verify` — compound orchestration. Builds directly on the above.
8. Session CRUD (`create`, `retrieve`, `list`, `updateStatus`) — needed for multi-step workflows.
9. Typed event emitter — needed for observability in production use.
10. Full JSDoc + Zod validation — applies retroactively to all the above.

**Defer to v2:**
- Zod schema exports — useful but novel; validate demand before investing
- Workflow management (create/manage workflows) — explicitly out of scope per PROJECT.md
- Silent screening (PEP, sanctions) — future module per PROJECT.md
- Address and phone verification — future modules per PROJECT.md

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Table stakes features | HIGH | Patterns are stable and observable across 5+ major SDKs (Stripe, Onfido, Veriff, Jumio, Persona) in training data |
| Differentiator features | MEDIUM | Based on observed gaps in competitor SDKs; market could have moved since August 2025 |
| Anti-features | HIGH | These are well-documented SDK design mistakes with public post-mortems |
| Feature dependencies | HIGH | Dependencies are logical/structural, not empirical |
| MVP ordering | MEDIUM | Based on dependency graph + risk reasoning; product team should validate priority |

---

## Sources

- Stripe Identity and Stripe Node SDK documentation (training data, patterns verified across multiple versions)
- Onfido Node.js SDK GitHub and documentation (training data)
- Jumio API documentation (training data)
- Veriff SDK documentation and developer guides (training data)
- Persona API documentation (training data)
- Confidence: MEDIUM overall (web verification unavailable for this session; patterns are stable and cross-confirmed across multiple sources in training data)
