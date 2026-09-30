/** OpenAPI-aligned schemas and public types for the sessions namespace. */

import { z } from 'zod';

export const SessionStatusSchema = z.string().min(1);
export const SessionTypeSchema = z.string().min(1);
export const SessionProgressSchema = z.string().min(1);
export const SessionStatusUpdateSchema = z.enum(['VERIFIED', 'REJECTED']);

const HttpsUrlSchema = z.url().refine((value) => new URL(value).protocol === 'https:', {
  message: 'redirectUrl must use HTTPS',
});

export const SessionCreateInputSchema = z.object({
  email: z.email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().regex(/^\+[1-9]\d{9,14}$/u, 'phone must be a valid E.164 number'),
  externalId: z.string().optional(),
  sendEmailInvite: z.boolean().optional(),
  sendPhoneInvite: z.boolean().optional(),
  workflowId: z.string().optional(),
  redirectUrl: HttpsUrlSchema.optional(),
  expiresInHours: z.number().int().min(1).max(8760).optional(),
});

export const SessionListParamsSchema = z.object({
  limit: z.number().int().min(1).max(500).optional(),
  nextToken: z.string().optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  byOrganization: z.boolean().nullable().optional(),
  externalId: z.string().optional(),
  workflowId: z.string().optional(),
});

export const SessionLinkSchema = z.object({
  rel: z.string(),
  href: z.string(),
  description: z.string().optional(),
});

export const SessionCreateResultSchema = z.object({
  id: z.string(),
  sessionUrl: z.string(),
  externalId: z.string().optional(),
  expiresAt: z.string().optional(),
  links: z.array(SessionLinkSchema),
});

export const SessionSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  senderUserId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: SessionStatusSchema,
  type: SessionTypeSchema,
  sessionProgress: SessionProgressSchema,
  externalId: z.string().optional(),
  permalinkId: z.string().optional(),
  location: z.string().nullable().optional(),
  submittedAt: z.string().optional(),
  deepSignId: z.string().optional(),
  faceLivenessSessionId: z.string().optional(),
  workflowId: z.string().optional(),
  bankStatementRequestId: z.string().optional(),
  redirectUrl: z.string().optional(),
  expiresAt: z.string().optional(),
  workflowSteps: z.array(z.string()).optional(),
  metaData: z.record(z.string(), z.unknown()).optional(),
  uploads: z.record(z.string(), z.boolean()).optional(),
  analysisData: z.record(z.string(), z.unknown()).optional(),
});

export const SessionListResultSchema = z.object({
  sessions: z.array(SessionSchema),
  nextToken: z.string().nullable(),
});

export const SessionRetrieveResultSchema = z.object({
  sessionRecord: SessionSchema,
  resourceLinks: z.record(z.string(), z.string()),
  user: z.record(z.string(), z.unknown()).optional(),
  senderUser: z.record(z.string(), z.unknown()).optional(),
});

export const SessionStatusUpdateResultSchema = z.object({
  sessionRecord: SessionSchema,
});

const RawSessionRecordSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  user_id: z.string(),
  sender_user_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  status: z.string(),
  type: z.string(),
  session_progress: z.string(),
  external_id: z.string().optional(),
  permalink_id: z.string().optional(),
  location: z.string().nullable().optional(),
  submitted_at: z.string().optional(),
  deep_sign_id: z.string().optional(),
  face_liveness_session_id: z.string().optional(),
  workflow_id: z.string().optional(),
  bank_statement_request_id: z.string().optional(),
  redirect_url: z.string().optional(),
  expires_at: z.string().optional(),
  workflow_steps: z.array(z.string()).optional(),
  meta_data: z.record(z.string(), z.unknown()).optional(),
  uploads: z.record(z.string(), z.boolean()).optional(),
  analysis_data: z.record(z.string(), z.unknown()).optional(),
});

function normalizeSession(raw: z.infer<typeof RawSessionRecordSchema>): Session {
  return {
    id: raw.id,
    organizationId: raw.organization_id,
    userId: raw.user_id,
    senderUserId: raw.sender_user_id,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    status: raw.status,
    type: raw.type,
    sessionProgress: raw.session_progress,
    externalId: raw.external_id,
    permalinkId: raw.permalink_id,
    location: raw.location,
    submittedAt: raw.submitted_at,
    deepSignId: raw.deep_sign_id,
    faceLivenessSessionId: raw.face_liveness_session_id,
    workflowId: raw.workflow_id,
    bankStatementRequestId: raw.bank_statement_request_id,
    redirectUrl: raw.redirect_url,
    expiresAt: raw.expires_at,
    workflowSteps: raw.workflow_steps,
    metaData: raw.meta_data,
    uploads: raw.uploads,
    analysisData: raw.analysis_data,
  };
}

export const SessionCreateWireResultSchema = z
  .object({
    id: z.string(),
    session_url: z.string(),
    externalId: z.string().optional(),
    expires_at: z.string().optional(),
    links: z.array(SessionLinkSchema),
  })
  .transform((raw) =>
    SessionCreateResultSchema.parse({
      id: raw.id,
      sessionUrl: raw.session_url,
      externalId: raw.externalId,
      expiresAt: raw.expires_at,
      links: raw.links,
    }),
  );

export const SessionListWireResultSchema = z
  .object({ sessions: z.array(RawSessionRecordSchema), next_token: z.string().nullable() })
  .transform((raw) =>
    SessionListResultSchema.parse({
      sessions: raw.sessions.map(normalizeSession),
      nextToken: raw.next_token,
    }),
  );

export const SessionRetrieveWireResultSchema = z
  .object({
    session_record: RawSessionRecordSchema,
    resource_links: z.record(z.string(), z.string()),
    user: z.record(z.string(), z.unknown()).optional(),
    sender_user: z.record(z.string(), z.unknown()).optional(),
  })
  .transform((raw) =>
    SessionRetrieveResultSchema.parse({
      sessionRecord: normalizeSession(raw.session_record),
      resourceLinks: raw.resource_links,
      user: raw.user,
      senderUser: raw.sender_user,
    }),
  );

export const SessionStatusUpdateWireResultSchema = z
  .object({ session_record: RawSessionRecordSchema })
  .transform((raw) =>
    SessionStatusUpdateResultSchema.parse({ sessionRecord: normalizeSession(raw.session_record) }),
  );

export type SessionCreateInput = z.infer<typeof SessionCreateInputSchema>;
export type SessionCreateResult = z.infer<typeof SessionCreateResultSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type SessionRetrieveResult = z.infer<typeof SessionRetrieveResultSchema>;
export type SessionListParams = z.infer<typeof SessionListParamsSchema>;
export type SessionListResult = z.infer<typeof SessionListResultSchema>;
export type SessionStatusUpdate = z.infer<typeof SessionStatusUpdateSchema>;
export type SessionStatusUpdateResult = z.infer<typeof SessionStatusUpdateResultSchema>;
