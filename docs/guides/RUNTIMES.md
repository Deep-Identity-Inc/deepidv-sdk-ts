# Supported Runtimes

The SDK uses only native web APIs (`fetch`, `AbortController`, `ReadableStream`, `Uint8Array`) and has a single dependency (zod). This enables support across multiple JavaScript runtimes.

## Runtime Support Matrix

| Feature | Node.js 18+ | Deno | Bun | Cloudflare Workers |
|---------|-------------|------|-----|-------------------|
| All API methods | Yes | Yes | Yes | Yes |
| File path input | Yes | Yes | Yes | **No** |
| Buffer input | Yes | Yes | Yes | Yes |
| Uint8Array input | Yes | Yes | Yes | Yes |
| ReadableStream input | Yes | Yes | Yes | Yes |
| Base64 / data URL input | Yes | Yes | Yes | Yes |
| ESM import | Yes | Yes | Yes | Yes |
| CJS require | Yes | N/A | Yes | N/A |

## Node.js 18+

Full support. All features work, including file path input.

```typescript
import { DeepIDV } from '@deepidv/server';
// or
const { DeepIDV } = require('@deepidv/server');

const client = new DeepIDV({
  apiKey: process.env.DEEPIDV_API_KEY!,
});

// File path input works on Node
const result = await client.document.scan({
  image: '/path/to/document.jpg',
});
```

Node.js 18 is the minimum version because it's the first LTS release with stable native `fetch`.

## Deno

Works with ESM imports. File path input works via Deno's `fs` APIs.

```typescript
import { DeepIDV } from '@deepidv/server';

const client = new DeepIDV({
  apiKey: Deno.env.get('DEEPIDV_API_KEY')!,
});

const result = await client.document.scan({
  image: await Deno.readFile('document.jpg'), // Uint8Array
});
```

## Bun

Works with both ESM and CJS. File path input works via Bun's `fs` APIs.

```typescript
import { DeepIDV } from '@deepidv/server';

const client = new DeepIDV({
  apiKey: process.env.DEEPIDV_API_KEY!,
});

const result = await client.document.scan({
  image: await Bun.file('document.jpg').arrayBuffer().then(b => new Uint8Array(b)),
});
```

## Cloudflare Workers

Works with ESM imports. **File path input is not supported** — edge runtimes don't have a filesystem. Pass `Uint8Array` or `ReadableStream` instead.

```typescript
import { DeepIDV } from '@deepidv/server';

export default {
  async fetch(request: Request, env: Env) {
    const client = new DeepIDV({
      apiKey: env.DEEPIDV_API_KEY,
    });

    const formData = await request.formData();
    const file = formData.get('document') as File;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const result = await client.document.scan({ image: bytes });

    return Response.json(result);
  },
};
```

If you pass a file path string on an edge runtime, the SDK throws a `ValidationError`:

```
File path input is not supported in this runtime. Pass a Uint8Array, ReadableStream, or base64 string instead.
```

## Custom Fetch

All runtimes support injecting a custom `fetch` implementation:

```typescript
const client = new DeepIDV({
  apiKey: 'your-key',
  fetch: customFetchImplementation,
});
```

This is useful for:
- Proxy routing
- Mutual TLS (mTLS)
- Cloudflare Workers service bindings
- Test environments with intercepted HTTP

## Build Output

The SDK publishes dual format:

| File | Format | Used By |
|------|--------|---------|
| `dist/index.js` | ESM | Node.js (type: module), Deno, Bun, Workers |
| `dist/index.cjs` | CJS | Node.js (require) |
| `dist/index.d.ts` | TypeScript declarations | IDEs, tsc |
| `dist/index.d.cts` | CTS declarations | CJS TypeScript projects |

The `package.json` `exports` map resolves the correct format automatically based on how you import the package.
