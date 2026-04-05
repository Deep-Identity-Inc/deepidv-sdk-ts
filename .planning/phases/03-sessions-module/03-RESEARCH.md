# Phase 3: Sessions Module - Research

**Researched:** 2026-04-05
**Domain:** TypeScript SDK service module — Zod schema design, class-based DI, HTTP CRUD, pagination wrapper
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Service modules use class with constructor injection — `class Sessions { constructor(private client: HttpClient) {} }`. Standard SDK pattern (Stripe, OpenAI). Modules receive HttpClient via constructor. Easy to test (inject mock client), clear ownership.
- **D-02:** This pattern is the template for all future modules (document, face, identity). Each gets its own class with the same constructor signature.
- **D-03:** Zod schemas go full depth — type every field the build guide defines, all the way down to `analysisData.idAnalysisData.idExtractedText[0].value`, `compareFacesData.faceMatchConfidence`, `pepSanctionsData`, etc.
- **D-04:** `z.infer<>` remains the single source of truth for TypeScript types (carried forward from Phase 2, D-11). No separate interface definitions.
- **D-05:** `sessions.list()` returns a wrapper with pagination metadata: `{ data: Session[], total?: number, hasMore?: boolean, limit: number, offset: number }`. If the API returns a raw array, the SDK wraps it.
- **D-06:** This pagination wrapper pattern applies to any future list method across modules.
- **D-07:** Service modules live flat in `packages/server/src/` — `sessions.ts` + `sessions.types.ts`. Matches the build guide's file tree exactly.
- **D-08:** Types file (`sessions.types.ts`) contains all Zod schemas and inferred types for the module. Module file (`sessions.ts`) imports from the types file.
- **D-09:** Pattern extends to future modules: `document.ts` + `document.types.ts`, `face.ts` + `face.types.ts`, `identity.ts` + `identity.types.ts`.

### Claude's Discretion

- None — all areas discussed and decided.

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SESS-01 | `client.sessions.create()` — create hosted verification session with typed input/output | `SessionCreateInputSchema` + `SessionCreateResultSchema` + `Sessions.create()` calling `POST /v1/sessions` |
| SESS-02 | `client.sessions.retrieve()` — retrieve full session with all analysis data and presigned resource URLs | `SessionRetrieveResultSchema` (deeply nested) + `Sessions.retrieve(id)` calling `GET /v1/sessions/{id}` |
| SESS-03 | `client.sessions.list()` — list sessions with pagination (limit, offset) and status filter | `SessionListParamsSchema` + `PaginatedResponse<Session>` wrapper + `Sessions.list()` calling `GET /v1/sessions` |
| SESS-04 | `client.sessions.updateStatus()` — update session status (VERIFIED, REJECTED, VOIDED), compile-time rejection of invalid values | `SessionStatusEnum` literal union in Zod + `Sessions.updateStatus(id, status)` calling `PATCH /v1/sessions/{id}` |

</phase_requirements>

---

## Summary

Phase 3 is the first end-to-end service module in the SDK. It introduces the class-with-constructor-injection pattern that all future modules (document, face, identity) will replicate exactly. Because this is pure HTTP JSON — no file uploads — it is the cleanest possible first module: every line of code here is the boilerplate skeleton for Phases 4-6.

The most technically interesting part is the `retrieve()` response schema. The `analysisData` subtree is deeply nested and contains optional sub-objects (`idAnalysisData`, `compareFacesData`, `pepSanctionsData`, `adverseMediaData`, `documentRiskData`) that each have their own array types. Writing this in Zod with full depth (D-03) is the primary complexity of the phase. The `list()` pagination wrapper and the `updateStatus()` status literal union are straightforward.

The existing codebase already provides everything needed: `HttpClient` with `get`/`post`/`patch` methods, `mapZodError` from `uploader.ts` for Zod-to-ValidationError mapping, the `ValidationError` class, and the msw/vitest test pattern from Phase 2 tests. Phase 3 consumes these rather than building anything new in `@deepidv/core`.

