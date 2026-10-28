/**
 * DPoP (RFC 9449) for the getai.id AI agent MCP endpoint.
 *
 * `createDpopFetch` wraps `fetch` so every request the MCP TypeScript SDK
 * makes carries a fresh DPoP proof signed with the AI agent's registered
 * key: the token request (which binds the access token to the key) and
 * every MCP request (which then also proves possession of it). Plain
 * discovery GETs pass through untouched.
 *
 * WebCrypto only, so it runs on Node 20+, Deno, Bun and edge runtimes.
 *
 * @module agentPay/dpopFetch
 */

/** Signing algorithms the endpoint accepts for AI agent keys. */
export type AgentKeyAlgorithm = 'ES256' | 'EdDSA';

/** A JSON Web Key; only the members used here are typed. */
export interface Jwk {
  kty: string;
  crv?: string;
  x?: string;
  y?: string;
  d?: string;
  [member: string]: unknown;
}

/** The `fetch` signature the MCP SDK transport accepts. */
export type FetchLike = (url: string | URL, init?: RequestInit) => Promise<Response>;

/** Options for {@link createDpopFetch}. */
export interface DpopFetchOptions {
  /** The AI agent's private key: a PKCS#8 PEM string or a private JWK. */
  privateKey: string | Jwk;
  /** The matching public JWK, as registered for the AI agent. */
  publicJwk: Jwk;
  /** `ES256` (P-256) or `EdDSA` (Ed25519). */
  alg: AgentKeyAlgorithm;
  /** The `fetch` to wrap. Defaults to the global `fetch`. */
  fetch?: FetchLike;
}

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlJson(value: unknown): string {
  return base64url(encoder.encode(JSON.stringify(value)));
}

function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const der = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) der[i] = binary.charCodeAt(i);
  return der;
}

function importParams(alg: AgentKeyAlgorithm): EcKeyImportParams | Algorithm {
  return alg === 'ES256' ? { name: 'ECDSA', namedCurve: 'P-256' } : { name: 'Ed25519' };
}

function signParams(alg: AgentKeyAlgorithm): EcdsaParams | Algorithm {
  return alg === 'ES256' ? { name: 'ECDSA', hash: 'SHA-256' } : { name: 'Ed25519' };
}

/** Imports the private key for signing; a PEM must be PKCS#8 (`BEGIN PRIVATE KEY`). */
export async function importAgentPrivateKey(
  privateKey: string | Jwk,
  alg: AgentKeyAlgorithm,
): Promise<CryptoKey> {
  if (typeof privateKey === 'string') {
    if (!privateKey.includes('BEGIN PRIVATE KEY')) {
      throw new TypeError('privateKey must be a PKCS#8 PEM (BEGIN PRIVATE KEY) or a JWK');
    }
    return crypto.subtle.importKey('pkcs8', pemToDer(privateKey), importParams(alg), false, [
      'sign',
    ]);
  }

  return crypto.subtle.importKey('jwk', privateKey as JsonWebKey, importParams(alg), false, [
    'sign',
  ]);
}

/** The public members only, in the order RFC 7638 lists them. */
function publicMembers(jwk: Jwk): Jwk {
  if (jwk.d !== undefined) {
    throw new TypeError('publicJwk must not contain private key material');
  }
  return jwk.kty === 'EC'
    ? { kty: 'EC', crv: jwk.crv, x: jwk.x, y: jwk.y }
    : { kty: jwk.kty, crv: jwk.crv, x: jwk.x };
}

/** `htu`: scheme, host and path, without query or fragment (RFC 9449 §4.2). */
export function proofUrl(url: string | URL): string {
  const parsed = new URL(url.toString());
  return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
}

async function sha256Base64url(value: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

/**
 * Signs one DPoP proof. `accessToken`, when given, adds `ath` so the proof
 * is bound to that token.
 */
export async function signDpopProof(input: {
  key: CryptoKey;
  publicJwk: Jwk;
  alg: AgentKeyAlgorithm;
  method: string;
  url: string | URL;
  accessToken?: string;
  now?: Date;
}): Promise<string> {
  const header = { typ: 'dpop+jwt', alg: input.alg, jwk: publicMembers(input.publicJwk) };
  const claims: Record<string, unknown> = {
    jti: crypto.randomUUID(),
    htm: input.method.toUpperCase(),
    htu: proofUrl(input.url),
    iat: Math.floor((input.now ?? new Date()).getTime() / 1000),
  };
  if (input.accessToken !== undefined) {
    claims.ath = await sha256Base64url(input.accessToken);
  }

  const signingInput = `${base64urlJson(header)}.${base64urlJson(claims)}`;
  const signature = await crypto.subtle.sign(
    signParams(input.alg),
    input.key,
    encoder.encode(signingInput),
  );

  // WebCrypto ECDSA returns r||s, which is already the JWS encoding.
  return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}

function requestMethod(input: string | URL | Request, init?: RequestInit): string {
  return (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
}

/**
 * Wraps `fetch` so requests carry a DPoP proof from the AI agent's key.
 *
 * - A request with `Authorization: Bearer <token>` is switched to
 *   `Authorization: DPoP <token>` with a proof carrying `ath`.
 * - Any other non-GET request (the token request) gets a proof without
 *   `ath`, which makes the token endpoint bind the token to the key.
 * - GETs without a token (discovery) pass through unchanged.
 *
 * @example
 * ```typescript
 * const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
 *   authProvider,
 *   fetch: createDpopFetch({ privateKey, publicJwk, alg: 'ES256' }),
 * });
 * ```
 */
export function createDpopFetch(options: DpopFetchOptions): FetchLike {
  const baseFetch: FetchLike = options.fetch ?? ((url, init) => fetch(url, init));
  const keyPromise = importAgentPrivateKey(options.privateKey, options.alg);
  // An unusable key is reported on the first request; never as an unhandled rejection.
  keyPromise.catch(() => undefined);
  // Fail on a bad public key now, not on the first request.
  publicMembers(options.publicJwk);

  return async (url, init) => {
    const headers = new Headers(init?.headers);
    const method = requestMethod(url, init);
    const bearer = headers.get('authorization')?.match(/^(?:Bearer|DPoP)\s+(.+)$/i)?.[1];

    if (!bearer && method === 'GET') {
      return baseFetch(url, init);
    }

    const proof = await signDpopProof({
      key: await keyPromise,
      publicJwk: options.publicJwk,
      alg: options.alg,
      method,
      url,
      ...(bearer !== undefined ? { accessToken: bearer } : {}),
    });

    headers.set('dpop', proof);
    if (bearer !== undefined) {
      headers.set('authorization', `DPoP ${bearer}`);
    }

    return baseFetch(url, { ...init, headers });
  };
}
