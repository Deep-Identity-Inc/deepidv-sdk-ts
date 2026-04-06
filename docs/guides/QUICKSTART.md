# Quickstart

Get identity verification results in under 2 minutes.

## Install

```bash
# npm
npm install @deepidv/server

# pnpm
pnpm add @deepidv/server

# yarn
yarn add @deepidv/server
```

## Initialize

```typescript
import { DeepIDV } from '@deepidv/server';

const client = new DeepIDV({
  apiKey: process.env.DEEPIDV_API_KEY!,
});
```

## Create a Verification Session

The fastest path — create a hosted session and send the user to verify:

```typescript
const session = await client.sessions.create({
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  phone: '+15551234567',
});

console.log(session.sessionUrl);
// → "https://verify.deepidv.com/session/abc123"
// Send this URL to your user
```

## Scan a Document

Pass an image file and get structured OCR data back:

```typescript
import { readFileSync } from 'fs';

const result = await client.document.scan({
  image: readFileSync('drivers-license.jpg'),
});

console.log(result.fullName);        // "Jane Doe"
console.log(result.dateOfBirth);     // "1990-01-15"
console.log(result.documentNumber);  // "D1234567"
console.log(result.confidence);      // 0.97
```

## Compare Two Faces

Check if two images show the same person:

```typescript
const match = await client.face.compare({
  source: readFileSync('id-photo.jpg'),
  target: readFileSync('selfie.jpg'),
});

console.log(match.isMatch);     // true
console.log(match.confidence);  // 0.94
```

## Full Identity Verification

Document scan + face detection + face comparison in one call:

```typescript
const verification = await client.identity.verify({
  documentImage: readFileSync('passport.jpg'),
  faceImage: readFileSync('selfie.jpg'),
});

console.log(verification.verified);           // true
console.log(verification.overallConfidence);  // 0.96
console.log(verification.document.fullName);  // "Jane Doe"
console.log(verification.faceMatch.isMatch);  // true
```

## Next Steps

- [Authentication Guide](./AUTHENTICATION.md) — API key setup and security
- [Session-Based Verification](./SESSION-VERIFICATION.md) — hosted verification flow
- [Server-to-Server Verification](./SERVER-TO-SERVER.md) — build your own flow with primitives
- [Configuration Reference](../reference/CONFIGURATION.md) — all config options
- [API Reference](../reference/API.md) — full method documentation
