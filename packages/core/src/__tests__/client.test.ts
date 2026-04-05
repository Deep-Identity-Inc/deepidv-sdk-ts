/**
 * Tests for HttpClient (client.ts).
 *
 * Uses msw to intercept native fetch calls and simulate API responses.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import { server } from './setup.js';
import { HttpClient } from '../client.js';
import { resolveConfig } from '../config.js';
import { TypedEmitter } from '../events.js';
import type { SDKEventMap } from '../events.js';
import {
  AuthenticationError,
  RateLimitError,
  ValidationError,
  DeepIDVError,
  NetworkError,
  TimeoutError,
} from '../errors.js';

const BASE_URL = 'https://api.deepidv.com';

/**
 * Creates a fresh HttpClient for tests.
 */
function createClient(overrides?: Partial<Parameters<typeof resolveConfig>[0]>) {
  const config = resolveConfig({
    apiKey: 'sk_test_key_1234',
    baseUrl: BASE_URL,
    timeout: 5_000,
    maxRetries: 0, // disable retries by default so tests are fast/deterministic
    ...overrides,
  });
  const emitter = new TypedEmitter<SDKEventMap>();
  return { client: new HttpClient(config, emitter), emitter, config };
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('HttpClient — happy path', () => {
  it('POST request returns parsed JSON body on 200', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/sessions`, () => {
        return HttpResponse.json({ id: 'sess_abc123' }, { status: 200 });
      }),
    );

    const { client } = createClient();
    const result = await client.post<{ id: string }>('/v1/sessions', { name: 'test' });
    expect(result).toEqual({ id: 'sess_abc123' });
  });

  it('GET request returns parsed JSON body on 200', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/sessions/sess_abc123`, () => {
        return HttpResponse.json({ id: 'sess_abc123', status: 'pending' });
      }),
    );

    const { client } = createClient();
    const result = await client.get<{ id: string; status: string }>('/v1/sessions/sess_abc123');
    expect(result).toEqual({ id: 'sess_abc123', status: 'pending' });
  });
});

// ---------------------------------------------------------------------------
// Auth header injection
// ---------------------------------------------------------------------------

describe('HttpClient — auth headers', () => {
  it('includes x-api-key header on every request', async () => {
    let capturedApiKey: string | null = null;

    server.use(
      http.post(`${BASE_URL}/v1/sessions`, ({ request }) => {
        capturedApiKey = request.headers.get('x-api-key');
        return HttpResponse.json({ id: 'sess_abc' });
      }),
    );

    const { client } = createClient();
    await client.post('/v1/sessions', {});
    expect(capturedApiKey).toBe('sk_test_key_1234');
  });

  it('includes Content-Type: application/json when body is present', async () => {
    let capturedContentType: string | null = null;

    server.use(
      http.post(`${BASE_URL}/v1/sessions`, ({ request }) => {
        capturedContentType = request.headers.get('content-type');
        return HttpResponse.json({ id: 'sess_abc' });
      }),
    );

    const { client } = createClient();
    await client.post('/v1/sessions', { name: 'test' });
    expect(capturedContentType).toContain('application/json');
  });

  it('does NOT include Content-Type on GET requests without body', async () => {
    let capturedContentType: string | null = 'initially-non-null';

    server.use(
      http.get(`${BASE_URL}/v1/sessions`, ({ request }) => {
        capturedContentType = request.headers.get('content-type');
        return HttpResponse.json([]);
      }),
    );

    const { client } = createClient();
    await client.get('/v1/sessions');
    expect(capturedContentType).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

describe('HttpClient — error mapping', () => {
  it('401 response throws AuthenticationError', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/sessions`, () => {
        return HttpResponse.json(
          { error: 'Invalid API key' },
          { status: 401 },
        );
      }),
    );

    const { client } = createClient();
    await expect(client.post('/v1/sessions', {})).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  it('AuthenticationError includes redacted API key', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/sessions`, () => {
        return HttpResponse.json({ error: 'Invalid API key' }, { status: 401 });
      }),
    );

    const { client } = createClient();
    try {
      await client.post('/v1/sessions', {});
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AuthenticationError);
      const err = e as AuthenticationError;
      expect(err.redactedKey).toContain('1234');
      expect(err.redactedKey).not.toContain('sk_test_key');
    }
  });

  it('429 response throws RateLimitError', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/sessions`, () => {
        return HttpResponse.json(
          { error: 'Too many requests' },
          { status: 429 },
        );
      }),
    );

    const { client } = createClient();
    await expect(client.post('/v1/sessions', {})).rejects.toBeInstanceOf(
      RateLimitError,
    );
  });

  it('400 response throws ValidationError', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/sessions`, () => {
        return HttpResponse.json(
          { error: 'Invalid request body' },
          { status: 400 },
        );
      }),
    );

    const { client } = createClient();
    await expect(client.post('/v1/sessions', {})).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('500 response throws DeepIDVError with status 500', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/sessions`, () => {
        return HttpResponse.json(
          { error: 'Internal server error' },
          { status: 500 },
        );
      }),
    );

    const { client } = createClient();
    try {
      await client.post('/v1/sessions', {});
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(DeepIDVError);
      expect((e as DeepIDVError).status).toBe(500);
    }
  });

  it('error response carries raw response body for debugging', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/sessions`, () => {
        return HttpResponse.json(
          { message: 'Invalid API key', code: 'auth_error' },
          { status: 401 },
        );
      }),
    );

    const { client } = createClient();
    try {
      await client.post('/v1/sessions', {});
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AuthenticationError);
      const err = e as AuthenticationError;
      expect(err.response).toBeDefined();
      expect(err.response?.status).toBe(401);
    }
  });
});