**Primary recommendation:** Write `sessions.types.ts` first (all Zod schemas), then `sessions.ts` (Sessions class using HttpClient), then update `packages/server/src/index.ts` to export both, then write tests in `packages/server/src/__tests__/sessions.test.ts`.

---

## Standard Stack

### Core (all inherited from Phases 1-2 — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | 4.3.6 (installed) | Schema definition + type inference | D-03, D-04, VAL-03: `z.infer<>` is the single source of truth for types. Already the only production dependency. |
| TypeScript | 6.0.2 (installed) | Language | strict mode, zero `any`, full JSDoc. Already configured. |
| vitest | installed | Test runner | ESM-native, used in `@deepidv/core` tests already. |
| msw | installed | HTTP mocking | `setupServer` + `http.*` handlers already used in `setup.ts` and `client.test.ts`. |

No new packages to install for Phase 3.

### Reusable Assets from Existing Code

| Asset | Location | How Phase 3 Uses It |
|-------|----------|---------------------|
| `HttpClient` | `packages/core/src/client.ts` | Sessions class receives it via constructor (D-01). Call `.get()`, `.post()`, `.patch()` directly. |
| `mapZodError` | `packages/core/src/uploader.ts` | Maps `ZodError` to `ValidationError` on input validation failure (D-12 from Phase 2). |
| `ValidationError` | `packages/core/src/errors.ts` | Thrown when caller passes invalid input (e.g., empty `sessionId`, bad status value). |
| `setupServer` / msw pattern | `packages/core/src/__tests__/setup.ts` | Create equivalent `setup.ts` in `packages/server/src/__tests__/` for sessions tests. |

---

## Architecture Patterns

### Recommended Project Structure (Phase 3 additions)

```
packages/server/src/
├── index.ts                      # existing — add Sessions + type exports
├── sessions.ts                   # NEW — Sessions class
├── sessions.types.ts             # NEW — all Zod schemas + z.infer types
└── __tests__/
    ├── setup.ts                  # NEW — msw setupServer (mirrors core pattern)
    └── sessions.test.ts          # NEW — unit tests for Sessions class
```

Note: CONTEXT.md D-07 specifies flat layout in `packages/server/src/` — NOT in a `modules/` or `types/` subdirectory. The build guide shows a `modules/` subdirectory in the future-state file tree, but the CONTEXT.md decision overrides this for v1. Use the flat layout.

### Pattern 1: Sessions Class (Constructor Injection)

**What:** A plain class that receives `HttpClient` via constructor. Each public method validates inputs with Zod, calls HttpClient, and returns typed results.

**When to use:** All service modules.

```typescript
// packages/server/src/sessions.ts
import { z } from 'zod';
import type { HttpClient } from '@deepidv/core';
import { mapZodError } from '@deepidv/core';
import {
  SessionCreateInputSchema,
  SessionListParamsSchema,
  SessionStatusUpdateSchema,
  type SessionCreateResult,
  type SessionRetrieveResult,
  type PaginatedResponse,
  type Session,
} from './sessions.types.js';

export class Sessions {
  constructor(private readonly client: HttpClient) {}

  async create(input: z.input<typeof SessionCreateInputSchema>): Promise<SessionCreateResult> {
    let validated: z.infer<typeof SessionCreateInputSchema>;
    try {
      validated = SessionCreateInputSchema.parse(input);
    } catch (err) {
      if (err instanceof z.ZodError) throw mapZodError(err);
      throw err;
    }
    return this.client.post<SessionCreateResult>('/v1/sessions', validated);
  }

  async retrieve(sessionId: string): Promise<SessionRetrieveResult> {
    // Validate sessionId is a non-empty string
    if (typeof sessionId !== 'string' || sessionId.trim() === '') {
      throw new ValidationError("expected non-empty string at 'sessionId'");
    }
    return this.client.get<SessionRetrieveResult>(`/v1/sessions/${sessionId}`);
  }

  async list(params?: z.input<typeof SessionListParamsSchema>): Promise<PaginatedResponse<Session>> {
    let validated: z.infer<typeof SessionListParamsSchema>;
    try {
      validated = SessionListParamsSchema.parse(params ?? {});
    } catch (err) {
      if (err instanceof z.ZodError) throw mapZodError(err);
      throw err;
    }
    // Build query string from params
    const qs = buildQueryString(validated);
    const raw = await this.client.get<Session[] | PaginatedResponse<Session>>(
      `/v1/sessions${qs}`,
    );
    // Wrap raw array if API returns one (D-05)
    return wrapPaginated(raw, validated);
  }

  async updateStatus(
    sessionId: string,
    status: z.infer<typeof SessionStatusSchema>,
  ): Promise<SessionRetrieveResult> {
    // validate both args
    return this.client.patch<SessionRetrieveResult>(`/v1/sessions/${sessionId}`, { status });
  }
}
```

