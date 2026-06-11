/**
 * Zod schemas and inferred TypeScript types for the screening module.
 *
 * All TypeScript types are derived exclusively from Zod schemas via
 * `z.infer<typeof Schema>` (D-04). No separate `interface` declarations.
 *
 * @module screening.types
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enum schemas
// ---------------------------------------------------------------------------

/**
 * Supported screening services. Used as the `service` filter on
 * `screening.list()` and as the `type` field on screening session records.
 */
export const ScreeningServiceSchema = z.enum(['PEP_SANCTIONS', 'ADVERSE_MEDIA', 'TITLE_CHECK']);

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

/**
 * Input schema for `screening.pepSanctions()`.
 *
 * Names are split (`firstName` / `lastName`) — the server keys off split
 * names and does not accept a single `name` field. `dateOfBirth` is
 * required and must be an ISO 8601 date (`YYYY-MM-DD`).
 *
 * `country` is intentionally absent: the server-side PEP/S schema does
 * not accept it today. It will be added when the server schema bumps.
 */
export const PepSanctionsInputSchema = z.object({
  /** Email address (required, must be valid email format). */
  email: z.email(),
  /** First name (required, 1–255 chars). */
  firstName: z.string().min(1).max(255),
  /** Last name (required, 1–255 chars). */
  lastName: z.string().min(1).max(255),
  /** Date of birth in ISO 8601 format (`YYYY-MM-DD`). */
  dateOfBirth: z.iso.date(),
});

/**
 * Input schema for `screening.adverseMedia()`.
 *
 * Returns a queued job — the result is delivered async via the polling
 * handle. `country` is an optional ISO 3166-1 alpha-2 code (case-insensitive,
 * normalized to uppercase). `idempotencyKey` is a SDK-only field that
 * becomes the `Idempotency-Key` header — when omitted, the SDK auto-generates
 * a UUID v4 so customer retries are safe by default. The server-side dedup
 * TTL is 24 hours.
 */
export const AdverseMediaInputSchema = z.object({
  /** Email address (required, must be valid email format). */
  email: z.email(),
  /** First name (required, 1–255 chars). */
  firstName: z.string().min(1).max(255),
  /** Last name (required, 1–255 chars). */
  lastName: z.string().min(1).max(255),
  /** Date of birth in ISO 8601 format (`YYYY-MM-DD`). */
  dateOfBirth: z.iso.date(),
  /**
   * ISO 3166-1 alpha-2 country code (e.g. `'CA'`, `'US'`).
   * Case-insensitive; normalized to uppercase.
   */
  country: z
    .string()
    .regex(/^[A-Z]{2}$/i)
    .transform((s) => s.toUpperCase())
    .optional(),
  /**
   * Optional stable idempotency key. Sent as the `Idempotency-Key` header.
   * Omit to let the SDK generate a UUID v4 per call.
   */
  idempotencyKey: z.string().min(1).max(255).optional(),
});

/**
 * Input schema for `screening.titleCheck()`.
 *
 * Address is geocoded server-side via Google Places — the SDK passes the
 * raw address string through unchanged.
 */
export const TitleCheckInputSchema = z.object({
  /** Email address (required, must be valid email format). */
  email: z.email(),
  /** First name (required, 1–255 chars). */
  firstName: z.string().min(1).max(255),
  /** Last name (required, 1–255 chars). */
  lastName: z.string().min(1).max(255),
  /** Free-text postal address (required, 1–500 chars). */
  address: z.string().min(1).max(500),
});

/**
 * Query parameters for `screening.list()`.
 *
 * The endpoint backing this method (`GET /v1/screening/sessions`) is not
 * yet implemented on the server. The schema is provided so the public
 * type surface is stable; the method itself throws until the endpoint lands.
 */
export const ScreeningListInputSchema = z.object({
  /** Maximum number of records to return. */
  limit: z.number().int().positive().optional(),
  /** Number of records to skip for pagination. */
  offset: z.number().int().nonnegative().optional(),
  /** Filter by screening service. */
  service: ScreeningServiceSchema.optional(),
});

