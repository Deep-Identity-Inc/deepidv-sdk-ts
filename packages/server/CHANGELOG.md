# @deepidv/server

## 1.1.0

### Minor Changes

- 370fa51: Add typed handling for the token-balance (402) and service-unavailable (503) responses, and realign the Silent Screening surface to the current public API contract.

  **New error types**
  - `InsufficientFundsError` (HTTP 402) — thrown when the pre-flight funds/subscription gate fails. The server returns a plain-text body; the client now falls back to `response.text()` so the error carries the real `"Insufficient funds or subscription."` message instead of degrading to `"HTTP 402"`.
  - `ServiceUnavailableError` (HTTP 503) — thrown when a synchronous screening upstream exceeds the server deadline (transient).

  Both extend `DeepIDVError`, so existing `catch (DeepIDVError)` / `err.status === 402` checks keep working — they just gain a precise type and a readable message. This applies uniformly across the shared HTTP client, so the inline-billed action routes (`document.scan`, `identity.verify`, `face.detect` / `face.compare` / `face.estimateAge`) also surface `InsufficientFundsError` on a 402 with no per-namespace code.

  **Screening contract realignment** (unpublished surface — no migration needed)
  - `pepSanctions`, `adverseMedia`, and `titleCheck` now require a validated `email`; `titleCheck` additionally takes `firstName` / `lastName`.
  - The PEP & Sanctions response is normalized to `{ totalMatches, peps, sanctions, both, searchedSources }`, each match carrying `{ name, country, dateOfBirth, confidence, datasets }`.
  - The async-job snapshot mirrors the server's public shape directly: lowercase `status`, numeric `createdAt` (epoch seconds), ISO `updatedAt`, and no `type` field.

  **Fail-fast retry policy**
  - The two synchronous, 503-emitting screening routes (`pepSanctions`, `titleCheck`) are made non-retryable so callers fail fast instead of blocking through 5xx backoff on a long upstream deadline. All other routes keep the default 429/5xx retry policy; the action routes are unaffected (inline billing refunds on failure).

## 1.0.0

### Major Changes

- 401f4be: First v1 major release of `@deepidv/server`, the backend TypeScript SDK for the deepidv identity verification API.

  **What's included**
  - `sessions` — create and retrieve verification sessions
  - `document.scan` — extract structured data from ID documents (multipart or S3 `fileKey`)
  - `face.detect` / `face.compare` / `face.estimateAge` — face analysis primitives
  - `identity.verify` — compound endpoint that runs document scan + face detect + face compare in parallel and returns a unified `overallConfidence` score (0–100)
  - Built-in presigned-URL orchestration — pass image buffers, get typed results back
  - Runtime validation via Zod; full TypeScript types
  - Runs on Node 18+, Deno, Bun, and edge runtimes

  **Getting started**

  ```ts
  import { DeepIdv } from '@deepidv/server';

  const client = new DeepIdv({ apiKey: process.env.DEEPIDV_API_KEY });
  const result = await client.identity.verify({ document, selfie });
  ```

  See the [quickstart](https://docs.deepidv.com/quickstart) for full setup.