// ---------------------------------------------------------------------------
// Timeout
// ---------------------------------------------------------------------------

describe('HttpClient — timeout', () => {
  it('throws TimeoutError when request exceeds configured timeout', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/sessions`, async () => {
        // Delay longer than the configured timeout
        await delay(500);
        return HttpResponse.json({ id: 'sess_abc' });
      }),
    );

    // Very short timeout to trigger abort
    const { client } = createClient({ timeout: 50 });
    await expect(client.post('/v1/sessions', {})).rejects.toBeInstanceOf(
      TimeoutError,
    );
  });
});

// ---------------------------------------------------------------------------
// Per-attempt AbortController
// ---------------------------------------------------------------------------

describe('HttpClient — AbortController', () => {
  it('each attempt creates a fresh AbortController (not shared)', async () => {
    // If AbortController were shared, the second attempt would fail immediately
    // because the first would have aborted it.
    let callCount = 0;

    server.use(
      http.post(`${BASE_URL}/v1/sessions`, async () => {
        callCount++;
        if (callCount === 1) {
          // First attempt: delay to trigger timeout
          await delay(500);
          return HttpResponse.json({ error: 'slow' }, { status: 500 });
        }
        // Second attempt: respond immediately
        return HttpResponse.json({ id: 'sess_abc' });
      }),
    );

    // Short timeout + 1 retry: first attempt times out, second should succeed
    const config = resolveConfig({
      apiKey: 'sk_test_key_1234',
      baseUrl: BASE_URL,
      timeout: 50,
      maxRetries: 1,
    });
    const emitter = new TypedEmitter<SDKEventMap>();
    const client = new HttpClient(config, emitter);

    const result = await client.post<{ id: string }>('/v1/sessions', {});
    expect(result).toEqual({ id: 'sess_abc' });
    expect(callCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Custom fetch
// ---------------------------------------------------------------------------

describe('HttpClient — custom fetch', () => {
  it('uses custom fetch function from config (D-13)', async () => {
    const customFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'custom_sess' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const config = resolveConfig({
      apiKey: 'sk_test_key_1234',
      baseUrl: BASE_URL,
      fetch: customFetch as typeof globalThis.fetch,
    });
    const emitter = new TypedEmitter<SDKEventMap>();
    const client = new HttpClient(config, emitter);

    const result = await client.post<{ id: string }>('/v1/sessions', {});
    expect(customFetch).toHaveBeenCalledOnce();
    expect(result).toEqual({ id: 'custom_sess' });
  });
});

// ---------------------------------------------------------------------------
// Network failure
// ---------------------------------------------------------------------------

describe('HttpClient — network failure', () => {
  it('throws NetworkError when fetch throws TypeError', async () => {
    const networkFailFetch = vi.fn().mockRejectedValue(
      new TypeError('Failed to fetch'),
    );

    const config = resolveConfig({
      apiKey: 'sk_test_key_1234',
      baseUrl: BASE_URL,
      maxRetries: 0,
      fetch: networkFailFetch as typeof globalThis.fetch,
    });
    const emitter = new TypedEmitter<SDKEventMap>();
    const client = new HttpClient(config, emitter);

    await expect(client.get('/v1/sessions')).rejects.toBeInstanceOf(NetworkError);
  });
});

// ---------------------------------------------------------------------------
// Event lifecycle
// ---------------------------------------------------------------------------

describe('HttpClient — lifecycle events', () => {
  it('emits request event before fetch', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/sessions`, () => HttpResponse.json([])),
    );

    const { client, emitter } = createClient();
    const requestEvents: SDKEventMap['request'][] = [];
    emitter.on('request', (evt) => requestEvents.push(evt));

    await client.get('/v1/sessions');

    expect(requestEvents).toHaveLength(1);
    expect(requestEvents[0]).toMatchObject({
      method: 'GET',
      url: `${BASE_URL}/v1/sessions`,
    });
  });

  it('emits response event after successful fetch', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/sessions`, () => HttpResponse.json([])),
    );

    const { client, emitter } = createClient();
    const responseEvents: SDKEventMap['response'][] = [];
    emitter.on('response', (evt) => responseEvents.push(evt));

    await client.get('/v1/sessions');

    expect(responseEvents).toHaveLength(1);
    expect(responseEvents[0]).toMatchObject({
      status: 200,
      url: `${BASE_URL}/v1/sessions`,
    });
    expect(typeof responseEvents[0].durationMs).toBe('number');
  });

  it('emits error event on final failure after retries', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/sessions`, () => {
        return HttpResponse.json({ error: 'Server error' }, { status: 500 });
      }),
    );

    // maxRetries: 1 so it will attempt twice then emit error
    const { client, emitter } = createClient({ maxRetries: 1 });
    const errorEvents: SDKEventMap['error'][] = [];
    emitter.on('error', (evt) => errorEvents.push(evt));

    try {
      await client.post('/v1/sessions', {});
    } catch {
      // expected
    }

    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0].error).toBeInstanceOf(DeepIDVError);
  });
});

