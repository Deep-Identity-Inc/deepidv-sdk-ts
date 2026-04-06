# @deepidv/server Documentation

Backend-first TypeScript SDK for the [deepidv](https://api.deepidv.com) identity verification API.

## Guides

Start here if you're new to the SDK.

| Document | Description |
|----------|-------------|
| [Quickstart](./guides/QUICKSTART.md) | Install, initialize, make your first call in 2 minutes |
| [Authentication](./guides/AUTHENTICATION.md) | API key setup, security best practices, custom fetch |
| [Session-Based Verification](./guides/SESSION-VERIFICATION.md) | Hosted verification flow: create session, user verifies, retrieve results |
| [Server-to-Server Verification](./guides/SERVER-TO-SERVER.md) | Use primitives to build custom verification pipelines |
| [Migration from REST API](./guides/MIGRATION.md) | Endpoint mapping and before/after code examples |
| [Supported Runtimes](./guides/RUNTIMES.md) | Node.js, Deno, Bun, Cloudflare Workers compatibility |
| [Troubleshooting](./guides/TROUBLESHOOTING.md) | Common errors and how to fix them |

## Architecture

Deep dives into how the SDK works internally.

| Document | Description |
|----------|-------------|
| [Architecture Overview](./architecture/OVERVIEW.md) | Design principles, class diagrams, package structure |
| [Presigned Upload Flow](./architecture/UPLOAD-FLOW.md) | File upload lifecycle, batch uploads, input types |
| [Error Handling](./architecture/ERROR-HANDLING.md) | Error hierarchy, decision tree, structured logging |
| [Retry & Timeout](./architecture/RETRY-TIMEOUT.md) | Exponential backoff, Retry-After, per-attempt timeout |
| [Event System](./architecture/EVENT-SYSTEM.md) | Lifecycle events, payloads, APM integration |

## Reference

Complete API documentation.

| Document | Description |
|----------|-------------|
| [API Reference](./reference/API.md) | Every public method with signatures, parameters, and examples |
| [TypeScript Types](./reference/TYPES.md) | All exported types, interfaces, and Zod schemas |
| [Configuration](./reference/CONFIGURATION.md) | Every config option with defaults and validation |

## Diagrams

Standalone Mermaid diagrams for each visual in the documentation are available in [`docs/diagrams/`](./diagrams/). These `.mmd` files can be rendered independently or embedded in other tools.

## Quick Links

- **Install:** `npm install @deepidv/server`
- **API Docs:** [https://docs.deepidv.com/api-reference](https://docs.deepidv.com/api-reference)
- **Source:** [packages/server/src/](../packages/server/src/)
