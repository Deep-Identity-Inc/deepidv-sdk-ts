/**
 * `createAgentPayMcpClient`: a connected MCP client for the getai.id AI
 * agent endpoint, authenticated as a registered AI agent.
 *
 * Tokens come from the client credentials grant with a `private_key_jwt`
 * assertion signed by the AI agent's key (the MCP SDK's
 * `PrivateKeyJwtProvider`); with DPoP on, every request also carries a
 * proof from the same key, so a leaked token is useless on its own.
 *
 * `@modelcontextprotocol/sdk` (^1.32) is a peer dependency of this entry
 * point only. Needs a runtime with global WebCrypto (`globalThis.crypto`):
 * Node 20+, Deno, Bun and edge runtimes.
 *
 * @module agentPay/client
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { PrivateKeyJwtProvider } from '@modelcontextprotocol/sdk/client/auth-extensions.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import {
  createDpopFetch,
  resolveAgentKey,
  type AgentKeyAlgorithm,
  type FetchLike,
  type Jwk,
} from './dpopFetch.js';

// Replaced with the package version by tsup (`define`); unset in tests.
declare const __DEEPIDV_SERVER_VERSION__: string | undefined;

const PACKAGE_VERSION =
  typeof __DEEPIDV_SERVER_VERSION__ === 'string' ? __DEEPIDV_SERVER_VERSION__ : '0.0.0-dev';

/** The production endpoint. */
export const AGENT_PAY_MCP_ENDPOINT = 'https://mcp.deepidv.com/v1/agent-mcp';

/** The scope every AI agent token carries. */
export const AGENT_PAY_SCOPE = 'agentpay';

/** Options for {@link createAgentPayMcpClient}. */
export interface AgentPayMcpClientOptions {
  /** The AI agent's ASID (`ASID-<PREFIX>-<12 hex>`), used as the OAuth client id. */
  asid: string;
  /** The AI agent's private key: a PKCS#8 PEM string or a private JWK. */
  privateKey: string | Jwk;
  /**
   * The registered public JWK. Required for DPoP, and checked against
   * `privateKey`.
   */
  publicJwk?: Jwk;
  /** `ES256` (P-256) or `EdDSA` (Ed25519). */
  alg: AgentKeyAlgorithm;
  /** The MCP endpoint. Defaults to {@link AGENT_PAY_MCP_ENDPOINT}. */
  endpoint?: string;
  /** Bind tokens to the key with DPoP. Defaults to true when `publicJwk` is given. */
  dpop?: boolean;
  /**
   * Reported to the server on `initialize`. Defaults to
   * `deepidv-agent-pay` with this package's version.
   */
  clientInfo?: { name: string; version: string };
  /** The `fetch` to use. Defaults to the global `fetch`. */
  fetch?: FetchLike;
}

/** What {@link createAgentPayMcpClient} returns. */
export interface AgentPayMcpClient {
  /** The connected MCP client: `callTool`, `listTools` and the rest. */
  client: Client;
  /** The underlying Streamable HTTP transport. */
  transport: StreamableHTTPClientTransport;
  /** Ends the MCP session on the server (best effort), then closes the client. */
  close: () => Promise<void>;
}

/**
 * Connects an MCP client to the AI agent endpoint as `asid`.
 *
 * @example
 * ```typescript
 * import { createAgentPayMcpClient } from '@deepidv/server/agentPay';
 *
 * const { client, close } = await createAgentPayMcpClient({
 *   asid: process.env.GETAI_ASID!,
 *   privateKey: process.env.GETAI_PRIVATE_KEY_PEM!,
 *   publicJwk: JSON.parse(process.env.GETAI_PUBLIC_JWK!),
 *   alg: 'ES256',
 * });
 * const { structuredContent } = await client.callTool({ name: 'list_mandates', arguments: {} });
 * await close();
 * ```
 */
export async function createAgentPayMcpClient(
  options: AgentPayMcpClientOptions,
): Promise<AgentPayMcpClient> {
  const endpoint = (options.endpoint ?? AGENT_PAY_MCP_ENDPOINT).replace(/\/+$/, '');
  const dpop = options.dpop ?? options.publicJwk !== undefined;

  if (dpop && !options.publicJwk) {
    throw new TypeError('publicJwk is required when dpop is true');
  }

  // Validates the key (and publicJwk against it) before any request. The
  // assertion is signed from the private JWK: the MCP SDK takes PEM strings
  // only for RS, ES and PS algorithms, not EdDSA.
  const { privateJwk } = await resolveAgentKey(options.privateKey, options.alg, options.publicJwk);

  const authProvider = new PrivateKeyJwtProvider({
    clientId: options.asid,
    privateKey: privateJwk,
    algorithm: options.alg,
    scope: AGENT_PAY_SCOPE,
    expectedIssuer: `${endpoint}/oauth`,
  });

  const fetchFn =
    dpop && options.publicJwk
      ? createDpopFetch({
          privateKey: privateJwk,
          publicJwk: options.publicJwk,
          alg: options.alg,
          ...(options.fetch ? { fetch: options.fetch } : {}),
        })
      : options.fetch;

  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    authProvider,
    ...(fetchFn ? { fetch: fetchFn } : {}),
  });

  const client = new Client(
    options.clientInfo ?? { name: 'deepidv-agent-pay', version: PACKAGE_VERSION },
  );
  await client.connect(transport);

  return {
    client,
    transport,
    close: async () => {
      await transport.terminateSession().catch(() => undefined);
      await client.close();
    },
  };
}
