/**
 * DPoP (RFC 9449) for the getai.id AI agent MCP endpoint.
 *
 * `createDpopFetch` wraps `fetch` so the requests the MCP TypeScript SDK
 * makes carry a fresh DPoP proof signed with the AI agent's registered key:
 * the token request (which binds the access token to the key) and every MCP
 * request made with a bound token (which then also proves possession of
 * it). Discovery GETs and requests with an unbound bearer token pass
 * through untouched.
 *
 * WebCrypto only, so it needs a runtime with global WebCrypto
 * (`globalThis.crypto`): Node 20+, Deno, Bun and edge runtimes.
 *
 * @module agentPay/dpopFetch
 */

/** Signing algorithms the endpoint accepts for AI agent keys. */
export type AgentKeyAlgorithm = 'ES256' | 'EdDSA';

/** A JSON Web Key; only the members used here are typed. */
export interface Jwk {
  /** Key type: `EC` for ES256 keys, `OKP` for EdDSA keys. */
  kty: string;
  /** Curve: `P-256` for ES256, `Ed25519` for EdDSA. */
  crv?: string;
  /** Public key: the x coordinate (EC) or the public key bytes (OKP), base64url. */
  x?: string;
  /** Public key: the y coordinate, base64url. EC keys only. */
  y?: string;
  /** Private key material, base64url. Present in private JWKs only. */
  d?: string;
  /** Any other JWK member (`kid`, `use`, `key_ops`, ...). */
  [member: string]: unknown;
}

/**
 * The `fetch` signature the MCP SDK transport uses: a string or URL plus
 * `init`. `Request` objects are not accepted.
 */
export type FetchLike = (url: string | URL, init?: RequestInit) => Promise<Response>;

/** Options for {@link createDpopFetch}. */
export interface DpopFetchOptions {
  /** The AI agent's private key: a PKCS#8 PEM string or a private JWK. */
  privateKey: string | Jwk;
  /**
   * The matching public JWK, as registered for the AI agent. Derived from
   * `privateKey` when omitted; when given, it must match `privateKey`.
   */
  publicJwk?: Jwk;
  /** `ES256` (P-256) or `EdDSA` (Ed25519). */
  alg: AgentKeyAlgorithm;
  /** The `fetch` to wrap. Defaults to the global `fetch`. */
  fetch?: FetchLike;
}

