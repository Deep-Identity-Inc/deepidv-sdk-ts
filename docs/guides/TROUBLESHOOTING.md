# Troubleshooting

Common errors and how to fix them.

## AuthenticationError (401)

**Message:** `Invalid API key` or `Unauthorized`

**Causes:**
- API key is wrong, expired, or revoked
- Environment variable is not set or is empty
- Typo in the key

**Fix:**
```typescript
// Check your key is set
console.log('Key exists:', !!process.env.DEEPIDV_API_KEY);
console.log('Key length:', process.env.DEEPIDV_API_KEY?.length);

// The error shows the last 4 chars of the key used
catch (err) {
  if (err instanceof AuthenticationError) {
    console.log('Key ending:', err.redactedKey); // "****abcd"
  }
}
```

## ValidationError (400)

**Message:** Varies — includes the field name and what was expected.

**Causes:**
- Missing required field
- Wrong type for a field
- Invalid value (e.g., empty `apiKey`, invalid `email` format)

**Examples:**
```
"Required at 'image'"                     → forgot to pass image
"Required at 'firstName'"                 → missing name in session create
"Invalid email at 'email'"                → malformed email
"apiKey is required"                      → empty or missing apiKey in config
"expected Buffer, Uint8Array, ReadableStream, or string at 'image'"  → wrong input type
```

**Fix:** Check the exact field name in the error message and compare with the [API Reference](../reference/API.md).

## TimeoutError

**Message:** `Request timed out` or `Upload timed out`

**Causes:**
- API is slow to respond
- Large file upload on a slow connection
- Network congestion

**Fix:**
```typescript
const client = new DeepIDV({
  apiKey: process.env.DEEPIDV_API_KEY!,
  timeout: 60_000,       // Increase API timeout to 60s (default: 30s)
  uploadTimeout: 300_000, // Increase upload timeout to 5min (default: 120s)
});
```

## NetworkError

**Message:** `fetch failed` or `Failed to fetch` or DNS/connection error details.

**Causes:**
- No internet connection
- DNS resolution failure
- Firewall blocking outbound HTTPS
- Wrong `baseUrl`

**Fix:**
```bash
# Test connectivity
curl -I https://api.deepidv.com

# Check DNS
nslookup api.deepidv.com
```

If you're behind a proxy:
```typescript
const client = new DeepIDV({
  apiKey: process.env.DEEPIDV_API_KEY!,
  fetch: (url, init) => fetch(url, { ...init, dispatcher: proxyAgent }),
});
```

## RateLimitError (429)

**Message:** `Too Many Requests` or `Rate limit exceeded`

The SDK already retried 3 times with exponential backoff before throwing this error.

**Causes:**
- Too many requests in a short period
- Account-level rate limit reached

**Fix:**
- Reduce request frequency
- Implement your own queue/throttle on top
- Contact deepidv to increase your rate limit
- Check `err.retryAfter` for the server-suggested wait time

## File Path Not Supported

**Message:** `File path input is not supported in this runtime`

**Cause:** You passed a file path string on Cloudflare Workers or another edge runtime that doesn't have filesystem access.

**Fix:** Pass `Uint8Array` instead:
```typescript
// Instead of this (only works on Node/Deno/Bun):
await client.document.scan({ image: '/path/to/file.jpg' });

// Do this (works everywhere):
const bytes = new Uint8Array(await file.arrayBuffer());
await client.document.scan({ image: bytes });
```

## Unsupported Image Format

**Message:** `Unsupported image format` or `Unable to detect content type`

**Cause:** The SDK checks magic bytes and only supports JPEG, PNG, and WebP.

**Fix:**
- Ensure you're passing an actual image file (not a text file, PDF, etc.)
- Convert to JPEG or PNG before passing to the SDK
- Check that the file isn't corrupted (first few bytes intact)

## ESM / CJS Import Issues

### `ERR_REQUIRE_ESM`

**Cause:** Using `require()` in a project that's configured for ESM.

**Fix:** Use `import`:
```typescript
// Instead of:
const { DeepIDV } = require('@deepidv/server');

// Use:
import { DeepIDV } from '@deepidv/server';
```

### `Cannot find module '@deepidv/server'`

**Cause:** Package not installed, or `moduleResolution` not set correctly.

**Fix:**
```bash
npm install @deepidv/server
```

In `tsconfig.json`, use one of:
```json
{
  "compilerOptions": {
    "moduleResolution": "bundler"
  }
}
```
or `"node16"` / `"nodenext"`.

### Types Not Resolving

**Cause:** `moduleResolution` set to `"node"` (legacy).

**Fix:** Switch to `"bundler"`, `"node16"`, or `"nodenext"` in `tsconfig.json`. The SDK uses the `exports` map in `package.json`, which requires modern module resolution.

## Debugging with Events

Enable verbose logging to see what the SDK is doing:

```typescript
client.on('request', ({ method, url }) => {
  console.debug(`→ ${method} ${url}`);
});

client.on('response', ({ status, url, durationMs }) => {
  console.debug(`← ${status} ${url} (${durationMs}ms)`);
});

client.on('retry', ({ attempt, delayMs, error }) => {
  console.warn(`↻ Retry #${attempt} in ${delayMs}ms`, error);
});

client.on('error', ({ error }) => {
  console.error('✗ Final error:', error);
});

client.on('upload:start', ({ bytes, contentType }) => {
  console.debug(`⬆ Uploading ${bytes} bytes (${contentType})`);
});

client.on('upload:complete', ({ contentType }) => {
  console.debug(`✓ Upload complete (${contentType})`);
});
```
