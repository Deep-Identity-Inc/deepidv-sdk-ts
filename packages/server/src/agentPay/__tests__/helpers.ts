import type { AgentKeyAlgorithm, Jwk } from '../dpopFetch.js';

export interface TestAgentKey {
  alg: AgentKeyAlgorithm;
  privateJwk: Jwk;
  publicJwk: Jwk;
  pkcs8Pem: string;
}

const encoder = new TextEncoder();

function toBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function keyParams(alg: AgentKeyAlgorithm) {
  return alg === 'ES256' ? { name: 'ECDSA', namedCurve: 'P-256' } : { name: 'Ed25519' };
}

function parts(token: string): [string, string, string] {
  const [h, p, s] = token.split('.');
  if (h === undefined || p === undefined || s === undefined) throw new Error('not a JWS');
  return [h, p, s];
}

export async function newAgentKey(alg: AgentKeyAlgorithm = 'ES256'): Promise<TestAgentKey> {
  const pair = (await crypto.subtle.generateKey(keyParams(alg), true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const privateJwk = (await crypto.subtle.exportKey('jwk', pair.privateKey)) as Jwk;
  const exported = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as Jwk;
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  let binary = '';
  for (const byte of der) binary += String.fromCharCode(byte);
  const body = (btoa(binary).match(/.{1,64}/g) ?? []).join('\n');

  return {
    alg,
    privateJwk,
    publicJwk: {
      kty: exported.kty,
      crv: exported.crv,
      x: exported.x,
      ...(exported.y ? { y: exported.y } : {}),
    },
    pkcs8Pem: `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`,
  };
}

export function decodeJwt(token: string): {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
} {
  const [h, p] = parts(token);
  const decoder = new TextDecoder();
  return {
    header: JSON.parse(decoder.decode(fromBase64url(h))) as Record<string, unknown>,
    payload: JSON.parse(decoder.decode(fromBase64url(p))) as Record<string, unknown>,
  };
}

/** Verifies a compact JWS against a public JWK with WebCrypto. */
export async function verifyJws(
  token: string,
  publicJwk: Jwk,
  alg: AgentKeyAlgorithm,
): Promise<boolean> {
  const [h, p, s] = parts(token);
  const key = await crypto.subtle.importKey('jwk', publicJwk as JsonWebKey, keyParams(alg), false, [
    'verify',
  ]);
  return crypto.subtle.verify(
    alg === 'ES256' ? { name: 'ECDSA', hash: 'SHA-256' } : { name: 'Ed25519' },
    key,
    fromBase64url(s),
    encoder.encode(`${h}.${p}`),
  );
}

export async function sha256b64url(value: string): Promise<string> {
  return toBase64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

/** The DPoP header of a captured request, or a failed test. */
export function proofOf(headers: Headers | undefined): string {
  const proof = headers?.get('dpop');
  if (!proof) throw new Error('no DPoP header');
  return proof;
}
