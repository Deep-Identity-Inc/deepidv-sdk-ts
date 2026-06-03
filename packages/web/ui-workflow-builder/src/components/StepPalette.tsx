import React, { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import type { StepDefinition, WorkflowStep, WorkflowBuilderLabels } from '../types.js';
import { getStepGradient } from '../utils/helpers.js';

// ----------------------------------------------------------------------

const CATEGORY_TABS = [
  { value: 'All', label: 'All' },
  { value: 'Verify', label: 'Verify' },
  { value: 'Docs', label: 'Docs' },
  { value: 'Screen', label: 'Screen' },
] as const;

// ----------------------------------------------------------------------

interface PaletteCardProps {
  step: StepDefinition;
  disabled: boolean;
  onAdd: (stepId: string) => void;
}

function PaletteCard({ step, disabled, onAdd }: PaletteCardProps): React.ReactElement {
  const handleDragStart = (e: React.DragEvent): void => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('application/workflow-step', step.id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleClick = (): void => {
    if (!disabled) onAdd(step.id);
  };

  return (
    <div
      className="deepidv--palette-card"
      data-disabled={disabled ? 'true' : undefined}
      draggable={!disabled}
      onDragStart={handleDragStart}
      onClick={handleClick}
    >
      <div
        className="deepidv--step-icon"
        style={{ background: getStepGradient(step.id) }}
      >
        <Icon icon={step.icon ?? 'solar:widget-bold-duotone'} width={20} />
      </div>
      <div style={{ flexGrow: 1, minWidth: 0 }}>
        <div className="deepidv--step-label">{step.label}</div>
        {step.description && (
          <div className="deepidv--step-description">{step.description}</div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------

interface StepPaletteProps {
  steps: StepDefinition[];
  workflowSteps: WorkflowStep[];
  disabledStepIds: string[];
  labels: WorkflowBuilderLabels;
  hideAdded?: boolean;
  onAddStep: (stepId: string) => void;
}

export function StepPalette({
  steps,
  workflowSteps,
  disabledStepIds,
  labels,
  hideAdded = true,
  onAddStep,
}: StepPaletteProps): React.ReactElement {
  const [search, setSearch] = useState('');
  const [categoryTab, setCategoryTab] = useState('All');

  const filteredServices = useMemo(() => {
    let filtered = steps;

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.label.toLowerCase().includes(q) ||
          (s.description?.toLowerCase().includes(q) ?? false),
      );
    }

    if (categoryTab !== 'All') {
      filtered = filtered.filter((s) => s.category === categoryTab);
    }

    if (hideAdded) {
      filtered = filtered.filter((s) => !workflowSteps.some((ws) => ws.id === s.id));
    }

    return filtered;
  }, [steps, search, categoryTab, workflowSteps, hideAdded]);

  return (
    <div className="deepidv--palette">
      <div className="deepidv--palette-header">
        <h3 className="deepidv--palette-title">
          {labels.paletteTitle ?? 'Available Services'}
        </h3>
        <input
          className="deepidv--palette-search"
          placeholder={labels.searchPlaceholder ?? 'Search services...'}
          value={search}
          onChange={(e) => { setSearch(e.target.value); }}
        />
      </div>

      <div className="deepidv--category-tabs">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className="deepidv--category-tab"
            data-active={categoryTab === tab.value ? 'true' : undefined}
            onClick={() => { setCategoryTab(tab.value); }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="deepidv--palette-list">
        {filteredServices.map((step) => (
          <PaletteCard
            key={step.id}
            step={step}
            disabled={disabledStepIds.includes(step.id)}
            onAdd={onAddStep}
          />
        ))}
        {filteredServices.length === 0 && (
          <p className="deepidv--palette-empty">
            {search ? 'No services match your search' : 'All services have been added'}
          </p>
        )}
      </div>
    </div>
  );
}
