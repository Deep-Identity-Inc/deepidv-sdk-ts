import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
  FileUploader,
  HttpClient,
  TypedEmitter,
  ValidationError,
  resolveConfig,
} from '@deepidv/core';
import { Profiles } from '../profiles.js';
import { server } from './setup.js';

const BASE_URL = 'https://api.deepidv.com';
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, ...new Array<number>(100).fill(0)]);
const PROFILE = {
  id: 'profile_1',
  name: 'Acme onboarding',
  organizationId: 'org_1',
  logoUrl: 'organizations/org_1/profiles/logo.png',
  createdAt: '2026-09-30T10:00:00.000Z',
  updatedAt: '2026-09-30T10:00:00.000Z',
};

function createProfiles(maxRetries = 0) {
  const config = resolveConfig({ apiKey: 'sk_test', baseUrl: BASE_URL, maxRetries });
  const emitter = new TypedEmitter();
  const client = new HttpClient(config, emitter);
  return new Profiles(client, new FileUploader(config, client, emitter));
}

describe('Profiles', () => {
  it('creates a profile without a logo and disables retries', async () => {
    let calls = 0;
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/v1/profiles`, async ({ request }) => {
        calls += 1;
        body = await request.json();
        return calls === 1
          ? HttpResponse.json({ error: 'down' }, { status: 503 })
          : HttpResponse.json(PROFILE);
      }),
    );

    await expect(createProfiles(2).create({ name: 'Acme onboarding' })).rejects.toThrow();
    expect(calls).toBe(1);
    expect(body).toEqual({ name: 'Acme onboarding' });
  });

  it('creates a profile with an existing logo file key', async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/v1/profiles`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(PROFILE);
      }),
    );

    const result = await createProfiles().create({
      name: 'Acme onboarding',
      logoUrl: PROFILE.logoUrl,
    });
    expect(body).toEqual({ name: 'Acme onboarding', logoUrl: PROFILE.logoUrl });
    expect(result).toEqual(PROFILE);
  });

  it('uploads a logo before creating the profile', async () => {
    let presignBody: unknown;
    let createBody: unknown;
    let putContentType: string | null = null;
    server.use(
      http.post(`${BASE_URL}/v1/profiles/logo-upload-url`, async ({ request }) => {
        presignBody = await request.json();
        return HttpResponse.json({
          uploadUrl: 'https://s3.example.com/profile-logo',
          fileKey: PROFILE.logoUrl,
        });
      }),
      http.put('https://s3.example.com/profile-logo', ({ request }) => {
        putContentType = request.headers.get('content-type');
        return new HttpResponse(null, { status: 200 });
      }),
      http.post(`${BASE_URL}/v1/profiles`, async ({ request }) => {
        createBody = await request.json();
        return HttpResponse.json(PROFILE);
      }),
    );

    await createProfiles().create({
      name: 'Acme onboarding',
      logo: { file: PNG_BYTES, contentType: 'image/png' },
    });

    expect(presignBody).toEqual({ contentType: 'image/png', byteLength: PNG_BYTES.byteLength });
    expect(putContentType).toBe('image/png');
    expect(createBody).toEqual({ name: 'Acme onboarding', logoUrl: PROFILE.logoUrl });
  });

  it('lists profiles and strips unknown profile fields', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/profiles`, () =>
        HttpResponse.json({ profiles: [{ ...PROFILE, internal: true }] }),
      ),
    );
    const result = await createProfiles().list();
    expect(result).toEqual({ profiles: [PROFILE] });
  });

  it('retrieves a profile using an encoded ID', async () => {
    let requestUrl = '';
    server.use(
      http.get(`${BASE_URL}/v1/profiles/profile%2F1`, ({ request }) => {
        requestUrl = request.url;
        return HttpResponse.json(PROFILE);
      }),
    );
    await createProfiles().retrieve('profile/1');
    expect(requestUrl).toBe(`${BASE_URL}/v1/profiles/profile%2F1`);
  });

  it('supports the raw profile-logo presign operation', async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/v1/profiles/logo-upload-url`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ uploadUrl: 'https://s3.example.com/logo', fileKey: 'logo-key' });
      }),
    );
    const result = await createProfiles().createLogoUploadUrl({
      contentType: 'image/webp',
      byteLength: 123,
    });
    expect(body).toEqual({ contentType: 'image/webp', byteLength: 123 });
    expect(result).toEqual({ uploadUrl: 'https://s3.example.com/logo', fileKey: 'logo-key' });
  });

  it('uploads GIF logos with the explicit content type and returns the file key', async () => {
    let putRequest: Request | undefined;
    server.use(
      http.post(`${BASE_URL}/v1/profiles/logo-upload-url`, () =>
        HttpResponse.json({ uploadUrl: 'https://s3.example.com/logo', fileKey: 'logo-key' }),
      ),
      http.put('https://s3.example.com/logo', ({ request }) => {
        putRequest = request;
        return new HttpResponse(null, { status: 200 });
      }),
    );
    const result = await createProfiles().uploadLogo({
      file: new Uint8Array([0x47, 0x49, 0x46, 0x38]),
      contentType: 'image/gif',
    });
    expect(result).toBe('logo-key');
    expect(putRequest?.headers.get('content-type')).toBe('image/gif');
    expect(putRequest?.headers.get('x-api-key')).toBeNull();
  });

  it('rejects invalid input before making a request', async () => {
    const profiles = createProfiles();
    await expect(profiles.create({ name: '' })).rejects.toThrow(ValidationError);
    await expect(
      profiles.create({
        name: 'Acme',
        logoUrl: 'existing-key',
        logo: { file: PNG_BYTES, contentType: 'image/png' },
      }),
    ).rejects.toThrow(ValidationError);
    await expect(profiles.retrieve('')).rejects.toThrow(ValidationError);
    await expect(
      profiles.createLogoUploadUrl({ contentType: 'image/png', byteLength: 15 * 1024 * 1024 + 1 }),
    ).rejects.toThrow(ValidationError);
  });
});
