// @deepidv/ui-workflow-builder
// Visual workflow builder for DeepIDV identity verification pipelines.

// Main component
export { WorkflowBuilder } from './components/WorkflowBuilder.js';

// Sub-components (for custom layouts)
export { StepPalette } from './components/StepPalette.js';
export { StepSettingsPanel } from './components/StepSettingsPanel.js';

// Constants (small lookup maps — bundled inline)
export { COUPLED_STEPS, STEP_ICON_GRADIENTS } from './data/constants.js';

// Default data (large — separate chunk, lazy-loaded internally)
export { DEFAULT_STEPS, DEFAULT_TEMPLATES } from './data/defaults.js';

// Utilities
export {
  getStepGradient,
  getStepIcon,
  getStepDescription,
  serializeWorkflowForSave,
  buildWorkflowFromTemplate,
} from './utils/helpers.js';

// Types
export type {
  StepDefinition,
  StepPricing,
  StepProperty,
  StepPropertyGroup,
  StepPropertyOption,
  StepPropertyRequirement,
  SliderMark,
  TextListItem,
  WorkflowStep,
  WorkflowTemplate,
  WorkflowValue,
  WorkflowBuilderProps,
  WorkflowBuilderLabels,
  WorkflowBuilderTheme,
  RenderToolbarArgs,
} from './types.js';
