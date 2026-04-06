# Phase 5: Identity Module - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

A single orchestrated method — `client.identity.verify()` — that uploads document + face images in parallel via batch presign (count:2), calls `POST /v1/identity/verify` with both fileKeys, and returns a unified `IdentityVerificationResult`. This is the SDK's only compound synchronous service. No new error subclasses, no client-side orchestration of multiple API calls.

</domain>

<decisions>
## Implementation Decisions

### API Call Pattern
- **D-01:** Single API endpoint — `verify()` uploads both images in parallel (batch presign, count:2), then makes one `POST /v1/identity/verify` with `documentFileKey`, `faceFileKey`, and optional `documentType`. Server handles scan+detect+compare internally. SDK stays thin.
- **D-02:** Upload pattern matches `face.compare()` exactly: `uploader.upload([documentImage, faceImage])` → two fileKeys via batch presign + parallel S3 PUTs.

### Response Type Composition
- **D-03:** Independent Zod schemas in `identity.types.ts` — do NOT reuse Phase 4 types (`DocumentScanResult`, `FaceDetectResult`, `FaceCompareResult`). The `/v1/identity/verify` response has different nested shapes (e.g., `faceDetection` is simpler than standalone `FaceDetectResult`). Define schemas matching the build guide exactly.
- **D-04:** All sub-result fields (`document`, `faceDetection`, `faceMatch`) are required — not optional. The API always returns the full shape on 2xx.

### Error Surface
- **D-05:** Trust the API for partial failures. If the API returns 200 with `verified: false`, parse result as-is (sub-results always populated). If 4xx/5xx, existing error hierarchy handles it (`DeepIDVError`, `AuthenticationError`, `RateLimitError`, etc.). No special error handling beyond what's inherited.
- **D-06:** No new error subclasses — consistent with D-09 from Phase 4.

### Carried Forward (Not Re-Asked)
- Constructor injection: `Identity(client: HttpClient, uploader: FileUploader)` (D-04/Phase 4)
- Zod `.strip()` on response parsing for forward compatibility (D-06/Phase 4)
- `z.infer<>` as single type source (D-11/Phase 2)
- `mapZodError` for input validation (D-12/Phase 2)
- Flat file layout: `identity.ts` + `identity.types.ts` (D-07/Phase 3)
- Errors bubble up as-is, no re-presign retry (D-09, D-10/Phase 4)

### Claude's Discretion
- None — all areas discussed and decided.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Build Guide (Primary)
- `deepidv-sdk-build-guide.md` lines 559-606 — `identity.verify()` input/output type definitions, API endpoint `POST /v1/identity/verify`, and tier description (orchestrated compound synchronous).

### Project & Requirements
- `.planning/PROJECT.md` — Project constraints, grouped module API pattern, presigned upload flow.
- `.planning/REQUIREMENTS.md` — Phase 5 requirements: IDV-01 (orchestrated compound call), IDV-02 (parallel uploads), IDV-03 (unified result type).
- `.planning/ROADMAP.md` — Phase 5 success criteria and dependency chain.

### Prior Phase Context
- `.planning/phases/04-document-face-primitives/04-CONTEXT.md` — Module pattern (D-04 constructor injection, D-06 `.strip()` parsing, D-09 error surface). Direct template for Identity class.
- `.planning/phases/02-presigned-upload-handler/02-CONTEXT.md` — FileUploader batch upload pattern, Zod validation patterns.

### Existing Code (Templates)
- `packages/server/src/face.ts` — `compare()` method is the closest template: batch presign count:2, parallel S3 PUTs, single POST with two fileKeys.
- `packages/server/src/face.types.ts` — Template for Zod schema + `z.infer<>` type co-location.
- `packages/server/src/document.ts` — Template for single-image upload + processing pattern.
- `packages/core/src/uploader.ts` — `FileUploader.upload()` array overload for batch presign.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FileUploader.upload([img1, img2])` — Batch presign + parallel S3 PUT. Used by `face.compare()`, directly reusable for `identity.verify()`.
- `HttpClient.post()` — Auth headers, retry on 5xx, error mapping. Standard for all processing endpoints.
- `mapZodError` — Maps `ZodError` to `ValidationError`. Exported from `@deepidv/core`.

### Established Patterns
- **Module class pattern:** Constructor injection with `(client: HttpClient, uploader: FileUploader)`, Zod-validate input, upload, POST, parse response.
- **Batch upload pattern:** `face.compare()` — `uploader.upload([source, target])` returns `[fileKey1, fileKey2]`.
- **File layout:** `module.ts` (class) + `module.types.ts` (Zod schemas + inferred types).

### Integration Points
- `packages/server/src/identity.ts` — New file: `Identity` class with `verify()` method.
- `packages/server/src/identity.types.ts` — New file: Zod schemas + inferred types for identity verification.
- `packages/server/src/index.ts` — Export `Identity` class and all public types.

</code_context>

<specifics>
## Specific Ideas

- `verify()` follows the same 4-step flow as all other service methods: (1) Zod-validate input, (2) `uploader.upload([docImage, faceImage])` for batch presign+upload, (3) `client.post('/v1/identity/verify', { documentFileKey, faceFileKey, documentType })`, (4) `IdentityVerificationResultSchema.parse(raw)`
- Input type: `{ documentImage: FileInput, faceImage: FileInput, documentType?: 'passport' | 'drivers_license' | 'national_id' | 'auto' }`
- Output: `{ verified: boolean, document: {...}, faceDetection: {...}, faceMatch: {...}, overallConfidence: number }` — all sub-objects required
- Nested response schemas are independent (not reused from Phase 4) because the shapes differ

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-identity-module*
*Context gathered: 2026-04-05*
