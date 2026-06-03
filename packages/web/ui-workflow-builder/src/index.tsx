// @deepidv/ui-workflow-builder
// Visual workflow builder for DeepIDV identity verification pipelines.

// Main component
export { WorkflowBuilder } from './components/WorkflowBuilder.js';

// Sub-components (for custom layouts)
export { StepPalette } from './components/StepPalette.js';
export { StepSettingsPanel } from './components/StepSettingsPanel.js';

// Constants
export {
  DEFAULT_STEPS,
  DEFAULT_TEMPLATES,
  COUPLED_STEPS,
  STEP_ICON_GRADIENTS,
} from './data/constants.js';

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
