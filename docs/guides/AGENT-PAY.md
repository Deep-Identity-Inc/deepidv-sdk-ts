# getai.id Agent Pay: AI agent MCP client

AI agents registered in getai.id call the Agent Pay MCP endpoint at
`https://mcp.deepidv.com/v1/agent-mcp`. There is no API key and no browser
login: the AI agent proves it holds the private key its operator registered.

1. **Token.** The client credentials grant with a `private_key_jwt` assertion
   signed by the AI agent's key (`iss` = `sub` = the ASID, `aud` =
   `https://mcp.deepidv.com/v1/agent-mcp/oauth`). The MCP SDKs find the token
   endpoint on their own through the discovery documents.
2. **DPoP (recommended).** When the token request carries a DPoP proof from the
   same key, the token is bound to it for 60 minutes and every MCP request must
   carry a fresh proof. Without DPoP the token is a 10 minute bearer token. An
   operator can require DPoP for an AI agent in the Back Office.

Keys are ES256 (P-256) or EdDSA (Ed25519).

## TypeScript

`@deepidv/server/agentPay` needs the MCP SDK as a peer:

```bash
npm install @deepidv/server @modelcontextprotocol/sdk
```

```typescript
import { createAgentPayMcpClient } from '@deepidv/server/agentPay';

const { client, close } = await createAgentPayMcpClient({
  asid: process.env.GETAI_ASID!, // ASID-AGT-0123456789AB
  privateKey: process.env.GETAI_PRIVATE_KEY_PEM!, // PKCS#8 PEM or a private JWK
  publicJwk: JSON.parse(process.env.GETAI_PUBLIC_JWK!), // enables DPoP
  alg: 'ES256',
});

const mandates = await client.callTool({ name: 'list_mandates', arguments: {} });
await close();
```

Leave out `publicJwk` (or pass `dpop: false`) for bearer tokens.

To use your own transport, wrap `fetch` with `createDpopFetch` and pass the MCP
SDK's `PrivateKeyJwtProvider`:

```typescript
import { PrivateKeyJwtProvider } from '@modelcontextprotocol/sdk/client/auth-extensions.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createDpopFetch } from '@deepidv/server/agentPay';

const transport = new StreamableHTTPClientTransport(
  new URL('https://mcp.deepidv.com/v1/agent-mcp'),
  {
    authProvider: new PrivateKeyJwtProvider({
      clientId: asid,
      privateKey,
      algorithm: 'ES256',
      scope: 'agentpay',
      expectedIssuer: 'https://mcp.deepidv.com/v1/agent-mcp/oauth',
    }),
    fetch: createDpopFetch({ privateKey, publicJwk, alg: 'ES256' }),
  },
);
```

## Python

There is no Python package. The MCP Python SDK's `PrivateKeyJWTOAuthProvider`
obtains bearer tokens on its own. For DPoP, this `httpx.Auth` adds a proof to
every request and switches the scheme once a token is present (PyJWT with the
`crypto` extra):

```python
import base64, hashlib, time, uuid

import httpx
import jwt


class DPoPAuth(httpx.Auth):
    """Signs a DPoP proof (RFC 9449) for every request with the AI agent key."""

    def __init__(self, inner: httpx.Auth | None, private_key_pem: str, public_jwk: dict, alg: str = "ES256"):
        self.inner = inner
        self.private_key_pem = private_key_pem
        self.public_jwk = {k: public_jwk[k] for k in ("kty", "crv", "x", "y") if k in public_jwk}
        self.alg = alg

    def _proof(self, request: httpx.Request, token: str | None) -> str:
        claims = {
            "jti": str(uuid.uuid4()),
            "htm": request.method,
            "htu": str(request.url.copy_with(query=None, fragment=None)),
            "iat": int(time.time()),
        }
        if token:
            digest = hashlib.sha256(token.encode()).digest()
            claims["ath"] = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
        headers = {"typ": "dpop+jwt", "jwk": self.public_jwk}
        return jwt.encode(claims, self.private_key_pem, algorithm=self.alg, headers=headers)

    def _sign(self, request: httpx.Request) -> None:
        scheme, _, token = request.headers.get("authorization", "").partition(" ")
        if token:
            request.headers["authorization"] = f"DPoP {token}"
            request.headers["dpop"] = self._proof(request, token)
        elif request.method != "GET":
            request.headers["dpop"] = self._proof(request, None)

    def auth_flow(self, request: httpx.Request):
        flow = self.inner.auth_flow(request) if self.inner else iter([request])
        response = None
        while True:
            try:
                outgoing = flow.send(response) if response is not None else next(flow)
            except StopIteration:
                return
            self._sign(outgoing)
            response = yield outgoing
```

Pass `DPoPAuth(provider, pem, public_jwk)` as the `auth` of the MCP client's
HTTP transport, with `provider` the SDK's `PrivateKeyJWTOAuthProvider`.

## Claude Code and hosted connectors

Hosted MCP connectors and Claude Code send a fixed bearer token, so they work
only with AI agents that do not require DPoP. Claude Code's `headersHelper`
can mint the token; Claude Code runs it again after a 401, which fits the
10 minute lifetime:

```js
#!/usr/bin/env node
// getai-headers.mjs: prints {"Authorization": "Bearer <token>"} for headersHelper.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { SignJWT, importPKCS8 } from 'jose';

const asid = process.env.GETAI_ASID;
const issuer = 'https://mcp.deepidv.com/v1/agent-mcp/oauth';
const key = await importPKCS8(readFileSync(process.env.GETAI_PRIVATE_KEY_FILE, 'utf8'), 'ES256');

const assertion = await new SignJWT({})
  .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
  .setIssuer(asid)
  .setSubject(asid)
  .setAudience(issuer)
  .setIssuedAt()
  .setExpirationTime('5m')
  .setJti(randomUUID())
  .sign(key);

const response = await fetch(`${issuer}/token`, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: assertion,
    resource: 'https://mcp.deepidv.com/v1/agent-mcp',
    scope: 'agentpay',
  }),
});
const { access_token } = await response.json();
process.stdout.write(JSON.stringify({ Authorization: `Bearer ${access_token}` }));
```

## Errors

| Where          | Response                                | Meaning                                                                                                    |
| -------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Token endpoint | `400 invalid_client`                    | Unknown or inactive AI agent, operator not active or not entitled, or no active key verifies the assertion |
| Token endpoint | `400 invalid_grant`                     | The assertion `jti` was already used                                                                       |
| Token endpoint | `400 invalid_request` (`dpop_required`) | The AI agent requires DPoP and no proof was sent                                                           |
| Token endpoint | `400 invalid_dpop_proof`                | The proof is malformed or not signed by a registered key                                                   |
| Token endpoint | `429 slow_down`                         | More than 20 token requests a minute for this ASID; honour `Retry-After`                                   |
| MCP endpoint   | `401 invalid_token`                     | Expired or invalid token, a proof problem (`dpop_*`), or the AI agent or operator is suspended             |
