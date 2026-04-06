# Phase 5: Identity Module - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 05-identity-module
**Areas discussed:** API call pattern, Response type reuse, Partial failure surface

---

## API Call Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Single endpoint | Upload both images in parallel (batch presign count:2), then POST /v1/identity/verify with both fileKeys. Server handles scan+detect+compare internally. Matches the build guide's single endpoint and keeps the SDK thin. | ✓ |
| SDK-side orchestration | SDK calls document.scan(), face.detect(), and face.compare() as separate API calls, then composes the unified result client-side. More network calls but gives the SDK control over partial results and retry per sub-operation. | |

**User's choice:** Single endpoint (Recommended)
**Notes:** Keeps the SDK thin and matches the build guide's documented endpoint.

---

## Response Type Reuse

| Option | Description | Selected |
|--------|-------------|----------|
| Independent types | Define new Zod schemas in identity.types.ts matching the build guide's exact shapes. The nested objects have different shapes than the standalone Phase 4 results. | ✓ |
| Reuse Phase 4 types | Import and reuse DocumentScanResult, FaceDetectResult, FaceCompareResult from existing type files. Fewer schemas to maintain but creates coupling. | |

**User's choice:** Independent types (Recommended)
**Notes:** The /v1/identity/verify response has different nested shapes (e.g., faceDetection is simpler than standalone FaceDetectResult), so independent schemas match the build guide exactly without coupling.

---

## Partial Failure Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Trust the API | The API endpoint handles orchestration server-side. 2xx = parse as-is (verified: false with all sub-results populated). 4xx/5xx = existing error hierarchy. No optional sub-fields. | ✓ |
| Optional sub-results | Make document, faceDetection, faceMatch optional in the schema. More defensive but adds null-checking burden on consumers. | |

**User's choice:** Trust the API (Recommended)
**Notes:** All sub-fields required — the API always returns the full shape on 2xx. Errors go through existing hierarchy.

---

## Claude's Discretion

None — all areas discussed and decided.

## Deferred Ideas

None — discussion stayed within phase scope.