### Pattern 2: Types File (Zod Schemas + z.infer)

**What:** All Zod schemas and inferred TypeScript types live in `sessions.types.ts`. The module file (`sessions.ts`) imports types from here. `z.infer<typeof Schema>` is the ONLY source of TypeScript types — no separate `interface` or `type` aliases that duplicate schema structure (D-04).

**When to use:** Every module in the SDK.

```typescript
// packages/server/src/sessions.types.ts
import { z } from 'zod';

// ---- Enums used across multiple schemas ----
export const SessionStatusSchema = z.enum([
  'PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'VOIDED',
]);

export const SessionTypeSchema = z.enum([
  'session', 'verification', 'credit-application', 'silent-screening', 'deep-doc',
]);

export const SessionProgressSchema = z.enum(['PENDING', 'STARTED', 'COMPLETED']);

// ---- create() input ----
export const SessionCreateInputSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),           // E.164 format — min validation only, API validates format
  externalId: z.string().optional(),
  workflowId: z.string().optional(),
  redirectUrl: z.string().url().optional(),
  sendEmailInvite: z.boolean().optional(),
  sendPhoneInvite: z.boolean().optional(),
});
export type SessionCreateInput = z.infer<typeof SessionCreateInputSchema>;

// ---- create() result ----
export const SessionCreateResultSchema = z.object({
  id: z.string(),
  sessionUrl: z.string(),
  externalId: z.string().optional(),
  links: z.array(z.object({
    url: z.string(),
    type: z.string(),
  })),
});
export type SessionCreateResult = z.infer<typeof SessionCreateResultSchema>;

// ---- Nested sub-schemas for retrieve() ----
const FaceDetectionSchema = z.object({
  // Shape from build guide (FaceDetection sub-type used in idAnalysisData)
  confidence: z.number().optional(),
  boundingBox: z.object({
    top: z.number(), left: z.number(), width: z.number(), height: z.number(),
  }).optional(),
}).passthrough(); // passthrough for fields not yet documented

const ExtractedTextItemSchema = z.object({
  type: z.string(),
  value: z.string(),
  confidence: z.number(),
});

const IdAnalysisDataSchema = z.object({
  detectFaceData: z.array(FaceDetectionSchema),
  idExtractedText: z.array(ExtractedTextItemSchema),
  expiryDatePass: z.boolean(),
  validStatePass: z.boolean(),
  ageRestrictionPass: z.boolean(),
}).optional();

const CompareFacesDataSchema = z.object({
  faceMatchConfidence: z.number(),
  faceMatchResult: z.record(z.unknown()),
}).optional();

const PepMatchSchema = z.object({
  // Fields not fully documented in build guide — use passthrough
}).passthrough();

const SanctionMatchSchema = z.object({}).passthrough();

const PepSanctionsDataSchema = z.object({
  peps: z.array(PepMatchSchema).nullable(),
  sanctions: z.array(SanctionMatchSchema).nullable(),
  both: z.array(PepMatchSchema).nullable(),
}).optional();

const AdverseMediaDataSchema = z.object({
  totalHits: z.number(),
  newsExposures: z.record(z.unknown()),
  timestamp: z.string(),
}).optional();

const DocumentRiskAnalysisSchema = z.object({}).passthrough();
const DocumentRiskDataSchema = z.object({
  overallRiskScore: z.number(),
  documentsAnalyzed: z.number(),
  documentsWithSignals: z.number(),
  documentAnalysis: z.array(DocumentRiskAnalysisSchema),
}).optional();

const AnalysisDataSchema = z.object({
  createdAt: z.string(),
  idMatchesSelfie: z.boolean().optional(),
  facelivenessScore: z.number().optional(),
  idAnalysisData: IdAnalysisDataSchema,
  secondaryIdAnalysisData: z.unknown().optional(),
  tertiaryIdAnalysisData: z.unknown().optional(),
  compareFacesData: CompareFacesDataSchema,
  pepSanctionsData: PepSanctionsDataSchema,
  adverseMediaData: AdverseMediaDataSchema,
  documentRiskData: DocumentRiskDataSchema,
  titleSearchData: z.unknown().optional(),
  customFormData: z.array(z.object({
    question: z.string(),
    answer: z.string(),
    type: z.string(),
  })).optional(),
}).optional();

const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).optional();

// ---- Session (used in list() data array) ----
export const SessionSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  senderUserId: z.string(),
  externalId: z.string().optional(),
  status: SessionStatusSchema,
  type: SessionTypeSchema,
  sessionProgress: SessionProgressSchema,
  location: z.object({ country: z.string() }).optional(),
  workflowId: z.string().optional(),
  workflowSteps: z.array(z.string()).optional(),
  bankStatementRequestId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  submittedAt: z.string().optional(),
  metaData: z.object({
    applicantSubmissionIp: z.string().optional(),
    applicantSubmissionDevice: z.string().optional(),
    applicantViewTime: z.string().optional(),
    applicantSubmissionBrowser: z.string().optional(),
  }).optional(),
  uploads: z.record(z.boolean()).optional(),
  analysisData: AnalysisDataSchema,
});
export type Session = z.infer<typeof SessionSchema>;

// ---- retrieve() result ----
export const SessionRetrieveResultSchema = z.object({
  sessionRecord: SessionSchema,
  user: UserSchema,
  senderUser: UserSchema,
  resourceLinks: z.record(z.string()).optional(),
});
export type SessionRetrieveResult = z.infer<typeof SessionRetrieveResultSchema>;

// ---- list() params ----
export const SessionListParamsSchema = z.object({
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
  status: SessionStatusSchema.optional(),
});
export type SessionListParams = z.infer<typeof SessionListParamsSchema>;

// ---- Pagination wrapper (reusable generic — D-05, D-06) ----
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    total: z.number().optional(),
    hasMore: z.boolean().optional(),
    limit: z.number(),
    offset: z.number(),
  });
export type PaginatedResponse<T> = {
  data: T[];
  total?: number;
  hasMore?: boolean;
  limit: number;
  offset: number;
};

// ---- updateStatus() — only VERIFIED/REJECTED/VOIDED are valid (SESS-04) ----
export const SessionStatusUpdateSchema = z.enum(['VERIFIED', 'REJECTED', 'VOIDED']);
export type SessionStatusUpdate = z.infer<typeof SessionStatusUpdateSchema>;
```

