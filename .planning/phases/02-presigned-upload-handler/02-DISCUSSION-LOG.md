# Phase 2: Presigned Upload Handler - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 02-presigned-upload-handler
**Areas discussed:** File input normalization, Content-type detection, Upload timeout & retry, Zod validation pattern

---

## File Input Normalization

### Q1: How should the SDK normalize the 5 input types into upload-ready bytes?

| Option | Description | Selected |
|--------|-------------|----------|
| Single toUint8Array() | One function that detects input type and converts everything to Uint8Array before upload. ReadableStream materialized here (UPL-06). File path uses conditional fs.readFile on Node, throws on edge. | ✓ |
| Per-type adapter classes | Separate BufferAdapter, StreamAdapter, PathAdapter etc. each with a .toBytes() method. More extensible but heavier abstraction for 5 cases. | |
| Lazy — stream through to fetch body | Pass compatible types directly as fetch body without materializing. Avoids double-buffering but complicates content-length and progress tracking. | |

**User's choice:** Single toUint8Array()
**Notes:** None

### Q2: How should file path input work on edge runtimes?

| Option | Description | Selected |
|--------|-------------|----------|
| Throw ValidationError | If string looks like a file path and fs is unavailable, throw immediately with clear message. Matches COMPAT-04. | ✓ |
| Omit file path support entirely | Remove file path from union type. Developers always pass bytes. | |

**User's choice:** Throw ValidationError
**Notes:** None

### Q3: How should base64 input be distinguished from a file path?

| Option | Description | Selected |
|--------|-------------|----------|
| Prefix convention | Require base64 strings to start with "data:image/...;base64," or detect by checking base64 character pattern + length > 256. Anything else treated as file path. | ✓ |
| Explicit tagged union | Require { type: 'base64', data: '...' } or { type: 'path', path: '/...' }. No ambiguity but less ergonomic. | |
| You decide | Claude picks best approach. | |

**User's choice:** Prefix convention
**Notes:** None

### Q4: Should Buffer be a separate type in the union?

| Option | Description | Selected |
|--------|-------------|----------|
| Uint8Array only | FileInput type only lists Uint8Array. Node Buffers pass instanceof Uint8Array check naturally. Keeps type clean. | ✓ |
| Both in union | List both Buffer | Uint8Array for Node developer discoverability. Requires conditional Buffer type import. | |

**User's choice:** Uint8Array only
**Notes:** None

---

## Content-Type Detection

### Q1: How should the SDK detect image content type from raw bytes?

| Option | Description | Selected |
|--------|-------------|----------|
| Magic bytes | Check first 4-12 bytes for JPEG, PNG, WebP signatures. Fast, reliable, no dependencies. Falls back to error if unrecognized. | ✓ |
| File extension + magic bytes fallback | Use extension from file path first, fall back to magic bytes for raw bytes. Two detection paths. | |
| Caller-provided only | Require contentType in method options. No auto-detection. Simplest but worst DX. | |

**User's choice:** Magic bytes
**Notes:** None

### Q2: Should callers be able to override the auto-detected content type?

| Option | Description | Selected |
|--------|-------------|----------|
| Optional override | Accept optional contentType in upload options. If provided, skip detection. Useful for edge cases or future formats. | ✓ |
| No override | Always auto-detect. No escape hatch. | |
| You decide | Claude picks based on API cleanliness. | |

**User's choice:** Optional override
**Notes:** None

---

## Upload Timeout & Retry

### Q1: How should the separate S3 upload timeout be configured?

| Option | Description | Selected |
|--------|-------------|----------|
| New uploadTimeout config field | Add uploadTimeout to DeepIDVConfig alongside existing timeout. Defaults to 120s. API calls use timeout, S3 PUTs use uploadTimeout. | ✓ |
| Single timeout for everything | Use existing timeout for both API and S3. Simpler but 30s may be too short for uploads. | |
| Per-call timeout only | No global uploadTimeout. Each upload call accepts a timeout option. | |

**User's choice:** New uploadTimeout config field
**Notes:** None

### Q2: Should S3 PUT uploads retry on failure?

| Option | Description | Selected |
|--------|-------------|----------|
| Retry S3 PUTs on 5xx/network errors | S3 can return 500/503 transiently. Retry with same backoff. 403 (expired presigned URL) throws immediately. | ✓ |
| No S3 retry | If S3 PUT fails, throw immediately. Caller retries whole flow. | |
| You decide | Claude picks based on S3 error patterns. | |

**User's choice:** Retry S3 PUTs on 5xx/network errors
**Notes:** None

### Q3: Should FileUploader use HttpClient for S3 PUTs?

| Option | Description | Selected |
|--------|-------------|----------|
| Raw fetch for S3 | S3 PUTs don't need auth headers, JSON parsing, or API error mapping. Use config.fetch directly. Presign requests go through HttpClient normally. | ✓ |
| HttpClient for everything | Route S3 PUTs through HttpClient too. Reuses retry/timeout but needs special handling. | |

**User's choice:** Raw fetch for S3
**Notes:** None

---

## Zod Validation Pattern

### Q1: Where should Zod schemas live in the codebase?

| Option | Description | Selected |
|--------|-------------|----------|
| Co-located with module | Each module file defines its own schemas at the top. Schema is right next to the code that uses it. | ✓ |
| Separate schemas/ directory | All schemas in a centralized directory. Easy to find but import distance. | |
| Dedicated validation.ts per package | One file per package with all schemas. Middle ground. | |

**User's choice:** Co-located with module
**Notes:** None

### Q2: Should TypeScript types be derived from Zod schemas or defined separately?

| Option | Description | Selected |
|--------|-------------|----------|
| z.infer as single source | Zod schema IS the type. One definition, zero drift. Matches VAL-03. | ✓ |
| Separate types + schemas | Define interfaces manually, write matching Zod schemas. More readable .d.ts but two sources of truth. | |

**User's choice:** z.infer as single source
**Notes:** None

### Q3: How should Zod validation errors be formatted for developers?

| Option | Description | Selected |
|--------|-------------|----------|
| Map to ValidationError with field path | Catch ZodError, extract first issue's path and message, throw ValidationError. Consistent with existing error hierarchy. | ✓ |
| Pass ZodError through directly | Let raw ZodError propagate. Breaks typed error contract. | |
| All issues, not just first | Collect all issues into single ValidationError with .fieldErrors property. More info but noisier. | |

**User's choice:** Map to ValidationError with field path
**Notes:** None

---

## Claude's Discretion

None — all areas discussed and decided by user.

## Deferred Ideas

None — discussion stayed within phase scope.
