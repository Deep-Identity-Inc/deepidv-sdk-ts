# Phase 1: Core Infrastructure - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Monorepo scaffold with pnpm workspaces (`@deepidv/core` + `@deepidv/server`), a native-fetch HTTP client with API key auth and retry logic, a typed error hierarchy, a typed event emitter, and runtime compatibility across Node 18+, Deno, Bun, and Cloudflare Workers. No file uploads, no service modules, no public entry point assembly — those are later phases.

</domain>

<decisions>
## Implementation Decisions

### Retry & Timeout Behavior
- **D-01:** Timeout scope is **per-attempt** — each individual request gets the full timeout window (e.g., 30s per try x 3 retries = up to 90s total). Simpler mental model, matches Stripe/OpenAI SDKs.
- **D-02:** **Honor `Retry-After` header with a 60-second cap.** If the API sends `Retry-After: 5`, wait 5s instead of computed backoff. If `Retry-After` exceeds 60s, cap at 60s — prevents a rogue server header from making an SDK call wait indefinitely.
- **D-03:** Default retry config: **3 retries, 500ms initial delay.** Industry standard, matches Stripe SDK.
- **D-04:** Retry events fire **before sleeping** — "about to retry in 2s" pattern. Allows callers to log or act before the wait happens.

### Error Class Design
- **D-05:** API key redaction uses **last 4 chars only** — `"sk_...a1b2"`. Enough to identify which key without exposing it. Matches Stripe pattern.
- **D-06:** Errors carry the **raw response on a `.response` property** — includes status, headers, and body. Invaluable for debugging API issues.
- **D-07:** Error cause chaining uses **native `Error.cause`** (ES2022 standard). Target is Node 18+ so this is fully supported.
- **D-08:** `DeepIDVError` implements **`toJSON()`** for structured logging — `JSON.stringify(error)` produces a clean object with type, message, status, code.

### Event Emitter Contract
- **D-09:** Listeners execute **synchronously, fire-and-forget**. Keeps the emitter non-blocking per EVT-02.
- **D-10:** If a listener throws, **swallow the error and emit a warning event**. Never let a listener crash the SDK call.
- **D-11:** Emitter supports **`once()`** — standard pattern, developers expect it.
- **D-12:** `on()` returns an **unsubscribe function** — `const unsub = client.on('retry', fn); unsub();`. Modern pattern, no need to pass the same function reference back via `off()`.

### HTTP Client Extensibility
- **D-13:** `HttpClient` accepts an **optional custom `fetch` in config** — `new DeepIDV({ apiKey, fetch: myFetch })`. Essential for testing, Cloudflare Workers service bindings, and proxy setups.
- **D-14:** **No request/response interceptors in v1.** The event emitter covers observability. Interceptors add API surface without a v1 use case — defer to v2 if needed.
- **D-15:** Base URL joining uses **simple string concat with normalization** — strip trailing slash from base, ensure leading slash on path. Predictable, no URL constructor edge cases.
- **D-16:** Advanced debugging is **already covered** by the event emitter (lifecycle events) and error `.response` property. No additional debug mode needed.

### Claude's Discretion
- None — all areas discussed and decided.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Build & Architecture
- `deepidv-sdk-build-guide.md` — Full type definitions for every module input/output, presigned upload flow, session response shapes, repo structure, and all architectural decisions. Primary implementation reference.

### Project & Requirements
- `.planning/PROJECT.md` — Project vision, constraints, key decisions, and out-of-scope items.
- `.planning/REQUIREMENTS.md` — Phase 1 requirements: BUILD-01 through BUILD-05, HTTP-01 through HTTP-04, ERR-01 through ERR-06, EVT-01, EVT-02, COMPAT-01 through COMPAT-04.
- `.planning/ROADMAP.md` — Phase 1 success criteria and dependency chain.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project. No existing source code.

### Established Patterns
- None — patterns will be established by this phase. The build guide (`deepidv-sdk-build-guide.md`) defines the target file structure and module layout.

### Integration Points
- `packages/core/src/` — All Phase 1 code lives here (client.ts, auth.ts, config.ts, errors.ts, retry.ts, events.ts, index.ts)
- `packages/server/src/` — Will depend on core but Phase 1 only needs the package scaffold and build config, not service modules

</code_context>

<specifics>
## Specific Ideas

- Retry-After cap at 60s was specifically chosen to prevent "a rogue server header making someone's SDK call wait 10 minutes"
- Unsubscribe-function pattern for events was chosen as "the modern pattern and way cleaner than off(event, fn)"
- Stripe SDK referenced as the benchmark for retry defaults and key redaction patterns

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-core-infrastructure*
*Context gathered: 2026-04-05*