### Pattern 3: Index Barrel Update

**What:** `packages/server/src/index.ts` must export the `Sessions` class and all public types. Keep exports named and explicit (no `export * from` — API-05 requirement).

```typescript
// packages/server/src/index.ts — additions
export { Sessions } from './sessions.js';
export type {
  SessionCreateInput,
  SessionCreateResult,
  Session,
  SessionRetrieveResult,
  SessionListParams,
  SessionStatusUpdate,
  PaginatedResponse,
} from './sessions.types.js';
```

### Pattern 4: Test Structure (mirrors core pattern)

**What:** Create `packages/server/src/__tests__/setup.ts` identical to core's setup, then write `sessions.test.ts` that injects a mock HttpClient (or uses msw).

**Two valid approaches for Sessions tests:**

1. **Mock HttpClient directly** — Create a mock object with vi.fn() for get/post/patch. Simpler for unit testing the Sessions class logic (Zod validation, URL construction, pagination wrapping). Does not test HTTP layer.

2. **Use msw + real HttpClient** — Create a real HttpClient with resolveConfig, use msw to intercept fetch. Tests the full path including error mapping. More faithful to integration behavior. This is the pattern already established in `core/__tests__/client.test.ts`.

**Recommendation:** Use msw + real HttpClient (approach 2), consistent with Phase 2 tests. The `setup.ts` file already demonstrates the pattern.

