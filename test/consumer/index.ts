/**
 * Consumer declaration-file validation.
 *
 * This file imports every public export from @deepidv/server's BUILT output
 * and uses each type to confirm .d.ts files are complete and correct.
 *
 * Run: cd test/consumer && tsc --noEmit
 * Prerequisite: pnpm build (produces dist/)
 */

// --- Class + Schema ---
import {
  DeepIDV,
  DeepIDVConfigSchema,
} from '@deepidv/server';

// --- Error classes ---
import {
  DeepIDVError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  NetworkError,
  TimeoutError,
} from '@deepidv/server';

// --- Types ---
import type {
  DeepIDVOptions,
  DeepIDVConfig,
  RawResponse,
  SDKEventMap,
} from '@deepidv/server';

// --- Session types + schemas ---
import type {
  SessionCreateInput,
  SessionCreateResult,
  Session,
  SessionRetrieveResult,
  SessionListParams,
  SessionStatusUpdate,
  PaginatedResponse,
} from '@deepidv/server';
import {
  SessionCreateInputSchema,
  SessionListParamsSchema,
  SessionStatusUpdateSchema,
  SessionStatusSchema,
} from '@deepidv/server';

// --- Document types + schemas ---
import type {
  DocumentScanInput,
  DocumentScanResult,
  DocumentType,
} from '@deepidv/server';
import {
  DocumentScanInputSchema,
  DocumentScanResultSchema,
  DocumentTypeSchema,
} from '@deepidv/server';

// --- Face types + schemas ---
import type {
  FaceDetectInput,
  FaceDetectResult,
  FaceCompareInput,
  FaceCompareResult,
  FaceEstimateAgeInput,
  FaceEstimateAgeResult,
  Gender,
} from '@deepidv/server';
import {
  FaceDetectInputSchema,
  FaceDetectResultSchema,
  FaceCompareInputSchema,
  FaceCompareResultSchema,
  FaceEstimateAgeInputSchema,
  FaceEstimateAgeResultSchema,
  GenderSchema,
} from '@deepidv/server';

// --- Identity types + schemas ---
import type {
  IdentityVerifyInput,
  IdentityVerificationResult,
  IdentityDocumentResult,
  IdentityFaceDetectionResult,
  IdentityFaceMatchResult,
} from '@deepidv/server';
import {
  IdentityVerifyInputSchema,
  IdentityVerificationResultSchema,
  IdentityDocumentResultSchema,
  IdentityFaceDetectionResultSchema,
  IdentityFaceMatchResultSchema,
} from '@deepidv/server';

// --- Usage assertions (type-level only, never executed) ---

// DeepIDV instantiation
const _client = new DeepIDV({ apiKey: 'test' });

// Module namespaces exist
const _sessions = _client.sessions;
const _document = _client.document;
const _face = _client.face;
const _identity = _client.identity;

// Error class instantiation with correct signatures
const _err: DeepIDVError = new DeepIDVError('test');
const _authErr: AuthenticationError = new AuthenticationError('test', 'sk_test_key');
const _rateErr: RateLimitError = new RateLimitError('test');
const _valErr: ValidationError = new ValidationError('test');
const _netErr: NetworkError = new NetworkError('test');
const _timeErr: TimeoutError = new TimeoutError('test');

// Error is subclass of DeepIDVError
const _errCheck: DeepIDVError = _authErr;

// Config schema callable
const _configParse = DeepIDVConfigSchema;

// Event map type usable
type _EventHandler = SDKEventMap['request'];

// Session schemas callable
const _sessSchema = SessionCreateInputSchema;
const _listSchema = SessionListParamsSchema;
const _statusSchema = SessionStatusUpdateSchema;
const _sessStatusSchema = SessionStatusSchema;

// Document schemas callable
const _docInputSchema = DocumentScanInputSchema;
const _docResultSchema = DocumentScanResultSchema;
const _docTypeSchema = DocumentTypeSchema;

// Face schemas callable
const _faceDetSchema = FaceDetectInputSchema;
const _faceDetResSchema = FaceDetectResultSchema;
const _faceCmpSchema = FaceCompareInputSchema;
const _faceCmpResSchema = FaceCompareResultSchema;
const _faceAgeSchema = FaceEstimateAgeInputSchema;
const _faceAgeResSchema = FaceEstimateAgeResultSchema;
const _genderSchema = GenderSchema;

// Identity schemas callable
const _idvInputSchema = IdentityVerifyInputSchema;
const _idvResSchema = IdentityVerificationResultSchema;
const _idvDocSchema = IdentityDocumentResultSchema;
const _idvFaceDetSchema = IdentityFaceDetectionResultSchema;
const _idvFaceMatchSchema = IdentityFaceMatchResultSchema;

// Type usage (ensure types are not just importable but usable)
type _SessionInput = SessionCreateInput;
type _SessionResult = SessionCreateResult;
type _SessionFull = Session;
type _SessionRetrieve = SessionRetrieveResult;
type _SessionList = SessionListParams;
type _SessionStatus = SessionStatusUpdate;
type _Paginated = PaginatedResponse<Session>;
type _DocInput = DocumentScanInput;
type _DocResult = DocumentScanResult;
type _DocType = DocumentType;
type _FaceDetIn = FaceDetectInput;
type _FaceDetRes = FaceDetectResult;
type _FaceCmpIn = FaceCompareInput;
type _FaceCmpRes = FaceCompareResult;
type _FaceAgeIn = FaceEstimateAgeInput;
type _FaceAgeRes = FaceEstimateAgeResult;
type _GenderType = Gender;
type _IdvIn = IdentityVerifyInput;
type _IdvRes = IdentityVerificationResult;
type _IdvDoc = IdentityDocumentResult;
type _IdvFaceDet = IdentityFaceDetectionResult;
type _IdvFaceMatch = IdentityFaceMatchResult;
type _Options = DeepIDVOptions;
type _Config = DeepIDVConfig;
type _Raw = RawResponse;

// Suppress unused variable warnings (type-only file)
void _sessions;
void _document;
void _face;
void _identity;
void _err;
void _authErr;
void _rateErr;
void _valErr;
void _netErr;
void _timeErr;
void _errCheck;
void _configParse;
void _sessSchema;
void _listSchema;
void _statusSchema;
void _sessStatusSchema;
void _docInputSchema;
void _docResultSchema;
void _docTypeSchema;
void _faceDetSchema;
void _faceDetResSchema;
void _faceCmpSchema;
void _faceCmpResSchema;
void _faceAgeSchema;
void _faceAgeResSchema;
void _genderSchema;
void _idvInputSchema;
void _idvResSchema;
void _idvDocSchema;
void _idvFaceDetSchema;
void _idvFaceMatchSchema;
