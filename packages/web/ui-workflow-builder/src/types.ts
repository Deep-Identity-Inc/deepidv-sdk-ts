import type { ReactNode } from 'react';

// ----------------------------------------------------------------------
// Step property types
// ----------------------------------------------------------------------

export interface StepPropertyOption {
  value: string;
  label: string;
}

export interface SliderMark {
  value: number;
  label: string;
}

export interface TextListItem {
  text: string;
}

export interface StepPropertyRequirement {
  id: string;
  notEquals: string | number | boolean;
}

export interface StepProperty {
  id: string;
  label: string;
  type:
    | 'boolean'
    | 'slider'
    | 'range'
    | 'select'
    | 'text'
    | 'text-list'
    | 'doc-upload'
    | 'hidden'
    | 'form-fields';
  value: unknown;
  sublabel?: string;
  requirement?: string | StepPropertyRequirement;
  options?: StepPropertyOption[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  marks?: SliderMark[];
  required?: boolean;
  maxLength?: number;
  lowerLabel?: string;
  middleLabel?: string;
  upperLabel?: string;
  lowerColor?: string;
  middleColor?: string;
  upperColor?: string;
}

// ----------------------------------------------------------------------
// Step property groups
// ----------------------------------------------------------------------

export interface StepPropertyGroup {
  groupId: string;
  groupName: string;
  groupTooltip?: string;
  parentToggle?: string;
  properties: StepProperty[];
}

// ----------------------------------------------------------------------
// Step pricing (injected per step)
// ----------------------------------------------------------------------

export interface StepPricing {
  /** Display label, e.g. "$0.50" or "Free" */
  label: string;
  /** Optional tooltip shown on hover */
  tooltip?: string;
}

// ----------------------------------------------------------------------
// Step definition (available steps palette)
// ----------------------------------------------------------------------

export interface StepDefinition {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  category?: string;
  coupled?: boolean;
  propertyGroups?: StepPropertyGroup[];
}

// ----------------------------------------------------------------------
// Workflow step instance (in the workflow)
// ----------------------------------------------------------------------

export interface WorkflowStep {
  id: string;
  label: string;
  icon?: string;
  instanceId: string;
  propertyGroups?: StepPropertyGroup[];
}

// ----------------------------------------------------------------------
// Workflow template
// ----------------------------------------------------------------------

export interface WorkflowTemplate {
  id: string;
  label: string;
  description?: string;
  steps: string[];
}

// ----------------------------------------------------------------------
// Workflow value (the full workflow state)
// ----------------------------------------------------------------------

export interface WorkflowValue {
  name: string;
  steps: WorkflowStep[];
}

// ----------------------------------------------------------------------
// WorkflowBuilder props
// ----------------------------------------------------------------------

export interface WorkflowBuilderLabels {
  back?: string;
  save?: string;
  workflowName?: string;
  workflowNamePlaceholder?: string;
  template?: string;
  templatePlaceholder?: string;
  startFromScratch?: string;
  paletteTitle?: string;
  searchPlaceholder?: string;
  emptyTitle?: string;
  noSelection?: string;
  noSelectionHint?: string;
  configureSettings?: string;
  noSettings?: string;
  categoryAll?: string;
  categoryVerify?: string;
  categoryDocs?: string;
  categoryScreen?: string;
}

export interface RenderToolbarArgs {
  workflow: WorkflowValue;
  setWorkflow: (updater: WorkflowValue | ((prev: WorkflowValue) => WorkflowValue)) => void;
  onSave?: (workflow: WorkflowValue) => void;
}

// ----------------------------------------------------------------------
// Theme (CSS custom property overrides via JS)
// ----------------------------------------------------------------------

export interface WorkflowBuilderTheme {
  /** Primary brand color (buttons, active states). Default: #0781df */
  colorPrimary?: string;
  /** Lighter primary variant (hover borders). Default: #36a3f7 */
  colorPrimaryLight?: string;

  /** Main background color. Default: #ffffff */
  colorBg?: string;
  /** Subtle background (unused areas). Default: #f8fafc */
  colorBgSubtle?: string;
  /** Canvas/drop-zone background. Default: #f1f5f9 */
  colorBgCanvas?: string;

  /** Primary text color. Default: #1e293b */
  colorText?: string;
  /** Secondary text color (descriptions, hints). Default: #64748b */
  colorTextSecondary?: string;
  /** Disabled text color. Default: #94a3b8 */
  colorTextDisabled?: string;

  /** Border and divider color. Default: #e2e8f0 */
  colorBorder?: string;

  /** Success indicator. Default: #22c55e */
  colorSuccess?: string;
  /** Error/destructive indicator. Default: #ef4444 */
  colorError?: string;
  /** Warning indicator. Default: #f59e0b */
  colorWarning?: string;

  /** Font family stack. Default: system UI */
  fontFamily?: string;

  /** Border radius for cards/inputs. Default: 8px */
  radiusMd?: string;
  /** Border radius for small elements. Default: 4px */
  radiusSm?: string;
}

// ----------------------------------------------------------------------
// WorkflowBuilder props
// ----------------------------------------------------------------------

export interface WorkflowBuilderProps {
  defaultValue?: WorkflowValue;
  value?: WorkflowValue;
  onChange?: (workflow: WorkflowValue) => void;
  onSave?: (workflow: WorkflowValue) => void;
  onBack?: () => void;

  steps?: StepDefinition[];
  templates?: WorkflowTemplate[];
  disabledStepIds?: string[];
  /** Step IDs to completely hide from the palette — the end user never sees them. */
  hiddenStepIds?: string[];
  /** Per-step pricing labels, keyed by step ID. Shown on palette cards and canvas step cards. */
  stepPricing?: Record<string, StepPricing>;

  disabled?: boolean;
  showPalette?: boolean;
  showSettings?: boolean;
  showHeader?: boolean;
  height?: string;

  labels?: WorkflowBuilderLabels;
  theme?: WorkflowBuilderTheme;

  renderCustomProperty?: (
    property: StepProperty,
    group: StepPropertyGroup,
    step: WorkflowStep,
    onChange: (value: unknown) => void,
  ) => ReactNode | undefined;
  renderToolbar?: (args: RenderToolbarArgs) => ReactNode;

  children?: ReactNode;
}
