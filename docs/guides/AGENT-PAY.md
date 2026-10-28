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

`@deepidv/server/agentPay` needs the MCP SDK (^1.32) as a peer, and Node 20+
(or any runtime with global WebCrypto, such as Deno, Bun and edge runtimes):

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

Leave out `publicJwk` (or pass `dpop: false`) for bearer tokens. A `publicJwk`
that is not the public half of `privateKey` is refused before any request.

To use your own transport, wrap `fetch` with `createDpopFetch` and pass the MCP
SDK's `PrivateKeyJwtProvider`. `createDpopFetch` derives the public JWK from
the private key when `publicJwk` is left out, signs the token request, and
switches a token to the `DPoP` scheme only when it is bound (`cnf.jkt`);
unbound tokens stay `Bearer`. The SDK's provider takes a PEM string only for
ES256, so pass a private JWK for EdDSA (`createAgentPayMcpClient` does this for
you):

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
obtains bearer tokens on its own. For DPoP, wrap it with the `httpx.Auth`
below. This is a documented example to copy, not a published package. It adds
a proof to the token request and, once the token is bound (`cnf.jkt` in its
payload), switches to the `DPoP` scheme with a proof on every request. It needs
PyJWT with the `crypto` extra and works with the SDK's async transports only.

```python
import base64, hashlib, json, time, uuid

import httpx  # mcp 1.x; with mcp 2.x use: import httpx2 as httpx
import jwt


def _is_bound(token: str) -> bool:
    """True when the token payload (read without verification) has cnf.jkt."""
    try:
        segment = token.split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(segment + "=" * (-len(segment) % 4)))
        return bool(claims.get("cnf", {}).get("jkt"))
    except (IndexError, ValueError, AttributeError):
        return False


class DPoPAuth(httpx.Auth):
    """Adds DPoP proofs (RFC 9449) from the AI agent key to an MCP OAuth provider."""

    requires_response_body = True

    def __init__(self, inner: httpx.Auth, private_key_pem: str, public_jwk: dict, alg: str = "ES256"):
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
        request.headers.pop("dpop", None)  # a re-yielded request never keeps a stale proof
        scheme, _, token = request.headers.get("authorization", "").partition(" ")
        if token and (scheme.lower() == "dpop" or _is_bound(token)):
            request.headers["authorization"] = f"DPoP {token}"
            request.headers["dpop"] = self._proof(request, token)
        elif not token and request.method != "GET":
            request.headers["dpop"] = self._proof(request, None)

    async def async_auth_flow(self, request: httpx.Request):
        flow = self.inner.async_auth_flow(request)
        try:
            outgoing = await flow.__anext__()
            while True:
                self._sign(outgoing)
                response = yield outgoing
                outgoing = await flow.asend(response)
        except StopAsyncIteration:
            return
```

In mcp 2.x, `PrivateKeyJWTOAuthProvider` takes an `assertion_provider`
(`Callable[[str], Awaitable[str]]`: the audience in, a signed assertion out)
rather than a PEM. One that signs with the AI agent key:

```python
def assertion_provider(asid: str, private_key_pem: str, alg: str = "ES256"):
    async def provider(audience: str) -> str:
        now = int(time.time())
        claims = {"iss": asid, "sub": asid, "aud": audience, "iat": now, "exp": now + 300, "jti": str(uuid.uuid4())}
        return jwt.encode(claims, private_key_pem, algorithm=alg)

    return provider
```

Construct the provider with it, `client_id=asid`, `scope="agentpay"` and
`issuer=f"{endpoint}/oauth"`, then pass `DPoPAuth(provider, pem, public_jwk)`
as the `auth` of the MCP client's HTTP transport.

## Claude Code and hosted connectors

Hosted MCP connectors and Claude Code send a fixed bearer token, so they work
only with AI agents that do not require DPoP. Claude Code's `headersHelper`
can mint the token. Claude Code runs the helper on each connection and, after a
401 on a tool call, runs it again and retries the call once, which covers the
10 minute token lifetime.

The script below needs `jose` installed next to it (`npm install jose`). It
reads the PEM path from `GETAI_PEM_PATH` and the algorithm from `GETAI_ALG`
(`ES256` by default, or `EdDSA`). For servers in a project `.mcp.json`, Claude
Code removes environment variables whose names look like credentials (with
`KEY`, `TOKEN`, `SECRET` and similar in them) before running the helper, so
keep names like these.

```js
#!/usr/bin/env node
// getai-headers.mjs: prints {"Authorization": "Bearer <token>"} for headersHelper.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { SignJWT, importPKCS8 } from 'jose';

const asid = process.env.GETAI_ASID;
const pemPath = process.env.GETAI_PEM_PATH;
if (!asid || !pemPath) {
  process.stderr.write('getai-headers: set GETAI_ASID and GETAI_PEM_PATH in the server env\n');
  process.exit(1);
}
const alg = process.env.GETAI_ALG ?? 'ES256';
const issuer = 'https://mcp.deepidv.com/v1/agent-mcp/oauth';
const key = await importPKCS8(readFileSync(pemPath, 'utf8'), alg);

const assertion = await new SignJWT({})
  .setProtectedHeader({ alg, typ: 'JWT' })
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
if (!response.ok) {
  process.stderr.write(
    `getai.id token request failed: ${response.status} ${await response.text()}\n`,
  );
  process.exit(1);
}
const { access_token } = await response.json();
process.stdout.write(JSON.stringify({ Authorization: `Bearer ${access_token}` }));
```

## Errors

| Where          | Response                                | Meaning                                                                                                    |
| -------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Token endpoint | `400 invalid_client`                    | Unknown or inactive AI agent, operator not active or not entitled, or no active key verifies the assertion |
| Token endpoint | `400 invalid_grant`                     | The assertion `jti` was already used                                                                       |
| Token endpoint | `400 invalid_request` (`dpop_required`) | The AI agent requires DPoP and no proof was sent                                                           |
| Token endpoint | `400 invalid_dpop_proof`                | The proof is malformed or not signed by the key that signed the assertion                                  |
| Token endpoint | `400 unsupported_grant_type`            | The grant is not `client_credentials`                                                                      |
| Token endpoint | `400 invalid_target`                    | `resource` is not the MCP endpoint                                                                         |
| Token endpoint | `400 invalid_scope`                     | `scope` asks for anything other than `agentpay`                                                            |
| Token endpoint | `429 slow_down`                         | More than 20 token requests a minute for this ASID; honour `Retry-After`                                   |
| MCP endpoint   | `401 invalid_token`                     | Expired or invalid token, a proof problem (`dpop_*`), or the AI agent or operator is suspended             |
| Both           | `503 temporarily_unavailable`           | The service is briefly unavailable; retry later                                                            |
