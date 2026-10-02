/** OpenAPI-aligned schemas and public types for workflow definitions. */

import { z } from 'zod';

export const WORKFLOW_STEP_IDS = [
  'ID_VERIFICATION',
  'FACE_LIVENESS',
  'FACE_LIVENESS_CONSENT_SETTINGS',
  'AGE_ESTIMATION',
  'DEEPFAKE_DETECTION',
  'DEEP_AGE',
  'ADDRESS_VERIFICATION',
  'BACKGROUND_CHECK',
  'TITLE_SEARCH',
  'PEP_SANCTIONS',
  'ADVERSE_MEDIA',
  'CUSTOM_PROMPT',
  'CONSENT',
  'BANK_STATEMENT_UPLOAD',
  'AI_BANK_STATEMENT_ANALYSIS',
  'DOCUMENT_UPLOAD',
  'WHITE_LABEL',
  'PHONE_TRUST_CHECK',
  'CARRIER_AGE_GATE',
  'PHONE_OWNERSHIP_MATCH',
  'PHONE_VERIFICATION',
] as const;

export const WorkflowStepIdSchema = z.enum(WORKFLOW_STEP_IDS);
export const WorkflowStepConfigSchema = z.record(z.string(), z.unknown());

export const WorkflowCreateStepSchema = z.object({
  id: WorkflowStepIdSchema,
  /** OpenAPI step config keys are passed through in their documented snake_case form. */
  config: WorkflowStepConfigSchema.optional(),
});

export const WorkflowCreateInputSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    steps: z.array(WorkflowCreateStepSchema).min(1).max(10),
  })
  .superRefine(({ steps }, ctx) => {
    const ids = steps.map((step) => step.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['steps'],
        message: 'Duplicate step IDs are not allowed',
      });
    }

    const requireEarlier = (stepId: WorkflowStepId, prerequisiteId: WorkflowStepId) => {
      const stepIndex = ids.indexOf(stepId);
      if (stepIndex < 0) return;
      const prerequisiteIndex = ids.indexOf(prerequisiteId);
      if (prerequisiteIndex < 0 || prerequisiteIndex >= stepIndex) {
        ctx.addIssue({
          code: 'custom',
          path: ['steps', stepIndex, 'id'],
          message: `${stepId} requires an earlier ${prerequisiteId} step`,
        });
      }
    };

    requireEarlier('BACKGROUND_CHECK', 'ID_VERIFICATION');
    requireEarlier('AI_BANK_STATEMENT_ANALYSIS', 'BANK_STATEMENT_UPLOAD');
  });

export const WorkflowStepSchema = z.object({
  id: z.string(),
  config: WorkflowStepConfigSchema,
});

export const WorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  organizationId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  steps: z.array(WorkflowStepSchema),
});

export const WorkflowSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  steps: z.array(z.string()),
  createdAt: z.string(),
});

export const WorkflowListResultSchema = z.object({ workflows: z.array(WorkflowSummarySchema) });
export const WorkflowResultSchema = z.object({ workflow: WorkflowSchema });

const WorkflowWireSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  organization_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  steps: z.array(
    z.object({
      id: z.string(),
      config: WorkflowStepConfigSchema,
    }),
  ),
});

function normalizeWorkflow(raw: z.infer<typeof WorkflowWireSchema>): Workflow {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status,
    organizationId: raw.organization_id,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    steps: raw.steps,
  };
}

export const WorkflowListWireResultSchema = z
  .object({
    workflows: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        status: z.string(),
        steps: z.array(z.string()),
        created_at: z.string(),
      }),
    ),
  })
  .transform(({ workflows }) => ({
    workflows: workflows.map((workflow) => ({
      id: workflow.id,
      name: workflow.name,
      status: workflow.status,
      steps: workflow.steps,
      createdAt: workflow.created_at,
    })),
  }));

export const WorkflowWireResultSchema = z
  .object({ workflow: WorkflowWireSchema })
  .transform(({ workflow }) => ({ workflow: normalizeWorkflow(workflow) }));

export type WorkflowStepId = z.infer<typeof WorkflowStepIdSchema>;
export type WorkflowStepConfig = z.infer<typeof WorkflowStepConfigSchema>;
export type WorkflowCreateStep = z.infer<typeof WorkflowCreateStepSchema>;
export type WorkflowCreateInput = z.infer<typeof WorkflowCreateInputSchema>;
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;
export type WorkflowSummary = z.infer<typeof WorkflowSummarySchema>;
export type WorkflowListResult = z.infer<typeof WorkflowListResultSchema>;
export type WorkflowResult = z.infer<typeof WorkflowResultSchema>;
