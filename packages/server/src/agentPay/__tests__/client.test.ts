import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../__tests__/setup.js';
import { createAgentPayMcpClient } from '../client.js';
import { decodeJwt, newAgentKey, sha256b64url, verifyJws, type TestAgentKey } from './helpers.js';

const ORIGIN = 'https://mcp.test.deepidv.com';
const ENDPOINT = `${ORIGIN}/v1/agent-mcp`;
const ISSUER = `${ENDPOINT}/oauth`;
const ASID = 'ASID-AGT-0123456789AB';

type Seen = {
  assertion?: Record<string, unknown>;
  tokenProof?: Record<string, unknown>;
  mcpSchemes: string[];
  mcpProofs: Array<Record<string, unknown>>;
};

/** A mock of the endpoint following Agent Pay 08 §5: discovery, token, MCP. */
function mockEndpoint(key: TestAgentKey, seen: Seen) {
  let boundToken: string | undefined;

  server.use(
    http.get(`${ORIGIN}/.well-known/oauth-protected-resource/v1/agent-mcp`, () =>
      HttpResponse.json({
        resource: ENDPOINT,
        authorization_servers: [ISSUER],
        scopes_supported: ['agentpay'],
        bearer_methods_supported: ['header'],
      }),
    ),
    http.get(`${ORIGIN}/.well-known/oauth-authorization-server/v1/agent-mcp/oauth`, () =>
      HttpResponse.json({
        issuer: ISSUER,
        token_endpoint: `${ISSUER}/token`,
        authorization_endpoint: `${ISSUER}/authorize`,
        grant_types_supported: ['client_credentials'],
        token_endpoint_auth_methods_supported: ['private_key_jwt'],
        token_endpoint_auth_signing_alg_values_supported: ['ES256', 'EdDSA'],
        scopes_supported: ['agentpay'],
        response_types_supported: [],
      }),
    ),
    http.get(`${ORIGIN}/.well-known/*`, () => new HttpResponse(null, { status: 404 })),
    http.post(`${ISSUER}/token`, async ({ request }) => {
      const form = new URLSearchParams(await request.text());
      const assertion = form.get('client_assertion') ?? '';
      if (!(await verifyJws(assertion, key.publicJwk, key.alg))) {
        return HttpResponse.json({ error: 'invalid_client' }, { status: 400 });
      }
      seen.assertion = { ...decodeJwt(assertion).payload, form: Object.fromEntries(form) };

      const proof = request.headers.get('dpop');
      if (proof) {
        if (!(await verifyJws(proof, key.publicJwk, key.alg))) {
          return HttpResponse.json({ error: 'invalid_dpop_proof' }, { status: 400 });
        }
        seen.tokenProof = decodeJwt(proof).payload;
      }

      const accessToken = `token-${proof ? 'bound' : 'bearer'}-${crypto.randomUUID()}`;
      if (proof) boundToken = accessToken;
      return HttpResponse.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: proof ? 3600 : 600,
        scope: 'agentpay',
      });
    }),
    http.get(ENDPOINT, () => new HttpResponse(null, { status: 405 })),
    http.post(ENDPOINT, async ({ request }) => {
      const authorization = request.headers.get('authorization');
      if (!authorization) {
        return new HttpResponse(null, {
          status: 401,
          headers: {
            'www-authenticate': `Bearer resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/v1/agent-mcp", scope="agentpay"`,
          },
        });
      }

      const [scheme = '', token = ''] = authorization.split(' ');
      seen.mcpSchemes.push(scheme);
      if (token === boundToken) {
        const proof = request.headers.get('dpop');
        if (scheme !== 'DPoP' || !proof || !(await verifyJws(proof, key.publicJwk, key.alg))) {
          return HttpResponse.json({ error: 'invalid_token' }, { status: 401 });
        }
        const claims = decodeJwt(proof).payload;
        if (claims.ath !== (await sha256b64url(token)) || claims.htu !== ENDPOINT) {
          return HttpResponse.json({ error: 'invalid_token' }, { status: 401 });
        }
        seen.mcpProofs.push(claims);
      }

      const message = (await request.json()) as { id?: number; method: string };
      if (message.id === undefined) return new HttpResponse(null, { status: 202 });

      const results: Record<string, unknown> = {
        initialize: {
          protocolVersion: '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: 'getai-agent-pay', version: '1.0.0' },
        },
        'tools/list': {
          tools: [{ name: 'list_mandates', inputSchema: { type: 'object', properties: {} } }],
        },
        'tools/call': {
          content: [{ type: 'text', text: 'ok' }],
          structuredContent: { mandates: [] },
        },
      };
      return HttpResponse.json({ jsonrpc: '2.0', id: message.id, result: results[message.method] });
    }),
  );
}

let seen: Seen;

beforeEach(() => {
  seen = { mcpSchemes: [], mcpProofs: [] };
});

describe('createAgentPayMcpClient', () => {
  it('authenticates with private_key_jwt and DPoP, then calls list_mandates', async () => {
    const key = await newAgentKey('ES256');
    mockEndpoint(key, seen);

    const { client, transport } = await createAgentPayMcpClient({
      asid: ASID,
      privateKey: key.pkcs8Pem,
      publicJwk: key.publicJwk,
      alg: 'ES256',
      endpoint: ENDPOINT,
    });
    const result = await client.callTool({ name: 'list_mandates', arguments: {} });
    await transport.close();

    expect(result.structuredContent).toEqual({ mandates: [] });
    expect(seen.assertion).toMatchObject({ iss: ASID, sub: ASID, aud: ISSUER });
    expect(seen.assertion?.form).toMatchObject({
      grant_type: 'client_credentials',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      scope: 'agentpay',
      resource: ENDPOINT,
    });
    expect(seen.tokenProof).toMatchObject({ htm: 'POST', htu: `${ISSUER}/token` });
    expect(seen.tokenProof?.ath).toBeUndefined();
    expect(new Set(seen.mcpSchemes)).toEqual(new Set(['DPoP']));
    expect(seen.mcpProofs.length).toBeGreaterThanOrEqual(2);
  });

  it('uses a bearer token without DPoP when no public JWK is given', async () => {
    const key = await newAgentKey('EdDSA');
    mockEndpoint(key, seen);

    const { client, transport } = await createAgentPayMcpClient({
      asid: ASID,
      privateKey: key.privateJwk,
      alg: 'EdDSA',
      endpoint: `${ENDPOINT}/`,
    });
    const tools = await client.listTools();
    await transport.close();

    expect(tools.tools.map((t) => t.name)).toEqual(['list_mandates']);
    expect(seen.tokenProof).toBeUndefined();
    expect(new Set(seen.mcpSchemes)).toEqual(new Set(['Bearer']));
  });

  it('requires publicJwk when dpop is asked for', async () => {
    const key = await newAgentKey();

    await expect(
      createAgentPayMcpClient({ asid: ASID, privateKey: key.pkcs8Pem, alg: 'ES256', dpop: true }),
    ).rejects.toThrow('publicJwk');
  });
});