```typescript
// packages/server/src/__tests__/setup.ts
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';

export const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Anti-Patterns to Avoid

- **Separate `interface` declarations alongside Zod schemas:** If a Zod schema exists, never write `interface SessionCreateResult { ... }` — use `type SessionCreateResult = z.infer<typeof SessionCreateResultSchema>` only (D-04).
- **Wildcard re-exports from index.ts:** `export * from './sessions.js'` is forbidden. Use named exports only (API-05).
- **Modules subdirectory:** Context D-07 explicitly places files flat in `packages/server/src/`, not in `src/modules/` or `src/types/`. Do not create subdirectories.
- **HttpClient imported as concrete class in sessions.ts:** Import as `import type { HttpClient }` to keep the type-only import, or inject via constructor parameter typed as `HttpClient`. Do not reference `resolveConfig` or `TypedEmitter` inside `sessions.ts` — those belong in the main client class (Phase 6).
- **Parsing API responses with Zod:** Do NOT call `SessionRetrieveResultSchema.parse(response)` inside `retrieve()`. The Zod schemas are for INPUT validation only (Zod validates developer inputs before the network call). The return type annotation on `this.client.get<SessionRetrieveResult>(...)` provides compile-time safety; runtime response parsing is not done in v1 (would break on undocumented API fields).
- **Using `.strict()` on response schemas:** This would cause runtime errors when the API adds new fields. Use `.passthrough()` on sub-objects with undocumented fields.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Zod-to-ValidationError mapping | Custom error mapper | `mapZodError` from `@deepidv/core` | Already built in Phase 2, handles path info, edge cases handled |
| HTTP error class mapping | Custom switch/if in sessions.ts | `HttpClient.get/post/patch` | HttpClient already maps 401/429/400/5xx to typed SDK errors |
| Retry logic | Custom retry in sessions.ts | `HttpClient` (wraps `withRetry`) | Retry is in `withRetry`, already called by all HttpClient methods |
| Query string building | URLSearchParams wrapper | `URLSearchParams` directly | Native API, works on all runtimes, no abstraction needed |
| Status enum validation | Custom string guard | `z.enum(['VERIFIED', 'REJECTED', 'VOIDED'])` | Zod handles compile-time + runtime rejection of non-enumerated values (SESS-04) |

**Key insight:** Sessions is a pure consumer of Phase 1 and Phase 2 infrastructure. It should contain zero infrastructure code — only schemas, a class, and HTTP method calls.

---

## Common Pitfalls

### Pitfall 1: Zod Response Parsing Breaks on New API Fields

**What goes wrong:** `schema.parse(response)` inside `retrieve()` or `create()` throws when the API returns a new field not in the schema.

**Why it happens:** `.strict()` schemas (or default Zod behavior in some versions) strip unknown keys. If you call `parse()` on the API response and the API adds a field, existing SDK users get a runtime error.

**How to avoid:** Only call `schema.parse()` on developer inputs (before the network call). For API responses, use TypeScript generic typing (`this.client.get<SessionRetrieveResult>(...)`) which provides compile-time safety without runtime validation that could break on API changes. Use `.passthrough()` on sub-objects where future fields are expected.

**Warning signs:** Any `schema.parse(await response.json())` pattern in service module files.

### Pitfall 2: `updateStatus()` Accepts Invalid Status Values at Runtime

**What goes wrong:** If `updateStatus(id, status)` accepts `status: string` rather than the Zod-narrowed literal union, TypeScript won't catch invalid values like `"PENDING"` (which is not a valid update target per the build guide).

**Why it happens:** Lazy typing — using `string` instead of `z.infer<typeof SessionStatusUpdateSchema>`.

**How to avoid:** The parameter type must be `z.infer<typeof SessionStatusUpdateSchema>` which resolves to `'VERIFIED' | 'REJECTED' | 'VOIDED'`. Validate at runtime too by calling `SessionStatusUpdateSchema.parse(status)` before the PATCH call. This ensures the TypeScript type and runtime behavior agree (SESS-04).

**Warning signs:** `status: string` in the `updateStatus()` signature.

### Pitfall 3: Missing `passWithNoTests` in server vitest config

**What goes wrong:** If `packages/server/vitest.config.ts` does not have `passWithNoTests: true` and Phase 3 tests are added in a partial wave, running `pnpm test` in the server package can fail on setup issues.

**Why it happens:** The existing config has `passWithNoTests: true` (confirmed from file read). This becomes relevant if a Wave creates the test file but it has no test cases yet.

**How to avoid:** Keep `passWithNoTests: true` in `packages/server/vitest.config.ts`. Add it to the Wave 0 checklist if the test file is created without test bodies.

**Warning signs:** `Error: No test files found` from vitest on the server package.

### Pitfall 4: Pagination Wrapper Shape Mismatch

**What goes wrong:** The build guide says `list()` output is "Array of session summary objects" without specifying the wrapper. If the API actually returns `{ items: [], total: N }` (not `{ data: [], total: N }`), the wrapper normalization silently returns an empty `data` array.

**Why it happens:** The API shape for list endpoints is not fully specified in the build guide.

**How to avoid:** Decision D-05 mandates the SDK wraps raw arrays. Write the `wrapPaginated` helper to handle both `Session[]` and `{ data: Session[], ... }` cases. The test suite should cover both shapes using msw response mocks. If the API returns a different wrapper key (e.g., `items`), the helper must normalize it.

**Warning signs:** `data: []` in list results despite the API returning populated sessions.

### Pitfall 5: Circular Import Between sessions.ts and sessions.types.ts

**What goes wrong:** If `sessions.ts` re-exports types and `sessions.types.ts` imports from `sessions.ts`, circular imports cause `undefined` values at module initialization.

**Why it happens:** Temptation to co-locate types directly in the module file, then split later.

**How to avoid:** `sessions.types.ts` imports from nothing in the server package — only from `zod`. `sessions.ts` imports from `sessions.types.js` only. `index.ts` imports from both. One-way dependency graph: `types → (nothing)`, `module → types`, `index → module + types`.

---

## Code Examples

### Validated Patterns from Existing Codebase

#### HttpClient injection and usage (Source: `packages/core/src/client.ts`)

```typescript
// Sessions class receives HttpClient via constructor
export class Sessions {
  constructor(private readonly client: HttpClient) {}

