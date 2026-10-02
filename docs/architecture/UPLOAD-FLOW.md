# Presigned Upload Flow

File-based operations in the SDK use presigned URL upload flows. The generic `/v1/upload/presign` endpoint powers document, face, and identity methods internally. Profile logos use their domain-specific `/v1/profiles/logo-upload-url` endpoint. In both cases, the developer can pass a file and let the SDK complete the S3 upload.

## Single-File Upload

Used by `document.scan()`, `face.detect()`, and `face.estimateAge()`:

```mermaid
---
title: Single-File Presigned Upload Flow
---
sequenceDiagram
    participant Dev as Developer
    participant SDK as SDK (FileUploader)
    participant API as api.deepidv.com
    participant S3 as S3 (presigned URL)

    Dev->>SDK: document.scan({ image: buffer })
    Note over SDK: 1. Validate input (Zod)
    Note over SDK: 2. toUint8Array(input)
    Note over SDK: 3. detectContentType(bytes)
    SDK->>API: POST /v1/upload/presign<br/>{ files: [{ contentType: "image/jpeg", byteLength }] }
    API-->>SDK: { uploads: [{ uploadUrl, fileKey }] }
    Note over SDK: emit("upload:start")
    SDK->>S3: PUT uploadUrl<br/>Content-Type: image/jpeg<br/>(raw bytes)
    S3-->>SDK: 200 OK
    Note over SDK: emit("upload:complete")
    SDK->>API: POST /v1/document/scan<br/>{ fileKey, documentType }
    API-->>SDK: { fullName, dateOfBirth, ... }
    SDK-->>Dev: DocumentScanResult
```

## Multi-File Upload (Batch)

Used by `face.compare()` (source + target) and `identity.verify()` (document + face):

```mermaid
---
title: Multi-File Batch Upload Flow (face.compare)
---
sequenceDiagram
    participant Dev as Developer
    participant SDK as SDK (FileUploader)
    participant API as api.deepidv.com
    participant S3 as S3 (presigned URLs)

    Dev->>SDK: face.compare({ source: img1, target: img2 })
    Note over SDK: 1. Validate both inputs (Zod)
    Note over SDK: 2. toUint8Array(source), toUint8Array(target)
    Note over SDK: 3. detectContentType for each
    SDK->>API: POST /v1/upload/presign<br/>{ files: [{ contentType, byteLength }, { contentType, byteLength }] }
    API-->>SDK: { uploads: [<br/>  { uploadUrl: url1, fileKey: key1 },<br/>  { uploadUrl: url2, fileKey: key2 }<br/>] }
    par Parallel S3 PUTs (Promise.all)
        SDK->>S3: PUT url1 (source bytes)
        S3-->>SDK: 200 OK
    and
        SDK->>S3: PUT url2 (target bytes)
        S3-->>SDK: 200 OK
    end
    SDK->>API: POST /v1/face/compare<br/>{ sourceFileKey: key1, targetFileKey: key2 }
    API-->>SDK: { isMatch, confidence, threshold }
    SDK-->>Dev: FaceCompareResult
```

Key difference: a **single** presign request with two file metadata entries returns two upload slots. The S3 PUTs happen in parallel via `Promise.all`, making batch uploads faster than sequential.

## Profile Logo Upload

`client.profiles.uploadLogo()` and the `logo` option on `client.profiles.create()` use the profile-specific presign route:

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant SDK as SDK
    participant API as api.deepidv.com
    participant S3 as S3

    Dev->>SDK: profiles.create({ name, logo: { file, contentType } })
    SDK->>API: POST /v1/profiles/logo-upload-url<br/>{ contentType, byteLength }
    API-->>SDK: { uploadUrl, fileKey }
    SDK->>S3: PUT uploadUrl (raw bytes)
    S3-->>SDK: 200 OK
    SDK->>API: POST /v1/profiles<br/>{ name, logoUrl: fileKey }
    API-->>SDK: Profile
    SDK-->>Dev: Profile
