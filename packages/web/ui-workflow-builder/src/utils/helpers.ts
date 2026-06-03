import type { StepDefinition, WorkflowStep, WorkflowTemplate, WorkflowValue } from '../types.js';
import { COUPLED_STEPS, STEP_ICON_GRADIENTS } from '../data/constants.js';

// ----------------------------------------------------------------------
// Step lookup helpers
// ----------------------------------------------------------------------

const DEFAULT_GRADIENT = 'linear-gradient(135deg, #8E8E93, #AEAEB2)';
const DEFAULT_ICON = 'solar:widget-bold-duotone';

export function getStepGradient(stepId: string): string {
  return STEP_ICON_GRADIENTS[stepId] ?? DEFAULT_GRADIENT;
}

export function getStepIcon(stepId: string, steps: StepDefinition[]): string {
  const stepDef = steps.find((s) => s.id === stepId);
  return stepDef?.icon ?? DEFAULT_ICON;
}

export function getStepDescription(stepId: string, steps: StepDefinition[]): string {
  const stepDef = steps.find((s) => s.id === stepId);
  return stepDef?.description ?? '';
}

// ----------------------------------------------------------------------
// Coupled step removal
// ----------------------------------------------------------------------

export function getKeysToRemove(stepKey: string, steps: WorkflowStep[]): Set<string> {
  const keys = new Set<string>();
  const worklist: WorkflowStep[] = [];
  const seed = steps.find((s) => (s.instanceId || s.id) === stepKey);
  if (!seed) return new Set([stepKey]);
  keys.add(stepKey);
  worklist.push(seed);

  while (worklist.length > 0) {
    const cur = worklist.pop();
    if (!cur) continue;
    const enqueue = (next: WorkflowStep): void => {
      const nextKey = next.instanceId || next.id;
      if (keys.has(nextKey)) return;
      keys.add(nextKey);
      worklist.push(next);
    };

    for (const partnerId of COUPLED_STEPS[cur.id] ?? []) {
      const isMutual = (COUPLED_STEPS[partnerId] ?? []).includes(cur.id);
      if (!isMutual) continue;
      const partner = steps.find((s) => s.id === partnerId);
      if (partner) enqueue(partner);
    }

    for (const [dependentId, requiredIds] of Object.entries(COUPLED_STEPS)) {
      if (!requiredIds.includes(cur.id)) continue;
      const dependent = steps.find((s) => s.id === dependentId);
      if (dependent) enqueue(dependent);
    }
  }

  return keys;
}

// ----------------------------------------------------------------------
// Workflow serialization (for API output)
// ----------------------------------------------------------------------

interface SerializedStep {
  id: string;
  instanceId: string;
  config: Record<string, Record<string, unknown>>;
}

export function serializeWorkflowForSave(steps: WorkflowStep[]): SerializedStep[] {
  if (!Array.isArray(steps)) return [];
  return steps.map((step) => {
    const serialized: SerializedStep = { id: step.id, instanceId: step.instanceId, config: {} };
    if (step.propertyGroups && Array.isArray(step.propertyGroups)) {
      for (const group of step.propertyGroups) {
        const groupConfig: Record<string, unknown> = {};
        for (const prop of group.properties) {
          let value: unknown = prop.value;
          if (prop.type === 'range' && Array.isArray(value) && (value as unknown[]).length === 2) {
            const [lower, upper] = value as [number, number];
            value = { lower, upper };
          }
          groupConfig[prop.id] = value;
        }
        serialized.config[group.groupId] = groupConfig;
      }
    }
    return serialized;
  });
}

// ----------------------------------------------------------------------
// Template builder
// ----------------------------------------------------------------------

export function buildWorkflowFromTemplate(
  templateId: string,
  templates: WorkflowTemplate[],
  availableSteps: StepDefinition[],
): WorkflowValue {
  const template = templates.find((t) => t.id === templateId);
  if (!template) return { name: '', steps: [] };

  const steps: WorkflowStep[] = template.steps
    .map((stepId) => availableSteps.find((s) => s.id === stepId))
    .filter((s): s is StepDefinition => s !== undefined)
    .map((step) => ({
      ...structuredClone(step),
      instanceId: `${step.id}-${String(Date.now())}`,
    }));

  return { name: template.label, steps };
}
