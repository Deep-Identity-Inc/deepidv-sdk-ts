# @deepidv/ui-workflow-builder

Visual workflow builder for DeepIDV identity verification pipelines.

## Install

```bash
npm install @deepidv/ui-workflow-builder
```

## Usage

```tsx
import { WorkflowBuilder } from '@deepidv/ui-workflow-builder';
import '@deepidv/ui-workflow-builder/styles.css';

function App() {
  return (
    <WorkflowBuilder
      onSave={(workflow) => console.log(workflow)}
      onChange={(workflow) => console.log('changed', workflow)}
    />
  );
}
```

### Tailwind host

The component ships its own `deepidv--` prefixed CSS. No Tailwind configuration is needed.
The stylesheet is fully scoped and will not bleed into or be affected by your host styles.

```tsx
// Works alongside Tailwind with no conflicts
import { WorkflowBuilder } from '@deepidv/ui-workflow-builder';
import '@deepidv/ui-workflow-builder/styles.css';

function Page() {
  return (
    <div className="h-screen bg-gray-50">
      <WorkflowBuilder height="100%" />
    </div>
  );
}
```

### Controlled mode

```tsx
const [workflow, setWorkflow] = useState({ name: '', steps: [] });

<WorkflowBuilder value={workflow} onChange={setWorkflow} onSave={(wf) => api.saveWorkflow(wf)} />;
```

### Theming

Override CSS custom properties on the `.deepidv--workflow-builder` root:

```css
.deepidv--workflow-builder {
  --deepidv-color-primary: #6366f1;
  --deepidv-color-primary-light: #818cf8;
  --deepidv-font-family: 'Inter', sans-serif;
}
```

## Props

| Prop                   | Type                                               | Default            | Description                   |
| ---------------------- | -------------------------------------------------- | ------------------ | ----------------------------- |
| `value`                | `WorkflowValue`                                    | —                  | Controlled workflow state     |
| `defaultValue`         | `WorkflowValue`                                    | —                  | Initial uncontrolled state    |
| `onChange`             | `(workflow) => void`                               | —                  | Called on every change        |
| `onSave`               | `(workflow) => void`                               | —                  | Called when save is triggered |
| `onBack`               | `() => void`                                       | —                  | Back button callback          |
| `steps`                | `StepDefinition[]`                                 | Built-in steps     | Available steps in palette    |
| `templates`            | `WorkflowTemplate[]`                               | Built-in templates | Available templates           |
| `disabledStepIds`      | `string[]`                                         | `[]`               | Steps disabled in palette     |
| `disabled`             | `boolean`                                          | `false`            | Disable all interactions      |
| `showPalette`          | `boolean`                                          | `true`             | Show left step palette        |
| `showSettings`         | `boolean`                                          | `true`             | Show right settings panel     |
| `showHeader`           | `boolean`                                          | `true`             | Show built-in header          |
| `height`               | `string`                                           | `'100%'`           | Container height              |
| `labels`               | `WorkflowBuilderLabels`                            | `{}`               | i18n label overrides          |
| `renderCustomProperty` | `(property, group, step, onChange) => ReactNode`   | —                  | Custom property renderer      |
| `renderToolbar`        | `({ workflow, setWorkflow, onSave }) => ReactNode` | —                  | Custom toolbar renderer       |

## Exports

```ts
// Components
export { WorkflowBuilder, StepPalette, StepSettingsPanel };

// Constants
export { DEFAULT_STEPS, DEFAULT_TEMPLATES, COUPLED_STEPS, STEP_ICON_GRADIENTS };

// Utilities
export { getStepGradient, getStepIcon, getStepDescription, serializeWorkflowForSave, buildWorkflowFromTemplate };

// Types
export type { WorkflowBuilderProps, WorkflowValue, WorkflowStep, StepDefinition, StepProperty, ... };
```