// ---------------------------------------------------------------------------
// Sub-schemas for PEP/S response
// ---------------------------------------------------------------------------

/**
 * A single PEP or sanctions match returned by `screening.pepSanctions()`.
 *
 * `confidence` is normalized to the 0–1 range. `datasets` lists the source
 * datasets (e.g. OpenSanctions collections) that produced the match.
 * `country` and `dateOfBirth` are nullable — the underlying records do not
 * always carry them.
 */
const PepSanctionsMatchSchema = z.object({
  name: z.string(),
  country: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  datasets: z.array(z.string()),
});

// ---------------------------------------------------------------------------
// Sub-schemas for Adverse Media result
// ---------------------------------------------------------------------------

const ExposureCategorySchema = z.enum([
  'financial_crime',
  'terrorism',
  'regulatory',
  'political',
  'organized_crime',
  'violent_crime',
  'criminal_legal',
  'reputational',
  'court_records',
]);

const AdverseMediaArticleSchema = z.object({
  timestamp: z.string().nullable(),
  headline: z.string(),
  sourceLink: z.string().nullable(),
  source: z.enum(['news', 'court-records', 'watchlist-database']),
});

const AdverseMediaFindingSchema = z.object({
  findingId: z.string(),
  severity: z.enum(['MEDIUM', 'HIGH', 'CRITICAL']),
  category: z.string(),
  title: z.string(),
  detail: z.string(),
  sourceUrl: z.string().nullable(),
  sourceName: z.string().nullable(),
  articleDate: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  confirmedBy: z.array(z.string()),
});

const ExposureBucketSchema = z.object({
  hits: z.number().int(),
  articles: z.array(AdverseMediaArticleSchema),
});

// ---------------------------------------------------------------------------
// Sub-schemas for Title Check result (discriminated union members)
// ---------------------------------------------------------------------------

const SubjectPropertySchema = z.object({
  APNFormatted: z.string().nullable(),
  APNUnformatted: z.string().nullable(),
  PropertyFullStreetAddress: z.string().nullable(),
  PropertyCity: z.string().nullable(),
  PropertyState: z.string().nullable(),
  PropertyZipCode: z.string().nullable(),
  PropertyCounty: z.string().nullable(),
  LegalDescription: z.string().nullable(),
  PropertyType: z.string().nullable(),
  LandUseCode: z.string().nullable(),
  LandUseDescription: z.string().nullable(),
  Zoning: z.string().nullable(),
  LotSizeAcres: z.number().nullable(),
  LotSizeSqFt: z.number().nullable(),
  YearBuilt: z.number().int().nullable(),
  Bedrooms: z.number().int().nullable(),
  Bathrooms: z.number().nullable(),
  BuildingAreaSqFt: z.number().nullable(),
  Stories: z.number().nullable(),
});

const OwnerInformationSchema = z.object({
  Owner1LastName: z.string().nullable(),
  Owner1FirstNameMiddleInitial: z.string().nullable(),
  Owner2LastName: z.string().nullable(),
  Owner2FirstNameMiddleInitial: z.string().nullable(),
  MailingFullStreetAddress: z.string().nullable(),
  MailingCity: z.string().nullable(),
  MailingState: z.string().nullable(),
  MailingZipCode: z.string().nullable(),
  VestingOwnershipRights: z.string().nullable(),
  OwnerOccupied: z.string().nullable(),
});

const LocationInformationSchema = z.object({
  County: z.string().nullable(),
  CensusTract: z.string().nullable(),
  CensusBlock: z.string().nullable(),
  Municipality: z.string().nullable(),
  SchoolDistrict: z.string().nullable(),
  FloodZone: z.string().nullable(),
  FloodPanelNumber: z.string().nullable(),
  Neighborhood: z.string().nullable(),
});

