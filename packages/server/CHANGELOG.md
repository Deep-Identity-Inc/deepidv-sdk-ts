# @deepidv/server

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
