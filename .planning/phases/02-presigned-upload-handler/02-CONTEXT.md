# Phase 2: Presigned Upload Handler - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

A `FileUploader` in `@deepidv/core` that accepts any supported input type (Uint8Array, ReadableStream, file path string, base64 string), detects content type via magic bytes, requests presigned URLs from `POST /v1/uploads/presign`, PUTs files to S3 via native fetch, and returns `fileKey`s. Includes Zod-based runtime validation on all public method inputs. No service modules (document, face, etc.) — those consume the uploader in later phases.

</domain>

<decisions>
## Implementation Decisions

### File Input Normalization
- **D-01:** Single `toUint8Array()` function normalizes all input types to `Uint8Array` before upload. Detects input type and converts: Uint8Array passes through, base64 is decoded, file path uses conditional `fs.readFile` on Node/Deno/Bun, ReadableStream is materialized (UPL-06).
- **D-02:** `FileInput` type is `Uint8Array | ReadableStream | string` only — no `Buffer` in the union. Node Buffers pass the `instanceof Uint8Array` check naturally. Avoids importing Buffer (doesn't exist on edge runtimes).
- **D-03:** File path vs base64 string detection uses **prefix convention**: strings starting with `data:` are data URLs; strings matching base64 character pattern with length > 256 are raw base64; everything else is treated as a file path.
- **D-04:** On edge runtimes where `fs` is unavailable, passing a file path string throws `ValidationError` immediately with message: "File path input requires Node.js, Deno, or Bun. Pass Buffer or Uint8Array on edge runtimes." (COMPAT-04)

### Content-Type Detection
- **D-05:** Magic byte sniffing detects JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), and WebP (`52 49 46 46...57 45 42 50`) from the first 12 bytes of the normalized `Uint8Array`. Throws `ValidationError` if format is unrecognized.
- **D-06:** Optional `contentType` field in upload options allows caller override. When provided, skip auto-detection and use the caller's value. Useful for edge cases or future formats.

### Upload Timeout & Retry
- **D-07:** New `uploadTimeout` field added to `DeepIDVConfig` (default: 120,000ms / 2 minutes). Separate from API request `timeout` (30s). S3 PUTs use `uploadTimeout`, presign API calls use `timeout`.
- **D-08:** S3 PUTs retry on 5xx and network errors using the same exponential backoff policy as API calls. 403 (expired presigned URL) throws immediately — never retry. Other 4xx throw immediately.
- **D-09:** `FileUploader` uses **raw `config.fetch`** for S3 PUT requests, not `HttpClient`. S3 PUTs don't need x-api-key headers, JSON parsing, or API error mapping. Presign requests (`POST /v1/uploads/presign`) go through `HttpClient` as normal.

### Zod Validation Pattern
- **D-10:** Zod schemas are **co-located with their module** — `uploader.ts` defines upload schemas at the top, future modules define theirs locally. No separate `schemas/` directory.
- **D-11:** `z.infer<typeof Schema>` is the **single source of truth** for TypeScript types. No separate interface definitions for validated inputs. (VAL-03)
- **D-12:** Zod validation errors are caught and mapped to `ValidationError` from the existing error hierarchy. First issue's path and message extracted: `"Invalid input: {message} at '{path}'"`. Raw `ZodError` attached as `cause`. (VAL-02)

### Claude's Discretion
- None — all areas discussed and decided.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Build & Architecture
- `deepidv-sdk-build-guide.md` — Full type definitions, presigned upload flow (lines 186-208), repo structure, FileUploader spec (line 738-744). Primary implementation reference.

### Project & Requirements
- `.planning/PROJECT.md` — Project constraints (zero AWS SDK, minimal deps, runtime compat), key decisions.
- `.planning/REQUIREMENTS.md` — Phase 2 requirements: UPL-01 through UPL-07 (file upload), VAL-01 through VAL-03 (validation).
- `.planning/ROADMAP.md` — Phase 2 success criteria and dependency chain.

### Prior Phase Context
- `.planning/phases/01-core-infrastructure/01-CONTEXT.md` — Phase 1 decisions carried forward: per-attempt timeout (D-01), custom fetch (D-13), event emitter contract (D-09/D-10), error hierarchy design (D-05 through D-08).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `HttpClient` (`packages/core/src/client.ts`) — Used for presign API calls. Has auth, retry, timeout, event emitting built in.
- `withRetry` (`packages/core/src/retry.ts`) — Reusable for S3 PUT retry logic (same exponential backoff + jitter).
- `ValidationError` (`packages/core/src/errors.ts`) — Existing error class for Zod validation mapping.
- `NetworkError` / `TimeoutError` (`packages/core/src/errors.ts`) — For S3 upload failures.
- `TypedEmitter` (`packages/core/src/events.ts`) — For upload progress events (fire-and-forget, D-09 from Phase 1).
- `ResolvedConfig` (`packages/core/src/config.ts`) — Needs `uploadTimeout` field added.

### Established Patterns
- Per-attempt `AbortController` timeout (D-01 from Phase 1) — same pattern for S3 upload timeout.
- Custom `fetch` injection via config (D-13) — `FileUploader` must use `config.fetch` for S3 PUTs.
- Error cause chaining via native `Error.cause` (D-07 from Phase 1) — ZodError attached as cause to ValidationError.
- `buildUrl` / `buildHeaders` from `auth.ts` — presign requests use these via HttpClient.

### Integration Points
- `packages/core/src/config.ts` — Add `uploadTimeout` to `DeepIDVConfig` and `ResolvedConfig`
- `packages/core/src/uploader.ts` — New file: `FileUploader` class
- `packages/core/src/index.ts` — Export `FileUploader` and related types
- `packages/core/src/events.ts` — May need new upload event types in `SDKEventMap`

</code_context>

<specifics>
## Specific Ideas

- Presign flow matches build guide exactly: `POST /v1/uploads/presign` with `{ contentType, count }` returns `{ uploads: [{ uploadUrl, fileKey }] }`
- Batch uploads: `count: N` in presign request, parallel S3 PUTs via `Promise.all` (UPL-04)
- ReadableStream materialization happens once at the SDK boundary in `toUint8Array()` — prevents double-read zero-byte bug (UPL-06)
- S3 PUT uses raw fetch with `Content-Type` header and binary body — no JSON, no auth headers

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-presigned-upload-handler*
*Context gathered: 2026-04-05*