const OwnerTransferInformationSchema = z.object({
  TransferDocumentNumber: z.string().nullable(),
  TransferRecordingDate: z.string().nullable(),
  TransferSaleDate: z.string().nullable(),
  TransferDeedType: z.string().nullable(),
  TransferSalePrice: z.number().nullable(),
});

const LastMarketSaleInformationSchema = z.object({
  SaleDate: z.string().nullable(),
  SalePrice: z.number().nullable(),
  SaleDocumentNumber: z.string().nullable(),
  SaleDeedType: z.string().nullable(),
  RecordingDate: z.string().nullable(),
  Buyer: z.string().nullable(),
  Seller: z.string().nullable(),
  PricePerSqFt: z.number().nullable(),
});

const TitleCheckFoundSchema = z.object({
  status: z.literal('found'),
  subjectProperty: SubjectPropertySchema.nullable(),
  ownerInformation: OwnerInformationSchema.nullable(),
  locationInformation: LocationInformationSchema.nullable(),
  ownerTransferInformation: OwnerTransferInformationSchema.nullable(),
  lastMarketSaleInformation: LastMarketSaleInformationSchema.nullable(),
});

const TitleCheckMultipleSchema = z.object({
  status: z.literal('multiple_properties'),
  message: z.string(),
  availableUnits: z.array(z.string()),
  properties: z.array(z.object({ owner: z.string(), apartmentOrUnit: z.string() })),
});

const TitleCheckUnsupportedSchema = z.object({
  status: z.literal('unsupported_region'),
  message: z.string(),
});

const TitleCheckNotFoundSchema = z.object({
  status: z.literal('not_found'),
  message: z.string(),
});

// ---------------------------------------------------------------------------
// Output schemas (use .strip() per D-06 for forward compatibility)
// ---------------------------------------------------------------------------

/**
 * Response schema for `screening.pepSanctions()` — sync.
 *
 * Normalized public contract: `peps`, `sanctions`, and `both` each hold the
 * matches in their respective category (`both` = matched as PEP *and*
 * sanctioned). `totalMatches` is the aggregate count and `searchedSources`
 * lists the datasets/sources that were queried.
 */
export const PepSanctionsResultSchema = z
  .object({
    totalMatches: z.number().int(),
    peps: z.array(PepSanctionsMatchSchema),
    sanctions: z.array(PepSanctionsMatchSchema),
    both: z.array(PepSanctionsMatchSchema),
    searchedSources: z.array(z.string()),
  })
  .strip();

/**
 * Response schema for the queued `screening.adverseMedia()` POST.
 *
 * The server returns this synchronously (HTTP 202 for a new job, HTTP 200 for
 * an idempotent replay) along with the `jobId` the SDK will poll. The actual
 * result is delivered when the async job completes — parse it with
 * `AdverseMediaResultSchema`.
 *
 * `status` is the lowercase job status. It is usually `'pending'` for a fresh
 * enqueue, but a replayed (idempotent) job may already be further along, so the
 * full lowercase enum is accepted. Only `jobId` is consumed downstream.
 */
export const AdverseMediaQueuedResponseSchema = z
  .object({
    /** Server-side job ID. Log/store for later polling. */
    jobId: z.string(),
    /** Current job status — may be past `pending` on an idempotent replay. */
    status: z.enum(['pending', 'processing', 'ready', 'failed']),
    /** Human-readable queue confirmation message. */
    message: z.string(),
  })
  .strip();

/**
 * Eventual result of an adverse-media job (the `result` payload delivered
 * when the job reaches the `ready` terminal state).
 */
export const AdverseMediaResultSchema = z
  .object({
    totalHits: z.number().int(),
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    riskScore: z.number().int().min(0).max(100),
    summary: z.string(),
    findings: z.array(AdverseMediaFindingSchema),
    exposuresByCategory: z.record(ExposureCategorySchema, ExposureBucketSchema),
  })
  .strip();

