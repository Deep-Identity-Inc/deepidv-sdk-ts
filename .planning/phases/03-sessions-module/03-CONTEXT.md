# Phase 3: Sessions Module - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

First end-to-end HTTP integration: session CRUD (create, retrieve, list, updateStatus) through `client.sessions` with fully typed inputs and outputs. This is the first service module — the patterns established here (class structure, DI, Zod validation, response typing) will be the template for document, face, and identity modules in Phases 4-6. No file uploads involved — sessions are pure HTTP JSON calls via HttpClient.

</domain>

<decisions>
## Implementation Decisions

### Module Class Pattern
- **D-01:** Service modules use **class with constructor injection** — `class Sessions { constructor(private client: HttpClient) {} }`. Standard SDK pattern (Stripe, OpenAI). Modules receive HttpClient via constructor. Easy to test (inject mock client), clear ownership.
- **D-02:** This pattern is the **template for all future modules** (document, face, identity). Each gets its own class with the same constructor signature.

### Response Type Depth
- **D-03:** Zod schemas go **full depth** — type every field the build guide defines, all the way down to `analysisData.idAnalysisData.idExtractedText[0].value`, `compareFacesData.faceMatchConfidence`, `pepSanctionsData`, etc.
- **D-04:** `z.infer<>` remains the single source of truth for TypeScript types (carried forward from Phase 2, D-11). No separate interface definitions.

### List Pagination Contract
- **D-05:** `sessions.list()` returns a **wrapper with pagination metadata**: `{ data: Session[], total?: number, hasMore?: boolean, limit: number, offset: number }`. If the API returns a raw array, the SDK wraps it.
- **D-06:** This pagination wrapper pattern applies to any future list method across modules.

### File Layout
- **D-07:** Service modules live **flat in `packages/server/src/`** — `sessions.ts` + `sessions.types.ts`. Matches the build guide's file tree exactly.
- **D-08:** Types file (`sessions.types.ts`) contains all Zod schemas and inferred types for the module. Module file (`sessions.ts`) imports from the types file.
- **D-09:** Pattern extends to future modules: `document.ts` + `document.types.ts`, `face.ts` + `face.types.ts`, `identity.ts` + `identity.types.ts`.

### Claude's Discretion
- None — all areas discussed and decided.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Build & Architecture
- `deepidv-sdk-build-guide.md` — Full type definitions for session inputs/outputs (lines 249-421), file tree showing module placement (line 78/88), presigned upload flow, and all architectural decisions. Primary implementation reference.

### Project & Requirements
- `.planning/PROJECT.md` — Project constraints, grouped module API pattern, key decisions.
- `.planning/REQUIREMENTS.md` — Phase 3 requirements: SESS-01 through SESS-04 (session CRUD).
- `.planning/ROADMAP.md` — Phase 3 success criteria and dependency chain.

### Prior Phase Context
- `.planning/phases/01-core-infrastructure/01-CONTEXT.md` — Phase 1 decisions: HttpClient design (D-13 custom fetch, D-14 no interceptors), error hierarchy (D-05 through D-08), event emitter contract (D-09 through D-12).
- `.planning/phases/02-presigned-upload-handler/02-CONTEXT.md` — Phase 2 decisions: Zod co-location (D-10), z.infer as type source (D-11), Zod-to-ValidationError mapping (D-12).

### Existing Code
- `packages/core/src/client.ts` — HttpClient class with get/post/put/patch/delete methods. Sessions module will use this directly.
- `packages/core/src/errors.ts` — Error hierarchy (ValidationError for Zod mapping).
- `packages/server/src/index.ts` — Current barrel exports. Will need Sessions class and types added.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `HttpClient` (`packages/core/src/client.ts`) — Has `get`, `post`, `patch` methods with auth, retry, timeout, and event emitting. Sessions module uses this directly for all API calls.
- `ValidationError` (`packages/core/src/errors.ts`) — Maps Zod parse failures to SDK errors (pattern from Phase 2).
- Zod validation pattern from `packages/core/src/uploader.ts` — Schema definition + `schema.parse(input)` + catch-and-map-to-ValidationError.

### Established Patterns
- Zod schemas co-located with module (D-10 from Phase 2) — `sessions.types.ts` follows the same pattern as uploader.ts.
- `z.infer<typeof Schema>` as single type source (D-11) — no separate interfaces.
- Per-attempt timeout via AbortController (D-01 from Phase 1) — inherited from HttpClient.

### Integration Points
- `packages/server/src/sessions.ts` — New file: `Sessions` class
- `packages/server/src/sessions.types.ts` — New file: Zod schemas + inferred types
- `packages/server/src/index.ts` — Export `Sessions` class and all public types
- `packages/core/src/client.ts` — Sessions receives `HttpClient` instance via constructor

</code_context>

<specifics>
## Specific Ideas

- Sessions is a pure HTTP module — no file uploads, no presigned URLs. Uses HttpClient.get/post/patch directly.
- The retrieve() response is the most complex shape in the SDK (deeply nested analysisData) — full Zod typing here validates the approach before Phase 4's similarly complex DocumentScanResult.
- Pagination wrapper `{ data, total?, hasMore?, limit, offset }` should be a reusable generic type (e.g., `PaginatedResponse<T>`) since future list methods may use it.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-sessions-module*
*Context gathered: 2026-04-05*
