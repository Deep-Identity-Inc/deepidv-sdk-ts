import { z } from 'zod';
import type { FileInput } from '@deepidv/core';

const FileInputSchema = z.custom<FileInput>(
  (value) =>
    value instanceof Uint8Array ||
    (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream) ||
    typeof value === 'string',
  { message: 'expected Buffer, Uint8Array, ReadableStream, or string' },
);

/** Image formats accepted by the profile-logo upload endpoint. */
export const ProfileLogoContentTypeSchema = z.enum([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/** Input for requesting a presigned profile-logo upload URL. */
export const ProfileLogoUploadUrlInputSchema = z.object({
  contentType: ProfileLogoContentTypeSchema,
  byteLength: z
    .number()
    .int()
    .positive()
    .max(15 * 1024 * 1024),
});

/** Presigned target returned for a profile-logo upload. */
export const ProfileLogoUploadUrlResultSchema = z.object({
  uploadUrl: z.string(),
  fileKey: z.string(),
});

/** File input accepted by the high-level profile-logo upload helper. */
export const ProfileLogoUploadInputSchema = z.object({
  file: FileInputSchema,
  contentType: ProfileLogoContentTypeSchema,
});

/** Input for creating an organization branding profile. */
export const ProfileCreateInputSchema = z
  .object({
    name: z.string().min(1),
    logoUrl: z.string().optional(),
    logo: ProfileLogoUploadInputSchema.optional(),
  })
  .superRefine((input, context) => {
    if (input.logoUrl !== undefined && input.logo !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['logo'],
        message: 'logo and logoUrl are mutually exclusive',
      });
    }
  });

/** Organization branding profile returned by the API. */
export const ProfileSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    organizationId: z.string(),
    logoUrl: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strip();

/** Result returned when listing organization branding profiles. */
export const ProfileListResultSchema = z.object({
  profiles: z.array(ProfileSchema),
});

export type ProfileLogoContentType = z.infer<typeof ProfileLogoContentTypeSchema>;
export type ProfileLogoUploadUrlInput = z.infer<typeof ProfileLogoUploadUrlInputSchema>;
export type ProfileLogoUploadUrlResult = z.infer<typeof ProfileLogoUploadUrlResultSchema>;
export type ProfileLogoUploadInput = z.infer<typeof ProfileLogoUploadInputSchema>;
export type ProfileCreateInput = z.infer<typeof ProfileCreateInputSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type ProfileListResult = z.infer<typeof ProfileListResultSchema>;