/**
 * Response schema for `screening.titleCheck()` — sync.
 *
 * Discriminated union on `status`:
 * - `'found'` — full property record
 * - `'multiple_properties'` — disambiguation list (e.g. apartment buildings)
 * - `'unsupported_region'` — region not yet supported by the title search backend
 * - `'not_found'` — no record matched
 *
 * Note: the server returns HTTP 200 for all four variants — `unsupported_region`
 * is a typed result, not an error.
 */
export const TitleCheckResultSchema = z.discriminatedUnion('status', [
  TitleCheckFoundSchema,
  TitleCheckMultipleSchema,
  TitleCheckUnsupportedSchema,
  TitleCheckNotFoundSchema,
]);

/**
 * Adverse-media-specific narrowing of the generic async-job snapshot.
 *
 * `AsyncJobs.get(jobId)` returns a generic snapshot with `result: unknown`.
 * When the caller knows the job is an adverse-media job (e.g. inside the
 * `AdverseMediaHandle`), re-parse via this schema to narrow the result to
 * a typed `AdverseMediaResult` and the error to a typed string.
 */
export const AdverseMediaJobSnapshotSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('pending') }),
  z.object({ status: z.literal('processing') }),
  z.object({ status: z.literal('ready'), result: AdverseMediaResultSchema }),
  z.object({ status: z.literal('failed'), error: z.string() }),
]);

/**
 * Screening session record returned by `screening.list()`.
 *
 * Speculative shape — the backing endpoint (`GET /v1/screening/sessions`)
 * is not yet implemented. The schema will be tightened when the server lands.
 */
export const ScreeningSessionSchema = z
  .object({
    id: z.string(),
    service: ScreeningServiceSchema,
    status: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strip();

/**
 * Paginated response wrapper for `screening.list()`.
 */
export const ScreeningListResultSchema = z.object({
  data: z.array(ScreeningSessionSchema),
  total: z.number().optional(),
  hasMore: z.boolean().optional(),
  limit: z.number(),
  offset: z.number(),
});

// ---------------------------------------------------------------------------
// Exported inferred types (z.infer only — no separate interface declarations)
// ---------------------------------------------------------------------------

/** Valid screening service identifiers. */
export type ScreeningService = z.infer<typeof ScreeningServiceSchema>;

/** Input for `screening.pepSanctions()`. */
export type PepSanctionsInput = z.infer<typeof PepSanctionsInputSchema>;

/** Response from `screening.pepSanctions()`. */
export type PepSanctionsResult = z.infer<typeof PepSanctionsResultSchema>;

/** Input for `screening.adverseMedia()` (post-parse, with normalized country). */
export type AdverseMediaInput = z.infer<typeof AdverseMediaInputSchema>;

/** Initial queued response from POST `/v1/screening/adverse-media`. */
export type AdverseMediaQueuedResponse = z.infer<typeof AdverseMediaQueuedResponseSchema>;

/** Eventual result of a completed adverse-media job. */
export type AdverseMediaResult = z.infer<typeof AdverseMediaResultSchema>;

/** Narrowed snapshot returned by `AdverseMediaHandle.refresh()`. */
export type AdverseMediaJobSnapshot = z.infer<typeof AdverseMediaJobSnapshotSchema>;

/** Input for `screening.titleCheck()`. */
export type TitleCheckInput = z.infer<typeof TitleCheckInputSchema>;

/** Response from `screening.titleCheck()` — discriminated on `status`. */
export type TitleCheckResult = z.infer<typeof TitleCheckResultSchema>;

/** Query parameters for `screening.list()`. */
export type ScreeningListInput = z.infer<typeof ScreeningListInputSchema>;

/** Single record in the `screening.list()` paginated response. */
export type ScreeningSession = z.infer<typeof ScreeningSessionSchema>;

/** Response from `screening.list()`. */
export type ScreeningListResult = z.infer<typeof ScreeningListResultSchema>;
