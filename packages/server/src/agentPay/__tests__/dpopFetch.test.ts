import { describe, expect, it, vi } from 'vitest';

import { createDpopFetch, proofUrl } from '../dpopFetch.js';
import { decodeJwt, newAgentKey, proofOf, sha256b64url, verifyJws } from './helpers.js';

function capture() {
  const calls: Array<{ url: string; headers: Headers; init?: RequestInit }> = [];
  const fetch = vi.fn((url: string | URL, init?: RequestInit) => {
    calls.push({ url: url.toString(), headers: new Headers(init?.headers), init });
    return Promise.resolve(new Response('{}', { status: 200 }));
  });
  return { calls, fetch };
}

describe('createDpopFetch', () => {
  it('adds a proof without ath to the token request, signed by the AI agent key', async () => {
    const key = await newAgentKey('ES256');
    const { calls, fetch } = capture();
    const dpopFetch = createDpopFetch({
      privateKey: key.pkcs8Pem,
      publicJwk: key.publicJwk,
      alg: 'ES256',
      fetch,
    });

    await dpopFetch('https://mcp.deepidv.com/v1/agent-mcp/oauth/token?x=1#f', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });

    const proof = proofOf(calls[0]?.headers);
    const { header, payload } = decodeJwt(proof);
    expect(header).toEqual({ typ: 'dpop+jwt', alg: 'ES256', jwk: key.publicJwk });
    expect(payload).toMatchObject({
      htm: 'POST',
      htu: 'https://mcp.deepidv.com/v1/agent-mcp/oauth/token',
    });
    expect(payload.ath).toBeUndefined();
    expect(typeof payload.jti).toBe('string');
    expect(Math.abs((payload.iat as number) - Date.now() / 1000)).toBeLessThan(5);
    expect(await verifyJws(proof, key.publicJwk, 'ES256')).toBe(true);
    expect(calls[0]?.headers.get('content-type')).toBe('application/x-www-form-urlencoded');
    expect(calls[0]?.init?.body).toBe('grant_type=client_credentials');
  });

  it('switches Bearer to DPoP and binds the proof to the token with ath', async () => {
    const key = await newAgentKey('EdDSA');
    const { calls, fetch } = capture();
    const dpopFetch = createDpopFetch({
      privateKey: key.privateJwk,
      publicJwk: key.publicJwk,
      alg: 'EdDSA',
      fetch,
    });

    await dpopFetch(new URL('https://mcp.deepidv.com/v1/agent-mcp'), {
      method: 'POST',
      headers: { Authorization: 'Bearer token-123' },
    });

    expect(calls[0]?.headers.get('authorization')).toBe('DPoP token-123');
    const proof = proofOf(calls[0]?.headers);
    expect(decodeJwt(proof).payload).toMatchObject({
      htm: 'POST',
      ath: await sha256b64url('token-123'),
    });
    expect(await verifyJws(proof, key.publicJwk, 'EdDSA')).toBe(true);
  });

  it('signs a fresh proof per request', async () => {
    const key = await newAgentKey();
    const { calls, fetch } = capture();
    const dpopFetch = createDpopFetch({
      privateKey: key.pkcs8Pem,
      publicJwk: key.publicJwk,
      alg: 'ES256',
      fetch,
    });

    await dpopFetch('https://mcp.deepidv.com/v1/agent-mcp', {
      method: 'POST',
      headers: { Authorization: 'Bearer t' },
    });
    await dpopFetch('https://mcp.deepidv.com/v1/agent-mcp', {
      method: 'POST',
      headers: { Authorization: 'Bearer t' },
    });

    expect(decodeJwt(proofOf(calls[0]?.headers)).payload.jti).not.toBe(
      decodeJwt(proofOf(calls[1]?.headers)).payload.jti,
    );
  });

  it('passes discovery GETs through untouched', async () => {
    const key = await newAgentKey();
    const { calls, fetch } = capture();
    const dpopFetch = createDpopFetch({
      privateKey: key.pkcs8Pem,
      publicJwk: key.publicJwk,
      alg: 'ES256',
      fetch,
    });

    await dpopFetch('https://mcp.deepidv.com/.well-known/oauth-protected-resource/v1/agent-mcp');

    expect(calls[0]?.headers.get('dpop')).toBeNull();
  });

  it('refuses a public JWK with private material and a non-PKCS#8 PEM', async () => {
    const key = await newAgentKey();

    expect(() =>
      createDpopFetch({ privateKey: key.pkcs8Pem, publicJwk: key.privateJwk, alg: 'ES256' }),
    ).toThrow('private key material');

    const dpopFetch = createDpopFetch({
      privateKey: '-----BEGIN EC PRIVATE KEY-----\nAAAA\n-----END EC PRIVATE KEY-----',
      publicJwk: key.publicJwk,
      alg: 'ES256',
      fetch: capture().fetch,
    });
    await expect(dpopFetch('https://x.test', { method: 'POST' })).rejects.toThrow('PKCS#8');
  });

  it('strips query and fragment from htu', () => {
    expect(proofUrl('https://mcp.deepidv.com/v1/agent-mcp?a=1#b')).toBe(
      'https://mcp.deepidv.com/v1/agent-mcp',
    );
  });
});
