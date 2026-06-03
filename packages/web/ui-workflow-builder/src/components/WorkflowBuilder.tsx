import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Icon } from '@iconify/react';
import type {
  StepDefinition,
  WorkflowBuilderProps,
  WorkflowStep,
  WorkflowValue,
} from '../types.js';
import { DEFAULT_STEPS, DEFAULT_TEMPLATES, COUPLED_STEPS } from '../data/constants.js';
import { getStepGradient, getKeysToRemove, buildWorkflowFromTemplate } from '../utils/helpers.js';
import { buildThemeStyle } from '../utils/theme.js';
import { StepPalette } from './StepPalette.js';
import { StepSettingsPanel } from './StepSettingsPanel.js';

// ----------------------------------------------------------------------

interface StepCardProps {
  step: WorkflowStep;
  stepNumber: number;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
  availableSteps: StepDefinition[];
  disabled: boolean;
}

function StepCard({
  step,
  stepNumber,
  isSelected,
  onClick,
  onDelete,
  availableSteps,
  disabled,
}: StepCardProps): React.ReactElement {
  const stepDef = availableSteps.find((s) => s.id === step.id);
  const stepIcon = step.icon ?? stepDef?.icon ?? 'solar:widget-bold-duotone';
  const stepDescription = stepDef?.description ?? '';

  return (
    <div
      className="deepidv--step-card"
      data-selected={isSelected ? 'true' : undefined}
      onClick={disabled ? undefined : onClick}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <div className="deepidv--step-number">{stepNumber}</div>
      <div className="deepidv--step-card-content">
        <div
          className="deepidv--step-icon deepidv--step-icon--lg"
          style={{ background: getStepGradient(step.id) }}
        >
          <Icon icon={stepIcon} width={24} />
        </div>
        <div className="deepidv--step-card-info">
          <div className="deepidv--step-card-label">{step.label}</div>
          <div className="deepidv--step-card-description">{stepDescription}</div>
        </div>
        <button
          type="button"
          className="deepidv--step-delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Icon icon="solar:close-circle-bold" width={22} />
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------

const EMPTY_WORKFLOW: WorkflowValue = { name: '', steps: [] };

export function WorkflowBuilder({
  defaultValue,
  value,
  onChange,
  onSave,
  onBack,
  steps: stepsProp,
  templates: templatesProp,
  disabledStepIds = [],
  hiddenStepIds = [],
  disabled = false,
  showPalette = true,
  showSettings = true,
  showHeader = true,
  height = '100%',
  labels = {},
  theme,
  renderCustomProperty,
  renderToolbar,
  children,
}: WorkflowBuilderProps): React.ReactElement {
  const themeStyle = useMemo(() => buildThemeStyle(theme), [theme]);
  const allSteps = useMemo(() => stepsProp ?? DEFAULT_STEPS, [stepsProp]);
  const hiddenSet = useMemo(() => new Set(hiddenStepIds), [hiddenStepIds]);
  const availableSteps = useMemo(
    () => allSteps.filter((s) => !hiddenSet.has(s.id)),
    [allSteps, hiddenSet],
  );
  const availableTemplates = useMemo(() => templatesProp ?? DEFAULT_TEMPLATES, [templatesProp]);

  const [internalWorkflow, setInternalWorkflow] = useState<WorkflowValue>(
    () => defaultValue ?? value ?? EMPTY_WORKFLOW,
  );

  const workflow = value ?? internalWorkflow;

  const setWorkflow = useCallback(
    (updater: WorkflowValue | ((prev: WorkflowValue) => WorkflowValue)) => {
      const newValue = typeof updater === 'function' ? updater(workflow) : updater;
      if (!value) setInternalWorkflow(newValue);
      onChange?.(newValue);
    },
    [workflow, value, onChange],
  );

  useEffect(() => {
    if (value) setInternalWorkflow(value);
  }, [value]);

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // --- Add step ---
  const addStep = useCallback(
    (stepId: string) => {
      const stepDef = availableSteps.find((s) => s.id === stepId);
      if (!stepDef) return;

      const instanceId = `${stepId}-${String(Date.now())}`;
      const newStep: WorkflowStep = {
        id: stepDef.id,
        label: stepDef.label,
        icon: stepDef.icon,
        instanceId,
        ...(stepDef.propertyGroups
          ? { propertyGroups: structuredClone(stepDef.propertyGroups) }
          : {}),
      };

      const coupledIds = COUPLED_STEPS[stepId] ?? [];
      const coupledSteps: WorkflowStep[] = [];
      for (const coupledId of coupledIds) {
        const alreadyExists = workflow.steps.some((s) => s.id === coupledId);
        if (!alreadyExists) {
          const coupledDef = availableSteps.find((s) => s.id === coupledId);
          if (coupledDef) {
            coupledSteps.push({
              id: coupledDef.id,
              label: coupledDef.label,
              icon: coupledDef.icon,
              instanceId: `${coupledId}-${String(Date.now())}`,
              ...(coupledDef.propertyGroups
                ? { propertyGroups: structuredClone(coupledDef.propertyGroups) }
                : {}),
            });
          }
        }
      }

      setWorkflow((prev) => ({
        ...prev,
        steps: [...prev.steps, newStep, ...coupledSteps],
      }));
      setSelectedStepId(instanceId);
    },
    [workflow.steps, availableSteps, setWorkflow],
  );

  // --- Delete step ---
  const deleteStep = useCallback(
    (stepKey: string) => {
      const keysToRemove = getKeysToRemove(stepKey, workflow.steps);
      setWorkflow((prev) => ({
        ...prev,
        steps: prev.steps.filter((s) => !keysToRemove.has(s.instanceId || s.id)),
      }));
      if (keysToRemove.has(selectedStepId ?? '')) setSelectedStepId(null);
    },
    [workflow.steps, selectedStepId, setWorkflow],
  );

  // --- Reorder via drag ---
  const handleReorderDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('application/workflow-reorder', String(index));
    e.dataTransfer.effectAllowed = 'move';
    setDragIndex(index);
  }, []);

  const handleReorderDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleReorderDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      const fromIndex = Number(e.dataTransfer.getData('application/workflow-reorder'));
      if (Number.isNaN(fromIndex) || fromIndex === dropIndex) {
        setDragIndex(null);
        setDragOverIndex(null);
        return;
      }
      const steps = [...workflow.steps];
      const moved = steps.splice(fromIndex, 1)[0];
      if (!moved) return;
      steps.splice(dropIndex, 0, moved);
      setWorkflow((prev) => ({ ...prev, steps }));
      setDragIndex(null);
      setDragOverIndex(null);
    },
    [workflow.steps, setWorkflow],
  );

  // --- Drop from palette onto canvas ---
  const handlePaletteDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      // Ignore reorder drops — those are handled by step items
      if (e.dataTransfer.getData('application/workflow-reorder')) return;
      const stepId = e.dataTransfer.getData('application/workflow-step');
      if (stepId) addStep(stepId);
    },
    [addStep],
  );

  const handlePaletteDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  return (
    <div className="deepidv--workflow-builder" style={{ height, ...themeStyle }}>
      {/* Header */}
      {showHeader && !renderToolbar && (
        <div className="deepidv--header">
          <div className="deepidv--header-actions">
            {onBack && (
              <button type="button" className="deepidv--btn deepidv--btn-ghost" onClick={onBack}>
                <Icon icon="eva:arrow-ios-back-fill" width={18} />
                {labels.back ?? 'Back'}
              </button>
            )}
          </div>

          <div className="deepidv--header-actions">
            <div className="deepidv--input-wrapper">
              <input
                className="deepidv--input"
                placeholder={labels.workflowNamePlaceholder ?? 'Enter workflow name'}
                value={workflow.name}
                onChange={(e) => {
                  setWorkflow((prev) => ({ ...prev, name: e.target.value }));
                }}
                style={{ minWidth: 240 }}
              />
            </div>
            <div className="deepidv--select-wrapper">
              <select
                className="deepidv--select"
                value=""
                onChange={(e) => {
                  const templateId = e.target.value;
                  if (templateId === 'scratch') {
                    setWorkflow({ name: '', steps: [] });
                  } else if (templateId) {
                    const built = buildWorkflowFromTemplate(
                      templateId,
                      availableTemplates,
                      availableSteps,
                    );
                    setWorkflow(built);
                  }
                }}
                style={{ minWidth: 280 }}
              >
                <option value="" disabled>
                  {labels.templatePlaceholder ?? 'Choose a template...'}
                </option>
                <option value="scratch">{labels.startFromScratch ?? 'Start from scratch'}</option>
                {availableTemplates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="deepidv--header-actions">
            <button
              type="button"
              className="deepidv--btn deepidv--btn-primary"
              onClick={() => {
                onSave?.(workflow);
              }}
            >
              {labels.save ?? 'Save Workflow'}
            </button>
          </div>
        </div>
      )}

      {renderToolbar && (
        <div className="deepidv--header">{renderToolbar({ workflow, setWorkflow, onSave })}</div>
      )}

      {/* Main Content */}
      <div className="deepidv--content">
        {showPalette && (
          <StepPalette
            steps={availableSteps}
            workflowSteps={workflow.steps}
            disabledStepIds={disabledStepIds}
            labels={labels}
            onAddStep={addStep}
          />
        )}

        {/* Center: step list */}
        <div
          className="deepidv--canvas"
          onDrop={handlePaletteDrop}
          onDragOver={handlePaletteDragOver}
        >
          {workflow.steps.length === 0 ? (
            <div className="deepidv--canvas-empty">
              <div className="deepidv--canvas-empty-icon">
                <Icon icon="solar:cursor-square-bold-duotone" width={24} />
              </div>
              <p className="deepidv--canvas-empty-text">
                {labels.emptyTitle ??
                  'Drag a service from the panel\nto start building your workflow'}
              </p>
            </div>
          ) : (
            <div className="deepidv--step-list">
              {workflow.steps.map((step, index) => {
                const key = step.instanceId || step.id;
                const isDragOver =
                  dragOverIndex === index && dragIndex !== null && dragIndex !== index;
                return (
                  <React.Fragment key={key}>
                    <div
                      className="deepidv--step-list-item"
                      data-dragging={dragIndex === index ? 'true' : undefined}
                      data-drag-over={isDragOver ? 'true' : undefined}
                      draggable
                      onDragStart={(e) => {
                        handleReorderDragStart(e, index);
                      }}
                      onDragOver={(e) => {
                        handleReorderDragOver(e, index);
                      }}
                      onDrop={(e) => {
                        handleReorderDrop(e, index);
                      }}
                      onDragEnd={() => {
                        setDragIndex(null);
                        setDragOverIndex(null);
                      }}
                    >
                      <StepCard
                        step={step}
                        stepNumber={index + 1}
                        isSelected={selectedStepId === key}
                        onClick={() => {
                          setSelectedStepId(key);
                        }}
                        onDelete={() => {
                          deleteStep(key);
                        }}
                        availableSteps={availableSteps}
                        disabled={disabled}
                      />
                    </div>
                    {index < workflow.steps.length - 1 && (
                      <div className="deepidv--step-connector" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        {showSettings && (
          <StepSettingsPanel
            workflow={workflow}
            setWorkflow={setWorkflow}
            selectedStepId={selectedStepId}
            availableSteps={availableSteps}
            labels={labels}
            renderCustomProperty={renderCustomProperty}
          />
        )}
      </div>

      {children}
    </div>
  );
}