  async create(input: SessionCreateInput): Promise<SessionCreateResult> {
    // client.post already handles auth, retry, timeout, error mapping
    return this.client.post<SessionCreateResult>('/v1/sessions', input);
  }
}
```

#### Zod validation + mapZodError (Source: `packages/core/src/uploader.ts`)

```typescript
// Established pattern for input validation in SDK methods
export function validateUploadOptions(raw: unknown): UploadOptions {
  try {
    return UploadOptionsSchema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) throw mapZodError(err);
    throw err;
  }
}
// Phase 3 replicates this exact pattern in Sessions.create(), Sessions.list()
```

#### msw test handler (Source: `packages/core/src/__tests__/client.test.ts`)

```typescript
// Declare handler before the test or in beforeEach
server.use(
  http.post('https://api.deepidv.com/v1/sessions', () => {
    return HttpResponse.json({
      id: 'sess_abc123',
      sessionUrl: 'https://verify.deepidv.com/sess_abc123',
      links: [],
    }, { status: 200 });
  }),
);

// Test the Sessions class
it('create() returns SessionCreateResult on 200', async () => {
  const { client } = createHttpClient();
  const sessions = new Sessions(client);
  const result = await sessions.create({
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phone: '+15192223333',
  });
  expect(result.id).toBe('sess_abc123');
  expect(result.sessionUrl).toBe('https://verify.deepidv.com/sess_abc123');
});
```

#### Query string building (no library needed)

```typescript
// Native URLSearchParams — works on all runtimes
function buildQueryString(params: SessionListParams): string {
  const qs = new URLSearchParams();
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  if (params.status !== undefined) qs.set('status', params.status);
  const str = qs.toString();
  return str ? `?${str}` : '';
}
```

#### Pagination wrapping helper

```typescript
function wrapPaginated(
  raw: Session[] | PaginatedResponse<Session>,
  params: SessionListParams,
): PaginatedResponse<Session> {
  if (Array.isArray(raw)) {
    return {
      data: raw,
      limit: params.limit ?? raw.length,
      offset: params.offset ?? 0,
    };
  }
  return raw;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate `interface` types + Zod schemas | `z.infer<typeof Schema>` as sole type source | Phase 2 D-11 | No duplication; schema IS the type |
| `z.ZodError` thrown directly | `mapZodError(err)` → `ValidationError` | Phase 2 D-12 | Consistent error class hierarchy |
| Custom fetch wrapper per module | Shared `HttpClient` with built-in retry/auth | Phase 1 | Sessions gets retry, auth, events for free |

---

## Open Questions

1. **Exact API response shape for `list()`**
   - What we know: Build guide says "Array of session summary objects" — no wrapper field names documented.
   - What's unclear: Does the API return `{ data: [], total: N }` or `{ sessions: [], count: N }` or a raw array?
   - Recommendation: Write `wrapPaginated()` to handle both `Session[]` (raw array) and `{ data: Session[] }` wrapper shapes. Use msw mocks in tests to cover both. Document the assumption in code comments. The SDK normalizes to `PaginatedResponse<Session>` regardless.

2. **`SessionRetrieveResult` vs. `Session` separation**
   - What we know: `retrieve()` returns `{ sessionRecord: Session, user?, senderUser?, resourceLinks? }` — an envelope. `list()` returns session summaries (not envelopes).
   - What's unclear: Whether list items are full `Session` objects or a lighter summary shape.
   - Recommendation: Use the full `SessionSchema` for list items — if the API returns fewer fields, Zod's optional fields handle it cleanly with no runtime errors.

3. **`FaceDetection` sub-type exact shape**
   - What we know: Build guide references `Array<FaceDetection>` in `idAnalysisData.detectFaceData` but does not fully enumerate the FaceDetection fields.
   - What's unclear: Exact fields beyond `confidence` and `boundingBox`.
   - Recommendation: Use `.passthrough()` on `FaceDetectionSchema` — this allows the schema to accept unknown fields without throwing. Update the schema when Phase 4 (face module) defines the canonical `FaceDetection` type.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 3 is pure code changes (new TypeScript files + tests). No external service dependencies beyond what already exists. All tooling (pnpm, TypeScript, vitest, msw) is already installed and verified in Phases 1-2.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (version from pnpm-lock, installed) |
| Config file | `packages/server/vitest.config.ts` (exists — `passWithNoTests: true`) |
| Quick run command | `pnpm --filter @deepidv/server test` |
| Full suite command | `pnpm --filter @deepidv/server test` (same — small package) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SESS-01 | `sessions.create()` returns `SessionCreateResult` with `id`, `sessionUrl`, `links` | unit | `pnpm --filter @deepidv/server test -- sessions` | Wave 0 |
| SESS-01 | `sessions.create()` throws `ValidationError` on invalid input (missing required fields) | unit | `pnpm --filter @deepidv/server test -- sessions` | Wave 0 |
| SESS-02 | `sessions.retrieve(id)` returns full session with nested `analysisData` fields | unit | `pnpm --filter @deepidv/server test -- sessions` | Wave 0 |
| SESS-02 | `sessions.retrieve('')` throws `ValidationError` on empty string | unit | `pnpm --filter @deepidv/server test -- sessions` | Wave 0 |
| SESS-03 | `sessions.list({ limit, offset, status })` sends correct query params and returns `PaginatedResponse` | unit | `pnpm --filter @deepidv/server test -- sessions` | Wave 0 |
| SESS-03 | `sessions.list()` wraps raw array API response into `PaginatedResponse` | unit | `pnpm --filter @deepidv/server test -- sessions` | Wave 0 |
| SESS-04 | `sessions.updateStatus(id, 'VERIFIED')` sends PATCH with correct body | unit | `pnpm --filter @deepidv/server test -- sessions` | Wave 0 |
| SESS-04 | TypeScript compile error when passing `'PENDING'` to `updateStatus()` | compile-time | `pnpm --filter @deepidv/server build` (tsc errors) | manual verify |

### Sampling Rate

- **Per task commit:** `pnpm --filter @deepidv/server test`
- **Per wave merge:** `pnpm --filter @deepidv/server test && pnpm --filter @deepidv/server build`
- **Phase gate:** Full suite green + build clean before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/server/src/__tests__/setup.ts` — msw server setup (mirrors `packages/core/src/__tests__/setup.ts`)
- [ ] `packages/server/src/__tests__/sessions.test.ts` — test cases for all four SESS requirements
- [ ] Update `packages/server/vitest.config.ts` if needed to register setup file

*(No framework install needed — vitest already in server package)*

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 3 |
|-----------|-------------------|
| Runtime compatibility: Node 18+, Deno, Bun, Cloudflare Workers | Use `URLSearchParams` (native) for query string building. No `Buffer` type in sessions.ts. |
| Zero AWS SDKs | N/A — sessions module is pure JSON HTTP |
| Minimal dependencies — only zod | No new packages. Sessions uses HttpClient + zod already in place. |
| TypeScript strict: true, zero `any`, full JSDoc | Every public method needs JSDoc. No `as any`. Use `z.unknown()` or `.passthrough()` for undocumented fields instead of `any`. |
| Auth: x-api-key on every request | Inherited from HttpClient — Sessions never touches headers directly. |
| Retry policy: exponential backoff on 429/5xx only | Inherited from HttpClient. Sessions never implements retry. |
| Build output: dual ESM + CJS via tsup | Sessions files follow the `.js` extension import convention already established (e.g., `from './sessions.types.js'`). |

---

## Sources

### Primary (HIGH confidence)

- `deepidv-sdk-build-guide.md` lines 249-421 — canonical session API shapes (create input/output, retrieve output, list params, updateStatus input)
- `packages/core/src/client.ts` — HttpClient API (get/post/patch signatures, RequestOptions, constructor)
- `packages/core/src/uploader.ts` — `mapZodError` implementation, Zod validation pattern (D-10, D-11, D-12)
- `packages/core/src/errors.ts` — Error class hierarchy, ValidationError constructor
- `packages/core/src/__tests__/client.test.ts` — msw + vitest test pattern for service methods
- `.planning/phases/03-sessions-module/03-CONTEXT.md` — all architectural decisions (D-01 through D-09)
- `packages/server/vitest.config.ts` — confirms `passWithNoTests: true`, existing test config

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` — accumulated decisions: TypeScript 6.0.2, Zod 4.3.6 installed versions
- `packages/server/src/index.ts` — current barrel export shape to understand what must be added

### Tertiary (LOW confidence)

- Build guide section "Array of session summary objects" for `list()` output — exact wrapper shape unknown; API call required to confirm

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions confirmed from installed packages in STATE.md and existing code
- Architecture: HIGH — all patterns locked in CONTEXT.md, existing code provides templates
- Pitfalls: HIGH — derived from direct reading of existing code and Phase 2 decisions
- API response shapes: MEDIUM — build guide provides structure but exact list() wrapper is unspecified

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable — no external dependencies changing)
