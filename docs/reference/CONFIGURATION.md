# Configuration Reference

Every configuration option for the `DeepIDV` client.

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | **(required)** | API key for `x-api-key` authentication. Must be non-empty. |
| `baseUrl` | `string` | `"https://api.deepidv.com"` | API base URL. Override for staging/testing environments. |
| `timeout` | `number` | `30000` (30s) | Per-attempt timeout for API requests in milliseconds. Each retry attempt gets its own fresh timer. |
| `uploadTimeout` | `number` | `120000` (2min) | Per-attempt timeout for S3 file uploads in milliseconds. Separate from API timeout because uploads are larger/slower. |
| `maxRetries` | `number` | `3` | Maximum number of retry attempts for 429 and 5xx responses. Set to `0` to disable retries. |
| `initialRetryDelay` | `number` | `500` (ms) | Initial delay for exponential backoff calculation. Actual delay uses jitter: `random(0, initialDelay * 2^attempt)`. |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Custom fetch implementation. Useful for proxies, mTLS, service bindings, and testing. |

## Examples

### Minimal

```typescript
const client = new DeepIDV({
  apiKey: process.env.DEEPIDV_API_KEY!,
});
```

### Full Configuration

```typescript
const client = new DeepIDV({
  apiKey: process.env.DEEPIDV_API_KEY!,
  baseUrl: 'https://api-staging.deepidv.com',
  timeout: 15_000,
  uploadTimeout: 60_000,
  maxRetries: 5,
  initialRetryDelay: 1_000,
  fetch: customFetch,
});
```

### No Retries

```typescript
const client = new DeepIDV({
  apiKey: process.env.DEEPIDV_API_KEY!,
  maxRetries: 0,
});
```

### Fast Timeout (Low-Latency Use Case)

```typescript
const client = new DeepIDV({
  apiKey: process.env.DEEPIDV_API_KEY!,
  timeout: 5_000,       // 5s for API calls
  uploadTimeout: 30_000, // 30s for uploads
  maxRetries: 1,         // Only 1 retry
});
```

### Custom Fetch with Proxy

```typescript
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

All config options are validated synchronously at construction time using a Zod schema (`DeepIDVConfigSchema`):

| Validation | Error |
|-----------|-------|
| `apiKey` missing or empty | `ValidationError: apiKey is required` |
| `baseUrl` not a valid URL | `ValidationError: Invalid url` |
| `timeout` not positive | `ValidationError: Number must be greater than 0` |
| `uploadTimeout` not positive | `ValidationError: Number must be greater than 0` |
| `maxRetries` negative or non-integer | `ValidationError: Number must be greater than or equal to 0` |
| `initialRetryDelay` not positive | `ValidationError: Number must be greater than 0` |

Validation errors are thrown as `ValidationError` before any network call is made.

## Resolved Config

After construction, all defaults are applied. The internal `ResolvedConfig` type has every field as required:

```typescript
interface ResolvedConfig {
  apiKey: string;           // from user
  baseUrl: string;          // "https://api.deepidv.com" (trailing slash stripped)
  timeout: number;          // 30000
  uploadTimeout: number;    // 120000
  maxRetries: number;       // 3
  initialRetryDelay: number; // 500
  fetch: typeof fetch;      // globalThis.fetch
}
```
