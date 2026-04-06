# Phase 6: Public Entry Point - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 06-public-entry-point
**Areas discussed:** Export surface design, Config validation approach, JSDoc depth & examples

---

## Export Surface Design

### Q1: Module class visibility

| Option | Description | Selected |
|--------|-------------|----------|
| DeepIDV + types only | Only export DeepIDV class, type definitions, error classes, and Zod schemas. Module classes become internal. Cleaner public API, prevents misuse. | ✓ |
| Everything stays exported | Keep current exports: DeepIDV class, all module classes, all types, all schemas. Power users can instantiate modules directly. | |
| DeepIDV + types + schemas | Export DeepIDV, types, errors, and Zod schemas, but hide module classes. | |

**User's choice:** DeepIDV + types only
**Notes:** Module classes (Sessions, Document, Face, Identity) become internal — only accessible via client.sessions, client.document, etc.

### Q2: Zod schema exports

| Option | Description | Selected |
|--------|-------------|----------|
| Keep schemas exported | Consumers can import schemas for custom validation, testing fixtures, or extending. Common SDK pattern. | ✓ |
| Hide schemas too | Only types and the DeepIDV class are public. Schemas are internal implementation details. | |

**User's choice:** Keep schemas exported
**Notes:** Schemas remain public alongside types and errors, even though module classes go internal.

---

## Config Validation Approach

### Q3: Validation method

| Option | Description | Selected |
|--------|-------------|----------|
| Zod schema | Define DeepIDVConfigSchema with zod. Validates apiKey, baseUrl, timeout, retries. Consistent with rest of SDK. | ✓ |
| Simple runtime checks | Just check if config.apiKey exists. No Zod schema. | |
| You decide | Claude picks the approach. | |

**User's choice:** Zod schema
**Notes:** Consistent with how every other public input is validated in the SDK.

### Q4: Module instantiation timing

| Option | Description | Selected |
|--------|-------------|----------|
| Eager | All modules created in the constructor. Simple, predictable. Constructor is cheap (no I/O). | ✓ |
| Lazy on first access | Use getters that create instances on first property access. | |

**User's choice:** Eager
**Notes:** No lazy-init complexity. Constructor just wires objects.

---

## JSDoc Depth & Examples

### Q5: JSDoc depth

| Option | Description | Selected |
|--------|-------------|----------|
| Signatures + @example | Every public method gets description, @param, @returns, @throws, and a short @example block. | ✓ |
| Signatures only | Description, @param, @returns, @throws — no @example blocks. | |
| You decide | Claude picks the right depth per method. | |

**User's choice:** Signatures + @example
**Notes:** Full JSDoc with examples visible in IDE hover tooltips.

### Q6: JSDoc scope

| Option | Description | Selected |
|--------|-------------|----------|
| DeepIDV + all public methods | Add JSDoc to DeepIDV class AND backfill onto Sessions, Document, Face, Identity methods. | ✓ |
| DeepIDV class only | Only document the new DeepIDV class. Existing methods keep current JSDoc. | |

**User's choice:** DeepIDV + all public methods
**Notes:** Since consumers access via client.sessions.create(), JSDoc must live on the underlying methods for IDE tooltips to work.

---

## Claude's Discretion

- Internal wiring details (how DeepIDV creates and passes HttpClient/FileUploader)
- Whether to add a VERSION export from @deepidv/server
- Grouping and ordering of exports in the trimmed barrel file

## Deferred Ideas

None — discussion stayed within phase scope.
