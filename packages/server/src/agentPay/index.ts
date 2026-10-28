/**
 * `@deepidv/server/agentPay`: helpers for AI agents calling the getai.id
 * Agent Pay MCP endpoint. Requires the `@modelcontextprotocol/sdk` peer.
 *
 * @packageDocumentation
 */

export { createDpopFetch, importAgentPrivateKey, proofUrl, signDpopProof } from './dpopFetch.js';
export type { AgentKeyAlgorithm, DpopFetchOptions, FetchLike, Jwk } from './dpopFetch.js';

export { AGENT_PAY_MCP_ENDPOINT, AGENT_PAY_SCOPE, createAgentPayMcpClient } from './client.js';
export type { AgentPayMcpClient, AgentPayMcpClientOptions } from './client.js';
