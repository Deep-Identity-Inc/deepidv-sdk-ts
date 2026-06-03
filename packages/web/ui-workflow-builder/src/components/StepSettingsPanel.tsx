import React, { useMemo } from 'react';
import { Icon } from '@iconify/react';
import type {
  StepProperty,
  StepPropertyGroup,
  WorkflowBuilderLabels,
  WorkflowStep,
  WorkflowValue,
} from '../types.js';
import { getStepGradient, getStepIcon } from '../utils/helpers.js';
import type { StepDefinition } from '../types.js';
import { PropertyRenderer } from './PropertyRenderer.js';

// ----------------------------------------------------------------------

interface StepSettingsPanelProps {
  workflow: WorkflowValue;
  setWorkflow: (updater: WorkflowValue | ((prev: WorkflowValue) => WorkflowValue)) => void;
  selectedStepId: string | null;
  availableSteps: StepDefinition[];
  labels: WorkflowBuilderLabels;
  renderCustomProperty?: (
    property: StepProperty,
    group: StepPropertyGroup,
    step: WorkflowStep,
    onChange: (value: unknown) => void,
  ) => React.ReactNode | undefined;
}

// ----------------------------------------------------------------------

export function StepSettingsPanel({
  workflow,
  setWorkflow,
  selectedStepId,
  availableSteps,
  labels,
  renderCustomProperty,
}: StepSettingsPanelProps): React.ReactElement {
  const selectedStep = useMemo(() => {
    if (!selectedStepId) return null;
    return workflow.steps.find((s) => (s.instanceId || s.id) === selectedStepId) ?? null;
  }, [selectedStepId, workflow.steps]);

  if (!selectedStep) {
    return (
      <div className="deepidv--settings deepidv--settings-empty">
        <Icon
          icon="solar:settings-bold-duotone"
          width={48}
          className="deepidv--settings-empty-icon"
        />
        <p className="deepidv--settings-empty-title">
          {labels.noSelection ?? 'Configure Settings'}
        </p>
        <p className="deepidv--settings-empty-hint">
          {labels.noSelectionHint ??
            'Select a step from the workflow\nto view and edit its settings'}
        </p>
      </div>
    );
  }

  const icon = selectedStep.icon ?? getStepIcon(selectedStep.id, availableSteps);

  const updatePropertyValue = (groupId: string, propId: string, newValue: unknown): void => {
    setWorkflow((prev: WorkflowValue) => ({
      ...prev,
      steps: prev.steps.map((step) =>
        (step.instanceId || step.id) === selectedStepId
          ? {
              ...step,
              propertyGroups: (step.propertyGroups ?? []).map((group) =>
                group.groupId === groupId
                  ? {
                      ...group,
                      properties: group.properties.map((prop) =>
                        prop.id === propId ? { ...prop, value: newValue } : prop,
                      ),
                    }
                  : group,
              ),
            }
          : step,
      ),
    }));
  };

  const allProperties = (selectedStep.propertyGroups ?? []).flatMap((g) => g.properties);

  const isGroupVisible = (group: StepPropertyGroup): boolean => {
    if (!group.parentToggle) return true;
    const parentProp = allProperties.find((p) => p.id === group.parentToggle);
    return parentProp ? !!parentProp.value : true;
  };

  const hasPropertyGroups = (selectedStep.propertyGroups ?? []).length > 0;

  return (
    <div className="deepidv--settings">
      <div className="deepidv--settings-body">
        {/* Header */}
        <div className="deepidv--settings-header">
          <div
            className="deepidv--step-icon deepidv--step-icon--xl"
            style={{ background: getStepGradient(selectedStep.id) }}
          >
            <Icon icon={icon} width={28} />
          </div>
          <div className="deepidv--settings-header-text">
            <p className="deepidv--settings-step-name">{selectedStep.label}</p>
            <h3 className="deepidv--settings-title">
              {labels.configureSettings ?? 'Configure Settings'}
            </h3>
          </div>
        </div>

        <hr className="deepidv--settings-divider" />

        {!hasPropertyGroups && (
          <p className="deepidv--settings-no-config">
            {labels.noSettings ?? 'No configurable settings for this step'}
          </p>
        )}

        {(selectedStep.propertyGroups ?? []).map((group) => {
          if (!isGroupVisible(group)) return null;
          const visibleProperties = group.properties.filter((p) => p.type !== 'hidden');
          if (visibleProperties.length === 0) return null;

          return (
            <div key={group.groupId} className="deepidv--property-group">
              <div>
                <h4 className="deepidv--property-group-name">{group.groupName}</h4>
                {group.groupTooltip && (
                  <p className="deepidv--property-group-tooltip">{group.groupTooltip}</p>
                )}
              </div>

              {visibleProperties.map((prop) => {
                if (renderCustomProperty) {
                  const custom = renderCustomProperty(prop, group, selectedStep, (val) => {
                    updatePropertyValue(group.groupId, prop.id, val);
                  });
                  if (custom !== undefined) {
                    return <React.Fragment key={prop.id}>{custom}</React.Fragment>;
                  }
                }
                return (
                  <PropertyRenderer
                    key={prop.id}
                    property={prop}
                    onChange={(propId, val) => {
                      updatePropertyValue(group.groupId, propId, val);
                    }}
                    allProperties={allProperties}
                    groupProperties={group.properties}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
