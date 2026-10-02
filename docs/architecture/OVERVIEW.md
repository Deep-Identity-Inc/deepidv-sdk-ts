# Architecture Overview

The `@deepidv/server` SDK is a backend-first TypeScript library that wraps the [deepidv](https://api.deepidv.com) identity verification API. It runs on Node.js 20+, Deno, Bun, and Cloudflare Workers.

## Design Principles

**Thin client.** The SDK is a typed HTTP wrapper — it validates inputs, manages auth and retries, orchestrates file uploads, and returns structured results. All verification logic runs server-side at api.deepidv.com.

**Web-standards-first.** The SDK uses only native web APIs (`fetch`, `AbortController`, `ReadableStream`, `Uint8Array`, `crypto.subtle`). No Node-specific imports in the core package. This is what enables universal runtime support.

**Grouped modules.** Methods are organized by domain — `client.sessions`, `client.document`, `client.face`, `client.identity`, `client.screening`, `client.asyncJobs`, `client.deepfake`, `client.auth`, `client.workflows`, `client.workflowSessions`, `client.financial`, `client.creditTerms`, `client.creditChecks`, and `client.profiles` — matching the API structure. This gives better autocomplete and discoverability than a flat API.

**Single dependency.** The only production dependency is [zod](https://zod.dev) for runtime input validation. Zod schemas are the single source of truth for both TypeScript types and runtime checks.

## Service Patterns

| Tier                  | Pattern                                                      | Examples                                                                   |
| --------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| **Synchronous**       | One call, one result. Image in, structured data out.         | `document.scan()`, `face.detect()`, `face.compare()`, `face.estimateAge()` |
| **Orchestrated**      | One call, multiple operations coordinated server-side.       | `identity.verify()` (document scan + face detect + face compare)           |
| **Session-based**     | Create session, user completes steps, retrieve results.      | `sessions.create()`, `sessions.retrieve()`                                 |
| **Async job**         | Queue work and poll a typed handle for its result.           | `screening.adverseMedia()`, `screening.titleCheck()`                       |
| **Capture lifecycle** | Coordinate device capture with explicit resumable calls.     | `face.createLivenessSession()`, `deepfake.createUploadUrls()`              |
| **Workflow runner**   | Define workflows and resume ordered execution by session ID. | `workflows.createSession()`, `workflowSessions.submitStep()`               |

## Public API Surface

```mermaid
---
title: DeepIDV Client — Public API
---
classDiagram
    class DeepIDV {
        +sessions: Sessions
        +document: Document
        +face: Face
        +identity: Identity
        +screening: Screening
        +asyncJobs: AsyncJobs
        +deepfake: Deepfake
        +auth: Auth
        +workflows: Workflows
        +workflowSessions: WorkflowSessions
        +financial: Financial
        +creditTerms: CreditTerms
        +creditChecks: CreditChecks
        +profiles: Profiles
        +on(event, listener) () => void
        +constructor(config: DeepIDVConfig)
    }

    class Sessions {
        +create(input) SessionCreateResult
        +retrieve(sessionId) SessionRetrieveResult
        +list(params?) SessionListResult
        +updateStatus(sessionId, status) SessionStatusUpdateResult
        +createUploadUrls(sessionId, input) SessionUploadUrlsResult
    }

    class Document {
        +scan(input) DocumentScanResult
    }

    class Face {
        +detect(input) FaceDetectResult
        +compare(input) FaceCompareResult
        +estimateAge(input) FaceEstimateAgeResult
        +createLivenessSession(input?) FaceLivenessSessionResult
        +getLivenessResult(id, params?) FaceLivenessResult
    }

    class Identity {
        +verify(input) IdentityVerificationResult
    }

    class Screening {
        +pepSanctions(input) PepSanctionsResult
        +adverseMedia(input) AdverseMediaHandle
        +titleCheck(input) TitleCheckResult
        +carrierAgeGate(input) CarrierAgeGateResult
        +phoneOwnership(input) PhoneOwnershipResult
        +phoneTrust(input) PhoneTrustResult
    }

    class AsyncJobs {
        +get(jobId) AsyncJobSnapshot
    }

    class Deepfake {
        +getChallenge(sessionId) DeepfakeChallengeResult
        +createUploadUrls(input) DeepfakeUploadUrlsResult
        +analyze(input) DeepfakeAnalyzeResult
    }

    class Auth {
        +verify() AuthVerifyResult
    }

    class Workflows {
        +list() WorkflowListResult
        +create(input) WorkflowResult
        +retrieve(workflowId) WorkflowResult
        +updateStepConfig(workflowId, stepId, config) WorkflowResult
        +createSession(workflowId, input) WorkflowSessionCreateResult
    }

    class WorkflowSessions {
        +retrieve(sessionId) WorkflowSessionState
        +start(sessionId) WorkflowSessionState
        +submitStep(sessionId, stepId, input) WorkflowStepSubmitResult
    }

    class Financial {
        +create(input) FinancialCreateResult
        +list(params?) FinancialListResult
        +retrieve(id) FinancialRecord
        +listByExternalId(externalId, params?) FinancialListResult
    }

    class CreditTerms {
        +create(input) CreditTermsCreateResult
        +list(params?) CreditTermsListResult
        +retrieve(id) CreditTermsRecord
        +listByExternalId(externalId, params?) CreditTermsListResult
    }

    class CreditChecks {
        +createHard(input) CreditCheckCreateResult
        +createSoft(input) CreditCheckCreateResult
    }

    class Profiles {
        +create(input) Profile
        +list() ProfileListResult
        +retrieve(profileId) Profile
        +createLogoUploadUrl(input) ProfileLogoUploadUrlResult
        +uploadLogo(input) string
    }

    DeepIDV *-- Sessions : sessions
    DeepIDV *-- Document : document
    DeepIDV *-- Face : face
    DeepIDV *-- Identity : identity
    DeepIDV *-- Screening : screening
    DeepIDV *-- AsyncJobs : asyncJobs
    DeepIDV *-- Deepfake : deepfake
    DeepIDV *-- Auth : auth
    DeepIDV *-- Workflows : workflows
    DeepIDV *-- WorkflowSessions : workflowSessions
    DeepIDV *-- Financial : financial
    DeepIDV *-- CreditTerms : creditTerms
    DeepIDV *-- CreditChecks : creditChecks
    DeepIDV *-- Profiles : profiles
```

The `DeepIDV` class is the only public entry point. Namespace classes are **not exported** — consumers access them exclusively through the client instance.

## Core Internals

Under the hood, `@deepidv/core` provides the shared infrastructure that all modules depend on:

```mermaid
---
title: "@deepidv/core — Internal Infrastructure"
---
classDiagram
    class HttpClient {
        +request~T~(method, path, options?) T
        +get~T~(path, options?) T
        +post~T~(path, body, options?) T
        +patch~T~(path, body, options?) T
        +put~T~(path, body, options?) T
        +delete~T~(path, options?) T
    }

    class FileUploader {
        +upload(inputs, options?) string[]
    }

    class TypedEmitter {
        +on(event, listener) () => void
        +once(event, listener) () => void
        +emit(event, payload) void
    }

    class DeepIDVError {
        +status: number?
        +code: string?
        +response: RawResponse?
        +toJSON() Record
    }

    class AuthenticationError {
        +redactedKey: string
    }

    class RateLimitError {
        +retryAfter: number?
    }

    class ValidationError
    class NetworkError
    class TimeoutError

    HttpClient --> TypedEmitter : emits events
    HttpClient --> "withRetry()" : retry logic
    FileUploader --> HttpClient : presign requests
    FileUploader --> TypedEmitter : upload events

    DeepIDVError <|-- AuthenticationError
    DeepIDVError <|-- RateLimitError
    DeepIDVError <|-- ValidationError
    DeepIDVError <|-- NetworkError
    DeepIDVError <|-- TimeoutError
```

## Package Structure

`@deepidv/core` is **not published as a separate npm package**. It is bundled into `@deepidv/server` at build time via tsup's `noExternal` option. Consumers install one package:

```mermaid
---
title: Package Bundling
---
graph LR
    subgraph "@deepidv/server (published to npm)"
        subgraph "Bundled from @deepidv/core"
            HC[HttpClient]
            FU[FileUploader]
            TE[TypedEmitter]
            ERR[Error classes]
            CFG[Config + resolveConfig]
            RT[Retry logic]
        end
        DV[DeepIDV class]
        SESS[Sessions]
        DOC[Document]
        FACE[Face]
        IDV[Identity]
    end

    DV --> HC
    DV --> FU
    DV --> TE
    SESS --> HC
    DOC --> HC
    DOC --> FU
    FACE --> HC
    FACE --> FU
    IDV --> HC
    IDV --> FU
```

This means:

- `npm install @deepidv/server` is the only install command
- No `workspace:*` protocol resolution issues
- No peer dependency on `@deepidv/core`
- Consumer's bundler doesn't need to resolve monorepo internals

## What the SDK Does NOT Do

| Excluded           | Reason                                                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AWS SDK dependency | All S3 interaction uses presigned URLs via native `fetch`                                                                                                |
| UI components      | This is a server SDK. See `@deepidv/web` (future)                                                                                                        |
| Image processing   | No resizing, conversion, or format detection beyond magic-byte MIME sniffing                                                                             |
| Logging to stdout  | Uses a typed event emitter — the consumer decides what to log                                                                                            |
| Webhook delivery   | Async operations expose explicit polling handles; webhook delivery remains app-owned                                                                     |
| Error swallowing   | Always throws typed errors; never returns `null` for failure                                                                                             |
| Retry on 4xx       | 4xx errors are caller bugs, not transient failures. Retryable 429 and 5xx responses are retried unless a billable non-idempotent method disables retries |
| Mutable singletons | Each `new DeepIDV()` is independent; constructor is cheap                                                                                                |

## Dependency Injection

The `DeepIDV` constructor wires all dependencies eagerly:

1. Validates config with `DeepIDVConfigSchema` (Zod)
2. Resolves defaults via `resolveConfig()`
3. Creates a `TypedEmitter` instance
4. Creates an `HttpClient` with the resolved config and emitter
5. Creates a `FileUploader` with the config, HTTP client, and emitter
6. Instantiates every public namespace, including workflows, screening, financial, credit terms, credit checks, and profiles

No lazy loading, no service locator, no global state.