```

The lower-level `client.profiles.createLogoUploadUrl()` method is available when an application needs to perform the PUT itself. The generic presign endpoint remains internal because document, face, and identity methods already own that orchestration.

## Accepted Input Types

The `FileInput` type accepts five formats. The `toUint8Array()` function normalizes all of them before upload:

| Input Type                   | Detection                                               | Behavior                                                                                                                               |
| ---------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `Uint8Array`                 | `instanceof Uint8Array`                                 | Pass through unchanged. Node `Buffer` extends `Uint8Array`, so buffers work automatically.                                             |
| `ReadableStream<Uint8Array>` | `instanceof ReadableStream`                             | Fully materialized to `Uint8Array` by reading all chunks. This happens **before** the retry loop to prevent double-read bugs (UPL-06). |
| Data URL string              | Starts with `data:`                                     | Base64 portion extracted and decoded to bytes.                                                                                         |
| Base64 string                | `typeof string` + length > 256 + matches base64 pattern | Decoded to bytes via `atob()`.                                                                                                         |
| File path string             | `typeof string` (fallback)                              | Read from disk via `fs.readFile`. Only works on Node.js, Deno, and Bun — throws `ValidationError` on edge runtimes.                    |

```typescript
// All of these work:
await client.document.scan({ image: fs.readFileSync('id.jpg') });           // Buffer (Uint8Array)
await client.document.scan({ image: new Uint8Array([0xFF, 0xD8, ...]) });   // Uint8Array
await client.document.scan({ image: readableStream });                       // ReadableStream
await client.document.scan({ image: 'data:image/jpeg;base64,/9j/4A...' }); // Data URL
await client.document.scan({ image: '/path/to/id.jpg' });                   // File path (Node only)
```

## Content-Type Detection

The SDK detects image format from magic bytes — the first few bytes of the file:

| Format | Magic Bytes   | MIME Type    |
| ------ | ------------- | ------------ |
| JPEG   | `FF D8 FF`    | `image/jpeg` |
| PNG    | `89 50 4E 47` | `image/png`  |

If the bytes don't match any known format, a `ValidationError` is thrown before any network call.

You can override detection by passing `contentType` in upload options (used internally by module methods).

Profile-logo methods require an explicit content type and additionally accept `image/webp` and `image/gif`. All presign inputs enforce the OpenAPI limit of 15 MiB per file before making a request.

## Timeout Configuration

Two independent timeouts control different parts of the flow:

| Config          | Default          | Controls                                                             |
| --------------- | ---------------- | -------------------------------------------------------------------- |
| `timeout`       | 30,000ms (30s)   | Per-attempt timeout for API requests (presign, processing endpoints) |
| `uploadTimeout` | 120,000ms (2min) | Per-attempt timeout for S3 PUT uploads                               |

The upload timeout is longer because file uploads can be significantly larger than API request/response payloads.

```typescript
const client = new DeepIDV({
  apiKey: 'your-key',
  timeout: 15_000, // 15s for API calls
  uploadTimeout: 60_000, // 60s for uploads
});
```

## S3 PUT Behavior

S3 PUTs use the raw `fetch` implementation from config — **not** the `HttpClient`. This means:

- **No `x-api-key` header** is sent to S3 (the presigned URL contains its own auth)
- **No retry via `withRetry()`** — S3 PUTs have their own error handling:
  - `403 Forbidden` → presigned URL expired → throws `DeepIDVError` with code `upload_url_expired`
  - `5xx` or network error → retried by the outer `withRetry()` wrapping the entire upload flow
  - Timeout → throws `TimeoutError` using `uploadTimeout`

## Upload Events

The event emitter fires two events during uploads:

| Event             | Payload                       | When                         |
| ----------------- | ----------------------------- | ---------------------------- |
| `upload:start`    | `{ url, bytes, contentType }` | Before each S3 PUT           |
| `upload:complete` | `{ url, contentType }`        | After each successful S3 PUT |

For batch uploads, you'll receive one `upload:start` and one `upload:complete` per file.
