import { z } from 'zod';

export const DeepfakeChallengeResultSchema = z.object({
  sessionId: z.uuid(),
  challengeWord: z.string(),
});

export const DeepfakeUploadUrlsInputSchema = z.object({
  sessionId: z.string().min(1),
  includeAudio: z.boolean(),
});

export const DeepfakeUploadUrlsResultSchema = z.object({
  uploadUrls: z.record(z.string(), z.string()),
  uploadKeys: z.record(z.string(), z.string()),
  sessionId: z.string(),
});

export const DeepfakeActionSchema = z.enum([
  'hold-still',
  'blink',
  'turn-left',
  'turn-right',
  'speak-prompt',
]);

export const DeepfakeFrameMetaSchema = z.object({
  actionId: z.string(),
  action: DeepfakeActionSchema,
  timestamp: z.number(),
  yaw: z.number(),
  pitch: z.number(),
  roll: z.number(),
  leftEyeOpenness: z.number(),
  rightEyeOpenness: z.number(),
  faceDetected: z.boolean(),
});

export const DeepfakeS3KeysSchema = z.object({
  frame_0: z.string(),
  frame_1: z.string(),
  frame_2: z.string(),
  frame_3: z.string(),
  frame_4: z.string(),
  frame_5: z.string(),
  audio_clip: z.string().optional(),
  video_clip: z.string().optional(),
});

export const DeepfakeAnalyzeInputSchema = z.object({
  scanDurationMs: z.number(),
  challengeWord: z.string().optional(),
  frameMeta: z.array(DeepfakeFrameMetaSchema).length(6),
  s3Keys: DeepfakeS3KeysSchema,
});

export const DeepfakeVerdictSchema = z.enum(['LIVE', 'DEEPFAKE', 'INCONCLUSIVE']);
export const DeepfakeTrustVerdictSchema = z.enum(['PASS', 'REVIEW', 'REJECT']);

export const DeepfakeAnalyzeDetailsSchema = z.object({
  layers: z.record(z.string(), z.unknown()),
  avgLayerConfidence: z.number(),
  trustBreakdown: z.record(z.string(), z.number()),
  degradedModules: z.array(z.string()),
});

export const DeepfakeAnalyzeResultSchema = z.object({
  success: z.boolean(),
  passed: z.boolean(),
  confidence: z.number(),
  verdict: DeepfakeVerdictSchema,
  riskScore: z.number(),
  trustVerdict: DeepfakeTrustVerdictSchema,
  trustScore: z.number(),
  challengeWord: z.string().optional(),
  failureReasons: z.array(z.string()),
  verificationId: z.uuid(),
  timestamp: z.iso.datetime(),
  details: DeepfakeAnalyzeDetailsSchema,
});

export type DeepfakeChallengeResult = z.infer<typeof DeepfakeChallengeResultSchema>;
export type DeepfakeUploadUrlsInput = z.infer<typeof DeepfakeUploadUrlsInputSchema>;
export type DeepfakeUploadUrlsResult = z.infer<typeof DeepfakeUploadUrlsResultSchema>;
export type DeepfakeAction = z.infer<typeof DeepfakeActionSchema>;
export type DeepfakeFrameMeta = z.infer<typeof DeepfakeFrameMetaSchema>;
export type DeepfakeS3Keys = z.infer<typeof DeepfakeS3KeysSchema>;
export type DeepfakeAnalyzeInput = z.infer<typeof DeepfakeAnalyzeInputSchema>;
export type DeepfakeVerdict = z.infer<typeof DeepfakeVerdictSchema>;
export type DeepfakeTrustVerdict = z.infer<typeof DeepfakeTrustVerdictSchema>;
export type DeepfakeAnalyzeDetails = z.infer<typeof DeepfakeAnalyzeDetailsSchema>;
export type DeepfakeAnalyzeResult = z.infer<typeof DeepfakeAnalyzeResultSchema>;
