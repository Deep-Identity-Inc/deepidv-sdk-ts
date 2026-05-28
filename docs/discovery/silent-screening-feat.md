# Silent Screening — Discovery & Scoping

**Ticket:** [DIDV-505](https://deepidentity.atlassian.net/browse/DIDV-505) — Ship Silent Screening surface in the TypeScript SDK.
**Server-side counterpart:** [DIDV-504](https://deepidentity.atlassian.net/browse/DIDV-504) — Open-API routes + async-jobs infrastructure.
**Date:** 2026-05-28 (last updated mid-implementation, same day)
**Author:** Luka Piplica (with Claude)
**Status:** Phase A in progress — 12 of 14 tasks complete. SDK foundation, schemas, namespaces, wiring, exports, and unit tests landed; `pepSanctions` validated end-to-end against local open-api. Remaining: handle polling tests (fake timers) + type-level assertions. Phase B still blocked on server work.

---

## 1. Goal

Extend `@deepidv/server` so SDK consumers can call:

```ts
client.screening.pepSanctions(input)
client.screening.adverseMedia(input)   // returns AdverseMediaHandle
client.screening.titleCheck(input)
client.screening.list({ limit, offset, service })

client.asyncJobs.get(jobId)            // also exposed top-level
```

No new package. The four-method screening surface and the async-jobs surface both attach to the existing `DeepIDV` client class, alongside `document` / `face` / `identity` / `sessions`.

The Jira ticket title (`@deepidv/sanctions`) is misleading — confirmed 2026-05-28 the work lands in `@deepidv/server`.

---

## 2. Locked design decisions (from DIDV-504/505)

- Split `firstName` / `lastName` — not a single `name` field.
- `dateOfBirth` required for `pepSanctions` and `adverseMedia`.
- `country` is ISO 3166-1 alpha-2, optional.
- Adverse media is **async-from-day-one** (locked 2026-05-26). The SDK returns an `AdverseMediaHandle` with `.wait({ pollIntervalMs?, timeoutMs? })` and `.refresh()`. Defaults: poll 2s, timeout 180s. Overrideable per-call.
- `Idempotency-Key` header: SDK auto-generates UUID v4 if caller omits `idempotencyKey`. Server-side TTL: 24h.
- `titleCheck({ address })` — server geocodes via Google Places. SDK does not.
- Error mapping: `400 → ValidationError`, `401 → AuthenticationError`, `403 → AuthorizationError`, `404 → NotFoundError`, terminal job `failed → AdverseMediaFailedError`, wait timeout → `PollTimeoutError`.
- Confidence semantics inherit the DIDV-201 unified scale.

---

## 3. Current SDK state (`deepidv-sdk-ts`)

### Architecture pattern

- `DeepIDV` class at `packages/server/src/deepidv.ts:102–167`. Eagerly constructs each namespace in the constructor and assigns it to a readonly property. All namespaces share a single `HttpClient` (and `FileUploader` where relevant) via DI.
- Namespace file pairs: `<name>.ts` (class) + `<name>.types.ts` (Zod schemas + `z.infer<>` types). Examples to mirror: `document.ts` / `document.types.ts`, `face.ts` / `face.types.ts`.
- HTTP client lives in `@deepidv/core` — `packages/core/src/client.ts`. Public methods `get/post/put/patch/delete`; each goes through `request()` → `withRetry()`. Exponential backoff with jitter on **429 + 5xx only**; never 4xx.
- Errors in `packages/core/src/errors.ts`: `DeepIDVError` (base), `AuthenticationError`, `RateLimitError`, `ValidationError`, `NetworkError`, `TimeoutError`. All preserve prototype chain across CJS/ESM and implement `toJSON()`.
- Tests: `packages/server/src/__tests__/` with `msw v2`. `setup.ts` configures a shared server; per-test `server.use(http.<method>(...))`.
- Build: single `src/index.ts` entry through `tsup`; dual ESM + CJS + `.d.ts`. Adding new files needs no build config changes — just export from `index.ts`.

### Existing stubs

- `packages/server/src/screening.ts` — **empty file**.
- `packages/server/src/screening.types.ts` — JSDoc header + `import { z } from 'zod'` (10 lines). Awaiting full implementation.

### Gaps to fill in `@deepidv/core`

- **Custom headers per request:** `HttpClient._attempt()` hardcodes headers via `buildHeaders(apiKey, body)` and does not accept extras. Required for `Idempotency-Key`. Need to extend `RequestOptions` with an optional `headers` map and merge in `_attempt()`.
- **New error classes:** `AuthorizationError` (403), `NotFoundError` (404), `AdverseMediaFailedError`, `PollTimeoutError`.

---

## 4. Current open-api state (`deepidv-open-api`)

Branch `DIDV-504` — head commit just landed the async-jobs + screening foundation.

### Endpoints that exist

| Endpoint | Status | Notes |
|---|---|---|
| `POST /v1/screening/pep-sanctions` | Implemented | Schema: `{ firstName, lastName, dateOfBirth }` — **no `country`** |
| `POST /v1/screening/adverse-media` | Implemented | Returns **201** `{ jobId, status: "PENDING", message }`. Spawns background job. No Zod schema for the 201 response. |
| `POST /v1/screening/title-check` | Implemented | Returns 200 with discriminated union on `status` |
| `GET /v1/async-jobs/{jobId}` | Implemented | Cross-org isolation via composite key (404 on mismatch) |
| `GET /v1/screening/sessions` | **Does not exist** | Blocker for `screening.list()` |

### Server contract vs. ticket — mismatches

| # | Ticket says | Server actually does | SDK impact |
|---|---|---|---|
| 1 | PEP/S accepts `country` | Schema doesn't accept it | **Blocker** — drop from v1 SDK surface or wait for server schema bump |
| 2 | Adverse-media returns 202 | Returns 201 | Cosmetic — SDK treats both as success |
| 3 | Job status `pending/processing/ready/failed` (lowercase) | `PENDING/PROCESSING/COMPLETED/FAILED` (uppercase, `COMPLETED` not `ready`) | SDK normalizes at parse boundary so public type matches the ticket |
| 4 | 422 unsupported region → discriminated union | Returns 200 with `status: "unsupported_region"` member | Better — SDK just parses it; no special error mapping |
| 5 | 403 cross-org on async-jobs | Returns 404 (key lookup miss) | SDK maps 404 → `NotFoundError`. `AuthorizationError` stays in the catalog but won't fire today |
| 6 | `GET /v1/screening/sessions` exists | Not implemented | **Blocker** for `screening.list()` |
| 7 | `Idempotency-Key` honored, 24h dedup | No dedup logic | SDK sends the header anyway; server ignores gracefully. "Same key → same jobId" integration test cannot pass yet |
| 8 | Sandbox bypass for instant adverse-media | `sandboxMiddleware` doesn't intercept screening/async-jobs routes | Adverse-media smoke test takes real wall-clock time |

---

## 5. Decisions taken (all carried through to implementation)

- **PEP/S `country`** → drop from SDK v1. Add later when server schema bumps.
- **Async-job status normalization** → map server enums to the lowercase ticket shape at the Zod parse boundary. Public type matches the documented contract.
- **`screening.list()`** → scaffold method + Zod schemas now; method body throws `Error("Not yet implemented — pending GET /v1/screening/sessions on the server")`. Cleaner than carving it out and re-adding later.
- **`Idempotency-Key`** → SDK auto-generates + sends header today. Once server-side dedup lands the behavior just starts working — no SDK code change.
- **Open question 1** (re-export from `@deepidv/server`) → moot; we're landing directly in `@deepidv/server`.
- **Open question 2** (`client.asyncJobs.get(jobId)` on the client) → **resolved yes**, per user direction 2026-05-28.

---

## 6. Implementation plan

### Phase A — SDK foundation (no server blockers)

1. **`@deepidv/core` plumbing**
   - Add `AuthorizationError`, `NotFoundError`, `AdverseMediaFailedError`, `PollTimeoutError` to `errors.ts`.
   - Extend `RequestOptions` with optional `headers?: Record<string, string>`; merge into `buildHeaders` output in `_attempt()`.
   - Map `403 → AuthorizationError`, `404 → NotFoundError` in the HTTP status-mapping block.
2. **`screening.types.ts`** — Zod schemas for `pepSanctions` request/response, `adverseMedia` request + 201 queued response, `titleCheck` request + discriminated-union response (including `unsupported_region`), plus `AdverseMediaResult` derived from the COMPLETED job payload.
3. **`asyncJobs.types.ts`** — Zod for the GET response; normalization transform so the public `AdverseMediaJobSnapshot` is `pending | processing | ready | failed` discriminated union.
4. **`asyncJobs.ts`** — `AsyncJobs` class with `get(jobId)` method.
5. **`screening.ts`** — `Screening` class with four methods.
   - `pepSanctions`, `titleCheck` — straight sync.
   - `adverseMedia` returns `AdverseMediaHandle { jobId, wait, refresh }`. Internally uses the `AsyncJobs` instance.
   - `list` — scaffolded, throws `NotImplementedError` until server lands.
   - UUID v4 fallback via `globalThis.crypto.randomUUID()` (available in all target runtimes per project constraints).
6. **Wire into `DeepIDV`** — instantiate `Screening` + `AsyncJobs` in the constructor; assign to `this.screening` / `this.asyncJobs`. Export types/schemas/errors from `index.ts`.
7. **Tests** (`__tests__/screening.test.ts`, `__tests__/asyncJobs.test.ts`, `__tests__/adverseMediaHandle.test.ts`) — msw v2 mirroring `document.test.ts`. Cover:
   - Happy path per method.
   - Each documented error.
   - Handle polling: terminates on ready / failed, respects `pollIntervalMs` (use fake timers), throws `PollTimeoutError` after `timeoutMs`.
   - `Idempotency-Key`: auto-generated UUID present; explicit key echoed.
   - Type-level `expectTypeOf` for the two discriminated unions.

### Phase B — Blocked on server work

- **`screening.list()`** real implementation — needs `GET /v1/screening/sessions`.
- **Live-dev integration smoke** — needs `sandboxMiddleware` to intercept adverse-media routes (or accept ~3min wall-clock time per smoke run).
- **`Idempotency-Key` round-trip test** — needs server-side dedup.
- **Mintlify `docs/sdk/screening.mdx`** — can be drafted in parallel during Phase A and finalized when `list()` lands.

---

## 7. Risks & follow-ups

- The status-enum normalization is a one-way translation. If the server later changes its enum names, SDK normalization must follow. Document the mapping in `asyncJobs.types.ts`.
- Custom-header support in `@deepidv/core` is a public API extension — non-breaking but worth a changeset entry.
- The 403 vs 404 cross-org behavior is a server choice; if the server later switches to explicit 403, SDK error mapping will just start firing `AuthorizationError` correctly without code changes.
- `client.asyncJobs.get()` is now a public API regardless of the screening surface — covers the "I stored a jobId in my DB days ago" use case.

---

## 8. Progress (2026-05-28)

### Phase A — 12 of 14 tasks complete

| # | Task | Status | Files |
|---|---|---|---|
| 1 | Add new error classes to `@deepidv/core` | ✅ Done | `packages/core/src/errors.ts`, `packages/core/src/index.ts`, `packages/server/src/index.ts` |
| 2 | Add custom-headers support to `HttpClient` | ✅ Done | `packages/core/src/client.ts` |
| 3 | Map 403/404 to new error classes | ✅ Done | `packages/core/src/client.ts` |
| 4 | Write `screening.types.ts` Zod schemas | ✅ Done | `packages/server/src/screening.types.ts` |
| 5 | Write `asyncJobs.types.ts` with status normalization | ✅ Done | `packages/server/src/asyncJobs.types.ts` |
| 6 | Implement `AsyncJobs` namespace class | ✅ Done | `packages/server/src/asyncJobs.ts` |
| 7 | Implement `Screening` namespace class | ✅ Done | `packages/server/src/screening.ts` |
| 8 | Implement `AdverseMediaHandle` factory | ✅ Done | `packages/server/src/asyncJobHandle.ts` |
| 9 | Wire `Screening` + `AsyncJobs` into `DeepIDV` client | ✅ Done | `packages/server/src/deepidv.ts` |
| 10 | Update `index.ts` public exports | ✅ Done | `packages/server/src/index.ts` |
| 11 | Write `screening.test.ts` (msw v2) | ✅ Done — 21 tests | `packages/server/src/__tests__/screening.test.ts` |
| 12 | Write `asyncJobs.test.ts` (msw v2) | ✅ Done — 12 tests | `packages/server/src/__tests__/asyncJobs.test.ts` |
| 13 | Write `AdverseMediaHandle` polling tests (fake timers) | ⏳ Pending | `packages/server/src/__tests__/adverseMediaHandle.test.ts` |
| 14 | Add `expectTypeOf` assertions for discriminated unions | ⏳ Pending | TBD |

### Validation

- **92/92 server tests** pass; **126/126 core tests** pass; both packages typecheck clean.
- **End-to-end against local open-api** — `scripts/pep-sanctions-test.js` validated `pepSanctions` happy path (clean record + populated matches array on Putin) and 400 → `ValidationError` mapping.

### Observations from end-to-end testing (server-side, NOT SDK)

- Local open-api's **OpenSanctions integration returns all `null`** for known PEPs — likely missing API key in local `.env`.
- **US Sanctions data source not firing** locally — only Canadian list hits for known sanctioned individuals.
- Match `score` semantics look inverted: `0.001` paired with `matchType: "fullMatchWithYear"` is inconsistent (likely distance metric, not similarity).
- Worth a server-side audit of `runSanctionsCheck` in `deepidv-backend-cdk` and a local `.env` review for screening integrations before treating zero-match responses as authoritative.

### Gotcha worth remembering

When adding error classes in `@deepidv/core/errors.ts`, **don't reference a named-but-unexported `interface` in the constructor signature**. typescript-eslint's `strictTypeChecked` ruleset flags such constructors as "Unsafe construction of a type that could not be resolved" at the call site because the named type isn't visible from outside the module. The fix is to inline the options shape via `Pick<DeepIDVErrorOptions, ...> & { extra?: ... }` — that's the pattern the existing `AuthenticationError` / `ValidationError` already use. Both new domain errors (`AdverseMediaFailedError`, `PollTimeoutError`) now follow this convention.

### Phase B — Still blocked on server

- `screening.list()` real implementation — blocked on `GET /v1/screening/sessions`.
- Live-dev adverse-media smoke — blocked on `sandboxMiddleware` extension to intercept screening/async-jobs routes (otherwise the smoke run takes real wall-clock time ≥ 3 min).
- `Idempotency-Key` round-trip test — blocked on server-side dedup.
- Mintlify `docs/sdk/screening.mdx` — can be drafted in parallel; final pass when `list()` lands.

### Resolved open questions

1. **`@deepidv/server` re-export** → moot; surface landed directly in `@deepidv/server`, no re-export needed.
2. **`client.asyncJobs.get(jobId)` public on the client** → **yes**, exposed as a readonly namespace on `DeepIDV`.
