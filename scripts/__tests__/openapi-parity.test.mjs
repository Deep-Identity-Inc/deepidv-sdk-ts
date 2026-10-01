import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compareOperations,
  parseOpenApiOperations,
  summarizeOperations,
  validateManifest,
} from '../lib/openapi-parity.mjs';

const source = `openapi: 3.1.0
paths:
  /v1/widgets:
    get:
      summary: List widgets
    post:
      summary: Create a widget
  /v1/widgets/{id}:
    parameters: []
    delete:
      summary: Delete a widget
components:
  schemas: {}
`;

function createManifest(operations) {
  return {
    schemaVersion: 1,
    source: {
      repository: 'Deep-Identity-Inc/deepidv-open-api',
      ref: 'origin/dev',
      commit: 'a'.repeat(40),
      specPath: 'infrastructure/ec2/open-api/openapi.yaml',
    },
    operations,
  };
}

test('extracts method and path pairs from generated OpenAPI YAML', () => {
  assert.deepEqual(parseOpenApiOperations(source), [
    { method: 'GET', path: '/v1/widgets' },
    { method: 'POST', path: '/v1/widgets' },
    { method: 'DELETE', path: '/v1/widgets/{id}' },
  ]);
});

test('accepts classified supported and excluded operations', () => {
  const manifest = createManifest([
    {
      method: 'GET',
      path: '/v1/widgets',
      status: 'supported',
      sdkNamespace: 'widgets',
      sdkMethod: 'list',
      tests: ['widgets.test.ts'],
      documentation: ['widgets.md'],
    },
    {
      method: 'GET',
      path: '/v1/oauth-clients',
      status: 'excluded-oauth',
      reason: 'Owned by the MCP server.',
      owner: 'MCP server',
    },
    {
      method: 'POST',
      path: '/v1/oauth-clients',
      status: 'excluded-oauth',
      reason: 'Owned by the MCP server.',
      owner: 'MCP server',
    },
    {
      method: 'POST',
      path: '/v1/oauth-clients/{clientId}/rotate-secret',
      status: 'excluded-oauth',
      reason: 'Owned by the MCP server.',
      owner: 'MCP server',
    },
    {
      method: 'POST',
      path: '/v1/oauth-clients/{clientId}/revoke',
      status: 'excluded-oauth',
      reason: 'Owned by the MCP server.',
      owner: 'MCP server',
    },
  ]);

  assert.deepEqual(validateManifest(manifest), []);
});

test('enforces the MCP OAuth boundary', () => {
  const manifest = createManifest([
    {
      method: 'GET',
      path: '/v1/oauth-clients',
      status: 'implement',
      sdkNamespace: 'oauthClients',
      sdkMethod: 'list',
    },
    {
      method: 'POST',
      path: '/v1/oauth-clients',
      status: 'excluded-oauth',
      reason: 'Owned by the MCP server.',
      owner: 'MCP server',
    },
    {
      method: 'POST',
      path: '/v1/oauth-clients/{clientId}/rotate-secret',
      status: 'excluded-oauth',
      reason: 'Owned by the MCP server.',
      owner: 'MCP server',
    },
    {
      method: 'POST',
      path: '/v1/oauth-clients/{clientId}/revoke',
      status: 'excluded-oauth',
      reason: 'Owned by the MCP server.',
      owner: 'MCP server',
    },
    {
      method: 'GET',
      path: '/v1/auth/verify',
      status: 'excluded-oauth',
      reason: 'Incorrect classification.',
      owner: 'SDK',
    },
  ]);

  assert.deepEqual(validateManifest(manifest), [
    'GET /v1/oauth-clients must remain excluded-oauth.',
    'GET /v1/auth/verify is not an approved OAuth exclusion.',
    'GET /v1/auth/verify is API-key verification and must remain in SDK scope.',
  ]);
});

test('reports missing classifications and stale manifest entries', () => {
  const manifestOperations = [
    { method: 'GET', path: '/v1/widgets' },
    { method: 'GET', path: '/v1/stale' },
  ];
  const comparison = compareOperations(manifestOperations, parseOpenApiOperations(source));

  assert.deepEqual(comparison, {
    unclassified: ['DELETE /v1/widgets/{id}', 'POST /v1/widgets'],
    stale: ['GET /v1/stale'],
  });
});

test('summarizes operations by status and route domain', () => {
  const summary = summarizeOperations([
    { method: 'GET', path: '/v1/widgets', status: 'supported' },
    { method: 'POST', path: '/v1/widgets', status: 'implement' },
    { method: 'GET', path: '/v1/things', status: 'implement' },
  ]);

  assert.deepEqual(summary, {
    total: 3,
    byStatus: { implement: 2, supported: 1 },
    byDomain: { things: 1, widgets: 2 },
  });
});
