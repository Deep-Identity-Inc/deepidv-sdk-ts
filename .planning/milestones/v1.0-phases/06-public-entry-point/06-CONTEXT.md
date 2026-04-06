# Phase 6: Public Entry Point - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

The `DeepIDV` class as the single public entry point for `@deepidv/server`. It takes config (apiKey, baseUrl, timeout, retries), validates with Zod, creates HttpClient + FileUploader + all module instances eagerly, and exposes them as typed namespace properties (`client.sessions`, `client.document`, `client.face`, `client.identity`). The barrel export is trimmed to expose only DeepIDV, types, errors, and Zod schemas — module classes become internal. Full JSDoc with `@example` blocks on every public method across the codebase. Zero `any` enforcement. Explicit named exports only.

</domain>

<decisions>
## Implementation Decisions

### Export Surface
- **D-01:** Only the `DeepIDV` class, type definitions, error classes, and Zod schemas are exported from `@deepidv/server`. Module classes (`Sessions`, `Document`, `Face`, `Identity`) become internal — consumers access them only through `client.sessions`, `client.document`, etc.
- **D-02:** Zod schemas (e.g., `SessionCreateInputSchema`, `DocumentScanResultSchema`) remain exported for consumer-side validation, testing fixtures, and extending. Low maintenance cost, high utility.
- **D-03:** No wildcard re-exports. Every export is an explicit named export (API-05).

### Config Validation
- **D-04:** `DeepIDV` constructor validates config using a Zod schema (`DeepIDVConfigSchema`). Validates apiKey is non-empty string, baseUrl is valid URL if provided, timeout/retries are positive numbers. Consistent with how every other public input is validated in the SDK.
- **D-05:** Config validation throws `ValidationError` synchronously before any network call (API-02 success criterion).

### Module Instantiation
- **D-06:** All module instances (`Sessions`, `Document`, `Face`, `Identity`) are created eagerly in the `DeepIDV` constructor. No lazy initialization. Constructor is cheap (no I/O) — just wiring `HttpClient` and `FileUploader` into each module.
- **D-07:** `DeepIDV` constructor creates one `HttpClient` and one `FileUploader` instance, shared across all modules. Matches the existing constructor injection pattern (Phase 4 D-04).

### JSDoc Coverage
- **D-08:** Every public method, parameter, and return type gets full JSDoc: description, `@param`, `@returns`, `@throws`, and a short `@example` block showing real usage. Visible in IDE hover tooltips.
- **D-09:** JSDoc is added to the new `DeepIDV` class AND backfilled onto existing module methods (`Sessions.create`, `Document.scan`, `Face.detect`, `Face.compare`, `Face.estimateAge`, `Identity.verify`). Since consumers access them via `client.sessions.create()`, JSDoc must live on the underlying methods for IDE tooltips to work.

### Claude's Discretion
- Internal wiring details: how exactly `DeepIDV` creates and passes `HttpClient`/`FileUploader` to modules
- Whether to add a `VERSION` export from `@deepidv/server` (core already has one)
- Grouping and ordering of exports in the trimmed barrel file

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Build Guide
- `deepidv-sdk-build-guide.md` — Full type definitions for every module input/output, presigned upload flow, session response shapes, and all architectural decisions

### Core Package
- `packages/core/src/config.ts` — `DeepIDVConfig` interface and `resolveConfig()` function (the config shape DeepIDV wraps)
- `packages/core/src/index.ts` — Core barrel exports (HttpClient, FileUploader, errors, events, config)

### Server Package
- `packages/server/src/index.ts` — Current barrel exports (will be trimmed per D-01)
- `packages/server/src/sessions.ts` — Sessions class (needs JSDoc backfill)
- `packages/server/src/document.ts` — Document class (needs JSDoc backfill)
- `packages/server/src/face.ts` — Face class (needs JSDoc backfill)
- `packages/server/src/identity.ts` — Identity class (needs JSDoc backfill)

### Requirements
- `.planning/REQUIREMENTS.md` §Public API Surface — API-01 through API-05

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `resolveConfig()` in `packages/core/src/config.ts` — already resolves defaults for all config fields; DeepIDV constructor calls this after Zod validation
- `HttpClient` in `packages/core/src/client.ts` — takes `ResolvedConfig`, used by all modules
- `FileUploader` in `packages/core/src/uploader.ts` — takes config subset, used by Document, Face, Identity modules
- `mapZodError()` in `packages/core/src/uploader.ts` — converts Zod errors to `ValidationError`, reusable for config validation

### Established Patterns
- Constructor injection: all module classes take `(client: HttpClient, uploader?: FileUploader)` — Sessions only needs HttpClient, others need both
- Zod validation before network calls on every public method
- `z.object().strip()` for response parsing (forward-compatible)
- `z.infer<>` as single type source

### Integration Points
- `DeepIDV` class goes in `packages/server/src/deepidv.ts` (new file)
- `packages/server/src/index.ts` barrel is rewritten to export DeepIDV + types + schemas only
- Existing module files unchanged except for JSDoc additions

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-public-entry-point*
*Context gathered: 2026-04-06*
