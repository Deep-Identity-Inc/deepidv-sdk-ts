# Authentication

The SDK authenticates every API request using an `x-api-key` header. This guide covers setup, security, and advanced configurations.

## Basic Setup

```typescript
import { DeepIDV } from '@deepidv/server';

const client = new DeepIDV({
  apiKey: process.env.DEEPIDV_API_KEY!,
});
```

The `apiKey` is the only required configuration field. Every HTTP request to `api.deepidv.com` automatically includes:

```http
x-api-key: your-api-key-here
Accept: application/json
```

## Security Best Practices

### Use Environment Variables

Never hardcode API keys:

```typescript
// Bad - key in source code
const client = new DeepIDV({ apiKey: 'sk_live_abc123...' });

// Good - key from environment
const client = new DeepIDV({ apiKey: process.env.DEEPIDV_API_KEY! });
```

### Never Log the Full Key

The SDK automatically redacts API keys in error output. If you need to log which key is being used, use the redacted form:

```typescript
try {
  await client.document.scan({ image });
} catch (err) {
  if (err instanceof AuthenticationError) {
    // Safe to log - only shows last 4 chars
    console.error(`Auth failed with key: ${err.redactedKey}`);
    // → "Auth failed with key: ****abcd"
  }
}
```

### Rotate Keys

If a key is compromised:
1. Generate a new API key in the deepidv dashboard
2. Update your environment variable
3. Revoke the old key
4. No code changes needed — the key is externalized

### Key Per Environment

Use different keys for development, staging, and production:

```bash
# .env.development
DEEPIDV_API_KEY=sk_test_dev_...

# .env.production
DEEPIDV_API_KEY=sk_live_prod_...
```

## API Key Redaction

When an `AuthenticationError` is thrown, the SDK stores only a redacted version of the key:

```typescript
const error = new AuthenticationError('Invalid API key', 'sk_live_abc123xyz');
console.log(error.redactedKey); // "****xyz"
```

When serialized with `JSON.stringify()`, the full key is never included:

```typescript
JSON.stringify(error);
// {
//   "type": "AuthenticationError",
//   "message": "Invalid API key",
//   "status": 401,
//   "redactedKey": "****xyz"
// }
```

This means it's safe to send errors to Sentry, Datadog, or any error tracking service.

## Custom Fetch for Proxy / mTLS

If you need to route requests through a proxy or add mutual TLS certificates, provide a custom `fetch` implementation:

```typescript
import { DeepIDV } from '@deepidv/server';
import { ProxyAgent } from 'undici';

const dispatcher = new ProxyAgent('https://proxy.internal:8080');

const client = new DeepIDV({
  apiKey: process.env.DEEPIDV_API_KEY!,
  fetch: (url, init) => fetch(url, { ...init, dispatcher }),
});
```

### Cloudflare Workers Service Binding

```typescript
const client = new DeepIDV({
  apiKey: env.DEEPIDV_API_KEY,
  fetch: env.DEEPIDV_SERVICE.fetch.bind(env.DEEPIDV_SERVICE),
});
```

## Validation

The SDK validates the API key synchronously at construction time:

```typescript
// Throws ValidationError - apiKey cannot be empty
new DeepIDV({ apiKey: '' });

// Throws ValidationError - apiKey is required
new DeepIDV({} as any);
```

This catches configuration errors immediately, before any network call.
