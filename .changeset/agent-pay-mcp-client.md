---
'@deepidv/server': minor
---

New `@deepidv/server/agentPay` entry point for AI agents calling the getai.id Agent Pay MCP endpoint (DIDV-915): `createAgentPayMcpClient` connects an MCP client authenticated with `private_key_jwt` and, by default when a public JWK is given, DPoP-bound tokens; `createDpopFetch` adds DPoP proofs to any MCP SDK transport. `@modelcontextprotocol/sdk` (^1.32) is an optional peer dependency used only by this entry point, which needs Node 20+ (or any runtime with global WebCrypto).
