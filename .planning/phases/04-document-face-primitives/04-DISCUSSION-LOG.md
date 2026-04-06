# Phase 4: Document & Face Primitives - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 04-document-face-primitives
**Areas discussed:** Upload-to-result orchestration, Constructor dependencies, Response schema strictness, Error surface for upload failures

---

## Upload-to-Result Orchestration

### Q1: Input type for Document/Face methods

| Option | Description | Selected |
|--------|-------------|----------|
| FileInput directly | Developer passes Buffer/Uint8Array/string — SDK handles presign+upload+process internally. Matches core value. | ✓ |
| Accept both | Accept FileInput OR a raw fileKey string. Adds flexibility but complicates schema. | |
| You decide | Claude picks the approach. | |

**User's choice:** FileInput directly (Recommended)
**Notes:** Aligns with SDK core value — developers pass images in, get results back.

### Q2: Parallel upload strategy for face.compare

| Option | Description | Selected |
|--------|-------------|----------|
| Single batch presign | One POST /v1/uploads/presign with count:2, then Promise.all two S3 PUTs. Fewer round trips. | ✓ |
| Two separate presigns | Two independent presign+upload cycles. Simpler but slower. | |
| You decide | Claude picks based on FileUploader support. | |

**User's choice:** Single batch presign (Recommended)
**Notes:** Matches Phase 2's batch upload pattern (UPL-04).

### Q3: Processing endpoint call path

| Option | Description | Selected |
|--------|-------------|----------|
| Through HttpClient | Processing endpoints are API calls — need x-api-key, retry on 5xx, error mapping. | ✓ |
| Raw fetch | Use config.fetch directly, bypassing HttpClient. | |
| You decide | Claude picks based on consistency. | |

**User's choice:** Through HttpClient (Recommended)
**Notes:** Consistent with Sessions module pattern.

---

## Constructor Dependencies

### Q4: How Document/Face receive dependencies

| Option | Description | Selected |
|--------|-------------|----------|
| Two constructor params | constructor(client: HttpClient, uploader: FileUploader). Explicit and testable. | ✓ |
| Single context object | constructor(ctx: { client, uploader }). Groups deps but adds indirection. | |
| HttpClient only | Class creates FileUploader internally. Less testable. | |

**User's choice:** Two constructor params (Recommended)
**Notes:** Explicit, testable — mock either independently.

### Q5: Shared base class

| Option | Description | Selected |
|--------|-------------|----------|
| No base class | Each class self-contained. Upload-then-process is 3-5 lines. | ✓ |
| Shared base class | Abstract UploadServiceBase with protected helper. | |
| You decide | Claude decides based on duplication. | |

**User's choice:** No base class (Recommended)
**Notes:** Avoids premature abstraction for a simple flow.

---

## Response Schema Strictness

### Q6: Zod parsing mode for API responses

| Option | Description | Selected |
|--------|-------------|----------|
| Strict strip | z.object().strip() — validate known, drop unknown. Forward-compatible. | ✓ |
| Passthrough | z.object().passthrough() — keep unknown fields in result. | |
| Strict exact | z.object().strict() — fail on unknown fields. | |

**User's choice:** Strict strip (Recommended)
**Notes:** Protects types while being forward-compatible.

### Q7: Where response parsing happens

| Option | Description | Selected |
|--------|-------------|----------|
| In service method | Each method calls schema.parse(rawResponse) after client.post(). | ✓ |
| HttpClient generic | Extend client.post with responseSchema param. Changes core. | |
| You decide | Claude picks. | |

**User's choice:** In service method (Recommended)
**Notes:** Consistent with input validation pattern from Sessions.

---

## Error Surface for Upload Failures

### Q8: Domain errors from processing endpoints

| Option | Description | Selected |
|--------|-------------|----------|
| Standard DeepIDVError | Use existing error with status code and error code. No new subclasses. | ✓ |
| New subclasses | DocumentScanError, FaceDetectionError, etc. | |
| You decide | Claude picks. | |

**User's choice:** Standard DeepIDVError (Recommended)
**Notes:** API error codes already distinguish cases. Keeps hierarchy lean.

### Q9: Upload failure handling

| Option | Description | Selected |
|--------|-------------|----------|
| Surface the error | FileUploader retries internally. If still fails, bubble NetworkError/TimeoutError. | ✓ |
| Retry full flow | Re-presign and re-upload on failure. | |
| You decide | Claude picks. | |

**User's choice:** Surface the error (Recommended)
**Notes:** FileUploader already retries S3 PUTs (D-08/Phase 2). No re-presign — URL may have expired.

---

## Claude's Discretion

None — all areas discussed and decided by user.

## Deferred Ideas

None — discussion stayed within phase scope.