// ---------------------------------------------------------------------------
// Retry integration
// ---------------------------------------------------------------------------

describe('HttpClient — retry integration', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries 500 response up to maxRetries times and returns on success', async () => {
    let callCount = 0;

    server.use(
      http.post(`${BASE_URL}/v1/sessions`, () => {
        callCount++;
        if (callCount < 3) {
          return HttpResponse.json({ error: 'Server error' }, { status: 500 });
        }
        return HttpResponse.json({ id: 'sess_abc' });
      }),
    );

    const { client } = createClient({ maxRetries: 3, initialRetryDelay: 0 });
    const result = await client.post<{ id: string }>('/v1/sessions', {});
    expect(result).toEqual({ id: 'sess_abc' });
    expect(callCount).toBe(3);
  });

  it('does NOT retry 400 responses', async () => {
    let callCount = 0;

    server.use(
      http.post(`${BASE_URL}/v1/sessions`, () => {
        callCount++;
        return HttpResponse.json({ error: 'Bad request' }, { status: 400 });
      }),
    );

    const { client } = createClient({ maxRetries: 3 });
    await expect(client.post('/v1/sessions', {})).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(callCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Convenience methods
// ---------------------------------------------------------------------------

describe('HttpClient — convenience methods', () => {
  it('put() sends PUT request', async () => {
    let method: string | undefined;
    server.use(
      http.put(`${BASE_URL}/v1/sessions/sess_abc`, ({ request }) => {
        method = request.method;
        return HttpResponse.json({ id: 'sess_abc', status: 'approved' });
      }),
    );

    const { client } = createClient();
    await client.put('/v1/sessions/sess_abc', { status: 'approved' });
    expect(method).toBe('PUT');
  });

  it('patch() sends PATCH request', async () => {
    let method: string | undefined;
    server.use(
      http.patch(`${BASE_URL}/v1/sessions/sess_abc`, ({ request }) => {
        method = request.method;
        return HttpResponse.json({ id: 'sess_abc' });
      }),
    );

    const { client } = createClient();
    await client.patch('/v1/sessions/sess_abc', { note: 'test' });
    expect(method).toBe('PATCH');
  });

  it('delete() sends DELETE request', async () => {
    let method: string | undefined;
    server.use(
      http.delete(`${BASE_URL}/v1/sessions/sess_abc`, ({ request }) => {
        method = request.method;
        return HttpResponse.json({});
      }),
    );

    const { client } = createClient();
    await client.delete('/v1/sessions/sess_abc');
    expect(method).toBe('DELETE');
  });
});
