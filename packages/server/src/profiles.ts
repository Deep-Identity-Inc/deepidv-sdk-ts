import { z } from 'zod';
import type { FileUploader, HttpClient } from '@deepidv/core';
import { mapZodError, ValidationError } from '@deepidv/core';
import {
  ProfileCreateInputSchema,
  ProfileListResultSchema,
  ProfileLogoUploadInputSchema,
  ProfileLogoUploadUrlInputSchema,
  ProfileLogoUploadUrlResultSchema,
  ProfileSchema,
  type Profile,
  type ProfileListResult,
  type ProfileLogoUploadUrlResult,
} from './profiles.types.js';

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw mapZodError(parsed.error);
  return parsed.data;
}

/** Organization branding profiles and profile-logo uploads. */
export class Profiles {
  constructor(
    private readonly client: HttpClient,
    private readonly uploader: FileUploader,
  ) {}

  async create(input: z.input<typeof ProfileCreateInputSchema>): Promise<Profile> {
    const parsed = parse(ProfileCreateInputSchema, input);
    const logoUrl = parsed.logo ? await this.uploadLogo(parsed.logo) : parsed.logoUrl;
    const body = logoUrl === undefined ? { name: parsed.name } : { name: parsed.name, logoUrl };
    const raw = await this.client.post<unknown>('/v1/profiles', body, { maxRetries: 0 });
    return ProfileSchema.parse(raw);
  }

  async list(): Promise<ProfileListResult> {
    const raw = await this.client.get<unknown>('/v1/profiles');
    return ProfileListResultSchema.parse(raw);
  }

  async retrieve(profileId: string): Promise<Profile> {
    if (typeof profileId !== 'string' || profileId.trim() === '') {
      throw new ValidationError("expected non-empty string at 'profileId'");
    }
    const raw = await this.client.get<unknown>(`/v1/profiles/${encodeURIComponent(profileId)}`);
    return ProfileSchema.parse(raw);
  }

  async createLogoUploadUrl(
    input: z.input<typeof ProfileLogoUploadUrlInputSchema>,
  ): Promise<ProfileLogoUploadUrlResult> {
    const body = parse(ProfileLogoUploadUrlInputSchema, input);
    const raw = await this.client.post<unknown>('/v1/profiles/logo-upload-url', body);
    return ProfileLogoUploadUrlResultSchema.parse(raw);
  }

  async uploadLogo(input: z.input<typeof ProfileLogoUploadInputSchema>): Promise<string> {
    const parsed = parse(ProfileLogoUploadInputSchema, input);
    return this.uploader.uploadWithPresign(parsed.file, parsed.contentType, (metadata) =>
      this.createLogoUploadUrl({ ...metadata, contentType: parsed.contentType }),
    );
  }
}
