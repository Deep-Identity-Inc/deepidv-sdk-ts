# Phase 4: Document & Face Primitives - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Four synchronous service methods — `document.scan`, `face.detect`, `face.compare`, `face.estimateAge` — that accept image inputs (FileInput), run the presigned upload flow internally via FileUploader, call processing endpoints via HttpClient, and return typed structured results. No orchestrated/compound calls (that's Phase 5). No public entry point wiring (that's Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Upload-to-Result Orchestration
- **D-01:** Methods accept `FileInput` directly (Buffer/Uint8Array/ReadableStream/string). The SDK handles presign + S3 upload + processing endpoint call internally. Developers never see fileKeys or presigned URLs.
- **D-02:** `face.compare()` uses a single batch presign call (`count: 2`) with parallel S3 PUTs via `Promise.all`. Matches FileUploader's existing batch pattern (UPL-04).
- **D-03:** Processing endpoint calls (POST /v1/document/scan, /v1/face/detect, etc.) go through `HttpClient` — gets auth headers, retry on 5xx, and error mapping for free.

### Constructor Dependencies
- **D-04:** `Document` and `Face` classes take two constructor params: `constructor(client: HttpClient, uploader: FileUploader)`. Explicit, testable — mock either independently. Phase 6's DeepIDV class wires these.
- **D-05:** No shared base class or abstract UploadServiceBase. The upload-then-process flow is 3-5 lines — not complex enough to warrant abstraction. Each class is self-contained.

### Response Schema Strictness
- **D-06:** API response parsing uses `z.object().strip()` — validate known fields, silently drop unknown ones. Forward-compatible when the API adds fields, while preserving strict types for SDK consumers.
- **D-07:** Response schema parsing happens inside each service method (e.g., `DocumentScanResultSchema.parse(rawResponse)` after `client.post()`). Consistent with input validation pattern from Sessions. No changes to HttpClient/core.
- **D-08:** Full-depth Zod schemas for all response types, matching the build guide's type definitions exactly. `z.infer<>` remains the single type source (carried from D-04/Phase 3, D-11/Phase 2).

### Error Surface
- **D-09:** Domain errors from processing endpoints (e.g., "no face detected", "document unreadable") surface as standard `DeepIDVError` with status code and error code from the API response. No new error subclasses — the API's error codes distinguish cases.
- **D-10:** If presigned upload fails after FileUploader's internal retries (D-08/Phase 2), the `NetworkError` or `TimeoutError` bubbles up as-is. No re-presign retry at the service method level — the URL may have expired.

### Carried Forward (Not Re-Asked)
- Class with constructor injection pattern (D-01/D-02 from Phase 3)
- Flat file layout: `document.ts` + `document.types.ts`, `face.ts` + `face.types.ts` (D-07/D-09 from Phase 3)
- Zod schemas co-located with module (D-10 from Phase 2)
- `z.infer<>` as single type source (D-11 from Phase 2)
- Zod-to-ValidationError mapping for input validation (D-12 from Phase 2)

### Claude's Discretion
- None — all areas discussed and decided.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Build & Architecture
- `deepidv-sdk-build-guide.md` — Full type definitions for document.scan (lines 424-457), face.detect (lines 463-495), face.compare (lines 499-524), face.estimateAge (lines 528-555). API endpoints, input/output shapes. Primary implementation reference.

### Project & Requirements
- `.planning/PROJECT.md` — Project constraints (zero AWS SDK, minimal deps, runtime compat), grouped module API pattern, presigned upload flow description.
- `.planning/REQUIREMENTS.md` — Phase 4 requirements: DOC-01 through DOC-03 (document module), FACE-01 through FACE-04 (face module).
- `.planning/ROADMAP.md` — Phase 4 success criteria and dependency chain.

### Prior Phase Context
- `.planning/phases/02-presigned-upload-handler/02-CONTEXT.md` — FileUploader design: FileInput type (D-02), batch presign (UPL-04), S3 PUT retry (D-08), Zod patterns (D-10/D-11/D-12).
- `.planning/phases/03-sessions-module/03-CONTEXT.md` — Module pattern template: class with constructor injection (D-01/D-02), flat file layout (D-07/D-08/D-09), full-depth Zod schemas (D-03/D-04).

### Existing Code
- `packages/core/src/uploader.ts` — FileUploader class, FileInput type, batch upload support.
- `packages/core/src/client.ts` — HttpClient with get/post methods, auth, retry, timeout.
- `packages/server/src/sessions.ts` — Template for module class structure and validation pattern.
- `packages/server/src/sessions.types.ts` — Template for Zod schema + type co-location.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FileUploader` (`packages/core/src/uploader.ts`) — Handles presign + S3 PUT flow. Supports batch uploads with `count: N`. Returns fileKeys.
- `HttpClient` (`packages/core/src/client.ts`) — Has `post` method with auth, retry, timeout, event emitting. Used for processing endpoint calls.
- `Sessions` class (`packages/server/src/sessions.ts`) — Template for class structure: constructor injection, Zod validate-then-call pattern, JSDoc style.
- `mapZodError` (`packages/core/src/uploader.ts`) — Maps ZodError to ValidationError. Already exported from core.
- `ValidationError`, `DeepIDVError`, `NetworkError`, `TimeoutError` (`packages/core/src/errors.ts`) — All error types needed are already defined.

### Established Patterns
- Input validation: `Schema.parse(input)` in try/catch, map ZodError to ValidationError (Sessions pattern).
- Module files: `module.ts` (class) + `module.types.ts` (Zod schemas + inferred types).
- Constructor injection: `constructor(private readonly client: HttpClient)` — extended to include `uploader: FileUploader`.
- `z.infer<typeof Schema>` as the only type definition mechanism.

### Integration Points
- `packages/server/src/document.ts` — New file: `Document` class with `scan()` method
- `packages/server/src/document.types.ts` — New file: Zod schemas + inferred types for document
- `packages/server/src/face.ts` — New file: `Face` class with `detect()`, `compare()`, `estimateAge()` methods
- `packages/server/src/face.types.ts` — New file: Zod schemas + inferred types for face
- `packages/server/src/index.ts` — Export Document, Face classes and all public types

</code_context>

<specifics>
## Specific Ideas

- Each method follows the same 3-step flow: (1) Zod-validate input, (2) FileUploader.upload() to get fileKey(s), (3) HttpClient.post() to processing endpoint with fileKey(s), (4) Zod-parse response with .strip()
- face.compare() uploads two images: uses batch presign with count:2, parallel S3 PUTs, then POST /v1/face/compare with both fileKeys
- API endpoints from build guide: POST /v1/document/scan, POST /v1/face/detect, POST /v1/face/compare, POST /v1/face/estimate-age
- document.scan() has optional documentType param defaulting to 'auto'

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-document-face-primitives*
*Context gathered: 2026-04-05*
