import { describe, expect, it, vi } from 'vitest';

import { createDpopFetch, proofUrl } from '../dpopFetch.js';
import {
  decodeJwt,
  fakeAccessToken,
  newAgentKey,
  proofOf,
  sha256b64url,
  verifyJws,
} from './helpers.js';

const BOUND = fakeAccessToken({ sub: 'ASID-AGT-0123456789AB', cnf: { jkt: 'thumbprint' } });
const UNBOUND = fakeAccessToken({ sub: 'ASID-AGT-0123456789AB' });

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

  it('switches a bound Bearer token to DPoP and binds the proof to it with ath', async () => {
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
      headers: { Authorization: `Bearer ${BOUND}` },
    });

    expect(calls[0]?.headers.get('authorization')).toBe(`DPoP ${BOUND}`);
    const proof = proofOf(calls[0]?.headers);
    expect(decodeJwt(proof).payload).toMatchObject({
      htm: 'POST',
      ath: await sha256b64url(BOUND),
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
      headers: { Authorization: `Bearer ${BOUND}` },
    });
    await dpopFetch('https://mcp.deepidv.com/v1/agent-mcp', {
      method: 'POST',
      headers: { Authorization: `Bearer ${BOUND}` },
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

  it('leaves an unbound or opaque token as Bearer with no proof', async () => {
    const key = await newAgentKey();
    const { calls, fetch } = capture();
    const dpopFetch = createDpopFetch({
      privateKey: key.pkcs8Pem,
      publicJwk: key.publicJwk,
      alg: 'ES256',
      fetch,
    });

    for (const token of [UNBOUND, 'opaque-token']) {
      await dpopFetch('https://mcp.deepidv.com/v1/agent-mcp', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    expect(calls.map((c) => c.headers.get('authorization'))).toEqual([
      `Bearer ${UNBOUND}`,
      'Bearer opaque-token',
    ]);
    expect(calls.map((c) => c.headers.get('dpop'))).toEqual([null, null]);
  });

  it('reads headers given as a Headers instance', async () => {
    const key = await newAgentKey();
    const { calls, fetch } = capture();
    const dpopFetch = createDpopFetch({ privateKey: key.pkcs8Pem, alg: 'ES256', fetch });

    await dpopFetch('https://mcp.deepidv.com/v1/agent-mcp', {
      method: 'POST',
      headers: new Headers({ Authorization: `Bearer ${BOUND}`, 'mcp-session-id': 's1' }),
    });

    expect(calls[0]?.headers.get('authorization')).toBe(`DPoP ${BOUND}`);
    expect(calls[0]?.headers.get('mcp-session-id')).toBe('s1');
    expect(decodeJwt(proofOf(calls[0]?.headers)).payload.ath).toBe(await sha256b64url(BOUND));
  });

  it('refuses a Request object as input', async () => {
    const key = await newAgentKey();
    const dpopFetch = createDpopFetch({
      privateKey: key.pkcs8Pem,
      alg: 'ES256',
      fetch: capture().fetch,
    });
    const request = new Request('https://mcp.deepidv.com/v1/agent-mcp', { method: 'POST' });

    await expect(dpopFetch(request as unknown as string)).rejects.toThrow('string or URL');
  });

  it('accepts a PEM with literal \\n escapes or next to other blocks', async () => {
    const key = await newAgentKey();
    const escaped = key.pkcs8Pem.replace(/\n/g, '\\n');
    const bundled = `-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----\n${key.pkcs8Pem}`;

    for (const privateKey of [escaped, bundled]) {
      const { calls, fetch } = capture();
      const dpopFetch = createDpopFetch({
        privateKey,
        publicJwk: key.publicJwk,
        alg: 'ES256',
        fetch,
      });
      await dpopFetch('https://mcp.deepidv.com/v1/agent-mcp/oauth/token', { method: 'POST' });
      expect(await verifyJws(proofOf(calls[0]?.headers), key.publicJwk, 'ES256')).toBe(true);
    }
  });

  it('derives the public JWK from the private key when it is omitted', async () => {
    for (const alg of ['ES256', 'EdDSA'] as const) {
      const key = await newAgentKey(alg);
      for (const privateKey of [key.pkcs8Pem, key.privateJwk]) {
        const { calls, fetch } = capture();
        const dpopFetch = createDpopFetch({ privateKey, alg, fetch });
        await dpopFetch('https://mcp.deepidv.com/v1/agent-mcp/oauth/token', { method: 'POST' });
        const proof = proofOf(calls[0]?.headers);
        expect(decodeJwt(proof).header.jwk).toEqual(key.publicJwk);
        expect(await verifyJws(proof, key.publicJwk, alg)).toBe(true);
      }
    }
  });

  it('refuses a public JWK with private material or the wrong key type', async () => {
    const key = await newAgentKey();
    const ed = await newAgentKey('EdDSA');

    expect(() =>
      createDpopFetch({ privateKey: key.pkcs8Pem, publicJwk: key.privateJwk, alg: 'ES256' }),
    ).toThrow('private key material');
    expect(() =>
      createDpopFetch({ privateKey: key.pkcs8Pem, publicJwk: ed.publicJwk, alg: 'ES256' }),
    ).toThrow('EC P-256');
  });

  it('refuses a public JWK that is not the private key', async () => {
    const key = await newAgentKey();
    const other = await newAgentKey();
    const dpopFetch = createDpopFetch({
      privateKey: key.privateJwk,
      publicJwk: other.publicJwk,
      alg: 'ES256',
      fetch: capture().fetch,
    });

    await expect(dpopFetch('https://x.test', { method: 'POST' })).rejects.toThrow(
      'publicJwk does not match privateKey',
    );
  });

  it('refuses a PEM without a PKCS#8 block', async () => {
    const key = await newAgentKey();
    const dpopFetch = createDpopFetch({
      privateKey: '-----BEGIN EC PRIVATE KEY-----\nAAAA\n-----END EC PRIVATE KEY-----',
      publicJwk: key.publicJwk,
      alg: 'ES256',
      fetch: capture().fetch,
    });

    await expect(dpopFetch('https://x.test', { method: 'POST' })).rejects.toThrow(TypeError);
    await expect(dpopFetch('https://x.test', { method: 'POST' })).rejects.toThrow('PKCS#8');
  });

  it('strips query and fragment from htu', () => {
    expect(proofUrl('https://mcp.deepidv.com/v1/agent-mcp?a=1#b')).toBe(
      'https://mcp.deepidv.com/v1/agent-mcp',
    );
  });
});
