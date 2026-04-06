# Phase 1: Core Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 01-core-infrastructure
**Areas discussed:** Retry & timeout behavior, Error class design, Event emitter contract, HTTP client extensibility

---

## Retry & Timeout Behavior

### Timeout scope

| Option | Description | Selected |
|--------|-------------|----------|
| Per-attempt | Each individual request gets the full timeout window | ✓ |
| Overall | Single timeout budget shared across all retries | |
| Both | Per-attempt + optional overall cap | |

**User's choice:** Per-attempt
**Notes:** Simpler mental model, matches Stripe/OpenAI SDKs.

### Retry-After header handling

| Option | Description | Selected |
|--------|-------------|----------|
| Honor it | Wait the server-specified duration instead of computed backoff | |
| Ignore it | Always use computed backoff | |
| Honor with cap | Respect Retry-After but cap at 60s max | ✓ |

**User's choice:** Honor with 60s cap
**Notes:** "You don't want a rogue server header making someone's SDK call wait 10 minutes."

### Default retry config

| Option | Description | Selected |
|--------|-------------|----------|
| 3 retries, 500ms initial delay | Industry standard, matches Stripe SDK | ✓ |
| 2 retries, 1s initial delay | Fewer attempts, longer gaps | |
| You decide | Claude's discretion | |

**User's choice:** 3 retries, 500ms initial delay

### Retry event timing

| Option | Description | Selected |
|--------|-------------|----------|
| Before sleeping | "about to retry in 2s" — caller can log/act before wait | ✓ |
| After sleeping | "retrying now" | |
| Both | retry-scheduled + retry-firing | |

**User's choice:** Before sleeping

---

## Error Class Design

### API key redaction

| Option | Description | Selected |
|--------|-------------|----------|
| Last 4 chars only | `"sk_...a1b2"` — matches Stripe pattern | ✓ |
| Fully hidden | `"[REDACTED]"` | |
| First 4 + last 4 | `"sk_t...a1b2"` | |

**User's choice:** Last 4 chars only

### Raw response on errors

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, on `.response` property | Status, headers, and body for debugging | ✓ |
| No | Just status code and parsed message | |
| You decide | Claude's discretion | |

**User's choice:** Yes, raw response on `.response` property

### Cause chaining

| Option | Description | Selected |
|--------|-------------|----------|
| Native `Error.cause` | ES2022 standard, Node 16.9+ | ✓ |
| Custom `.originalError` | More explicit property name | |
| You decide | Claude's discretion | |

**User's choice:** Native `Error.cause`
**Notes:** "You're targeting ES2022 anyway"

### JSON serialization

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, `toJSON()` | `JSON.stringify(error)` produces clean object | ✓ |
| No | Standard Error behavior | |

**User's choice:** Yes, `toJSON()`
**Notes:** "Structured logging is table stakes"

---

## Event Emitter Contract

### Listener execution model

| Option | Description | Selected |
|--------|-------------|----------|
| Synchronous, fire-and-forget | Listeners run inline, errors swallowed | ✓ |
| Async with `Promise.allSettled` | Await all listeners, never reject | |
| Sync with optional async | Sync default, `emitAsync()` variant | |

**User's choice:** Synchronous, fire-and-forget

### Listener error handling

| Option | Description | Selected |
|--------|-------------|----------|
| Swallow and emit warning event | Never let a listener crash the SDK call | ✓ |
| Swallow silently | Ignore entirely | |
| Propagate | Let it bubble up | |

**User's choice:** Swallow and emit warning event

### `once()` support

| Option | Description | Selected |
|--------|-------------|----------|
| Yes | Standard pattern, developers expect it | ✓ |
| No | Keep surface minimal, only `on()` and `off()` | |

**User's choice:** Yes

### Unsubscribe pattern

| Option | Description | Selected |
|--------|-------------|----------|
| `on()` returns unsubscribe function | `const unsub = client.on('retry', fn); unsub();` | ✓ |
| `off(event, fn)` | Traditional EventEmitter pattern | |
| No removal | Listeners live for client lifetime | |

**User's choice:** `on()` returns unsubscribe function
**Notes:** "This is the modern pattern and way cleaner than off(event, fn)"

---

## Claude's Discretion

No areas deferred to Claude's discretion — all questions were answered directly.

## Deferred Ideas

None — discussion stayed within phase scope.