/** Input for {@link signDpopProof}. */
export interface DpopProofInput {
  /** The private signing key, as returned by {@link importAgentPrivateKey}. */
  key: CryptoKey;
  /** The public JWK placed in the proof header; must match `key`. */
  publicJwk: Jwk;
  /** The signing algorithm of `key`. */
  alg: AgentKeyAlgorithm;
  /** The HTTP method of the request (`htm`). */
  method: string;
  /** The request URL; query and fragment are dropped for `htu`. */
  url: string | URL;
  /** The access token the request carries; adds `ath` to bind the proof to it. */
  accessToken?: string;
  /** The proof time (`iat`). Defaults to now. */
  now?: Date;
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

const PKCS8_BLOCK = /-----BEGIN PRIVATE KEY-----([\s\S]*?)-----END PRIVATE KEY-----/;

/**
 * The DER of the `BEGIN PRIVATE KEY` block. Accepts literal `\n` escapes
 * (keys pasted into environment variables) and ignores any other blocks.
 */
function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  const text = pem.replace(/\\r/g, '').replace(/\\n/g, '\n');
  const body = PKCS8_BLOCK.exec(text)?.[1]?.replace(/\s+/g, '');
  if (!body) {
    throw new TypeError(
      'privateKey must be a PKCS#8 PEM (-----BEGIN PRIVATE KEY-----) or a private JWK',
    );
  }
  let binary: string;
  try {
    binary = atob(body);
  } catch {
    throw new TypeError('privateKey PEM is not valid base64');
  }
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

/** Throws unless the JWK's `kty` and `crv` fit `alg`. */
function assertKeyType(jwk: Jwk, alg: AgentKeyAlgorithm, name: string): void {
  const [kty, crv] = alg === 'ES256' ? ['EC', 'P-256'] : ['OKP', 'Ed25519'];
  if (jwk.kty !== kty || jwk.crv !== crv) {
    throw new TypeError(
      `${name} must be a ${kty} ${crv} key for ${alg}, got ${jwk.kty} ${String(jwk.crv)}`,
    );
  }
}

/** Imports the private key for signing; a PEM must be PKCS#8 (`BEGIN PRIVATE KEY`). */
export async function importAgentPrivateKey(
  privateKey: string | Jwk,
  alg: AgentKeyAlgorithm,
  extractable = false,
): Promise<CryptoKey> {
  if (typeof privateKey === 'string') {
    return crypto.subtle.importKey('pkcs8', pemToDer(privateKey), importParams(alg), extractable, [
      'sign',
    ]);
  }

  assertKeyType(privateKey, alg, 'privateKey');
  return crypto.subtle.importKey('jwk', privateKey as JsonWebKey, importParams(alg), extractable, [
    'sign',
  ]);
}

/** The public members only, in the order RFC 7638 lists them. */
function publicMembers(jwk: Jwk): Jwk {
  return jwk.kty === 'EC'
    ? { kty: 'EC', crv: jwk.crv, x: jwk.x, y: jwk.y }
    : { kty: jwk.kty, crv: jwk.crv, x: jwk.x };
}

/** The checks on a caller's public JWK that need no key import. */
function checkPublicJwk(publicJwk: Jwk, alg: AgentKeyAlgorithm): void {
  if (publicJwk.d !== undefined) {
    throw new TypeError('publicJwk must not contain private key material');
  }
  assertKeyType(publicJwk, alg, 'publicJwk');
}

/** A private key resolved for signing, with its private and public JWKs. */
export interface ResolvedAgentKey {
  key: CryptoKey;
  privateJwk: Jwk;
  publicJwk: Jwk;
}

/**
 * Imports `privateKey`, derives its public JWK and, when `publicJwk` is
 * given, checks that it is the same key. Internal to this entry point.
 */
export async function resolveAgentKey(
  privateKey: string | Jwk,
  alg: AgentKeyAlgorithm,
  publicJwk?: Jwk,
): Promise<ResolvedAgentKey> {
  if (publicJwk) checkPublicJwk(publicJwk, alg);

  const exported = (await crypto.subtle.exportKey(
    'jwk',
    await importAgentPrivateKey(privateKey, alg, true),
  )) as Jwk;
  assertKeyType(exported, alg, 'privateKey');
  const derived = publicMembers(exported);
  const privateJwk: Jwk = { ...derived, d: exported.d };

  if (publicJwk && (publicJwk.x !== derived.x || publicJwk.y !== derived.y)) {
    throw new TypeError('publicJwk does not match privateKey');
  }

  const key = await crypto.subtle.importKey(
    'jwk',
    privateJwk as JsonWebKey,
    importParams(alg),
    false,
    ['sign'],
  );
  return { key, privateJwk, publicJwk: derived };
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
export async function signDpopProof(input: DpopProofInput): Promise<string> {
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

/**
 * Whether an access token is DPoP-bound: its payload (read without
 * verification; the server verifies it) carries `cnf.jkt`. Opaque tokens
 * count as unbound.
 */
function isBoundToken(token: string): boolean {
  const segments = token.split('.');
  const payload = segments[1];
  if (segments.length !== 3 || !payload) return false;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(json) as unknown;
    if (typeof claims !== 'object' || claims === null || !('cnf' in claims)) return false;
    const cnf: unknown = claims.cnf;
    return typeof cnf === 'object' && cnf !== null && 'jkt' in cnf && typeof cnf.jkt === 'string';
  } catch {
    return false;
  }
}

/**
 * Wraps `fetch` so requests carry a DPoP proof from the AI agent's key.
 *
 * - A request with a DPoP-bound access token (`cnf.jkt` in its payload) is
 *   sent as `Authorization: DPoP <token>` with a proof carrying `ath`.
 * - A request with an unbound token keeps `Bearer` and gets no proof: the
 *   server refuses the DPoP scheme for unbound tokens.
 * - Any other non-GET request (the token request) gets a proof without
 *   `ath`, which makes the token endpoint bind the token to the key.
 * - GETs without a token (discovery) pass through unchanged.
 *
 * Takes a string or URL plus `init`, as the MCP SDK transport calls it;
 * a `Request` object is refused with a TypeError.
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
  // Fail on a malformed public key now, not on the first request.
  if (options.publicJwk) checkPublicJwk(options.publicJwk, options.alg);
  const keyPromise = resolveAgentKey(options.privateKey, options.alg, options.publicJwk);
  // An unusable or mismatched key is reported on the first signed request,
  // never as an unhandled rejection.
  keyPromise.catch(() => undefined);

  return async (url, init) => {
    if (typeof url !== 'string' && !(url instanceof URL)) {
      throw new TypeError(
        'createDpopFetch takes a string or URL; pass the method and headers in init',
      );
    }

    const headers = new Headers(init?.headers);
    const method = (init?.method ?? 'GET').toUpperCase();
    const match = /^(Bearer|DPoP)\s+(\S+)$/i.exec(headers.get('authorization') ?? '');
    const token = match?.[2];

    if (token !== undefined) {
      const bound = match?.[1]?.toLowerCase() === 'dpop' || isBoundToken(token);
      if (!bound) return baseFetch(url, init);
    } else if (method === 'GET') {
      return baseFetch(url, init);
    }

    const { key, publicJwk } = await keyPromise;
    const proof = await signDpopProof({
      key,
      publicJwk,
      alg: options.alg,
      method,
      url,
      ...(token !== undefined ? { accessToken: token } : {}),
    });

    headers.set('dpop', proof);
    if (token !== undefined) {
      headers.set('authorization', `DPoP ${token}`);
    }

    return baseFetch(url, { ...init, headers });
  };
}
