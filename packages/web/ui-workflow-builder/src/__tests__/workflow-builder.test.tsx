import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WorkflowBuilder } from '../components/WorkflowBuilder.js';
import { COUPLED_STEPS, STEP_ICON_GRADIENTS } from '../data/constants.js';
import { DEFAULT_STEPS, DEFAULT_TEMPLATES } from '../data/defaults.js';
import {
  serializeWorkflowForSave,
  buildWorkflowFromTemplate,
  getStepGradient,
} from '../utils/helpers.js';
import type { WorkflowValue } from '../types.js';

// ----------------------------------------------------------------------
// Render tests
// ----------------------------------------------------------------------

describe('WorkflowBuilder', () => {
  it('renders without crashing', () => {
    const { container } = render(<WorkflowBuilder />);
    const root = container.querySelector('.deepidv--workflow-builder');
    expect(root).toBeTruthy();
  });

  it('renders empty state when no steps', () => {
    render(<WorkflowBuilder />);
    expect(screen.getByText(/Drag a service from the panel/i)).toBeTruthy();
  });

  it('renders with a controlled value', () => {
    const value: WorkflowValue = {
      name: 'Test Workflow',
      steps: [{ id: 'id-verification', label: 'ID Verification', instanceId: 'id-verification-1' }],
    };
    render(<WorkflowBuilder value={value} />);
    expect(screen.getByText('ID Verification')).toBeTruthy();
  });

  it('calls onChange when workflow changes', () => {
    const onChange = vi.fn();
    render(
      <WorkflowBuilder onChange={onChange} steps={DEFAULT_STEPS} templates={DEFAULT_TEMPLATES} />,
    );
    // The palette cards should be clickable to add steps
    const idVerifyCard = screen.getAllByText('ID Verification')[0];
    fireEvent.click(idVerifyCard);
    expect(onChange).toHaveBeenCalled();
  });

  it('calls onSave when save button is clicked', () => {
    const onSave = vi.fn();
    render(<WorkflowBuilder onSave={onSave} />);
    const saveBtn = screen.getByText('Save Workflow');
    fireEvent.click(saveBtn);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: '', steps: [] }));
  });

  it('hides palette when showPalette is false', () => {
    const { container } = render(<WorkflowBuilder showPalette={false} />);
    expect(container.querySelector('.deepidv--palette')).toBeNull();
  });

  it('hides settings when showSettings is false', () => {
    const { container } = render(<WorkflowBuilder showSettings={false} />);
    expect(container.querySelector('.deepidv--settings')).toBeNull();
  });

  it('hides header when showHeader is false', () => {
    const { container } = render(<WorkflowBuilder showHeader={false} />);
    expect(container.querySelector('.deepidv--header')).toBeNull();
  });

  it('all CSS classes are deepidv-- prefixed', () => {
    const value: WorkflowValue = {
      name: 'Test',
      steps: [{ id: 'id-verification', label: 'ID Verification', instanceId: 'id-1' }],
    };
    const { container } = render(<WorkflowBuilder value={value} />);
    const allElements = container.querySelectorAll('[class]');
    for (const el of allElements) {
      const classes = el.className.split(/\s+/).filter(Boolean);
      for (const cls of classes) {
        expect(cls.startsWith('deepidv--')).toBe(true);
      }
    }
  });
});

// ----------------------------------------------------------------------
// Constants tests
// ----------------------------------------------------------------------

describe('Constants', () => {
  it('DEFAULT_STEPS has expected steps', () => {
    const ids = DEFAULT_STEPS.map((s) => s.id);
    expect(ids).toContain('id-verification');
    expect(ids).toContain('face-liveness');
    expect(ids).toContain('deepfake-detection');
  });

  it('DEFAULT_TEMPLATES has expected templates', () => {
    const ids = DEFAULT_TEMPLATES.map((t) => t.id);
    expect(ids).toContain('kyc-onboarding');
    expect(ids).toContain('lending');
  });

  it('COUPLED_STEPS defines mutual bank statement coupling', () => {
    expect(COUPLED_STEPS['bank-statement-upload']).toContain('ai-bank-statement-analysis');
    expect(COUPLED_STEPS['ai-bank-statement-analysis']).toContain('bank-statement-upload');
  });

  it('STEP_ICON_GRADIENTS has entries for all default steps', () => {
    for (const step of DEFAULT_STEPS) {
      if (step.id !== 'consent') {
        expect(STEP_ICON_GRADIENTS[step.id]).toBeDefined();
      }
    }
  });
});

// ----------------------------------------------------------------------
// Utility tests
// ----------------------------------------------------------------------

describe('serializeWorkflowForSave', () => {
  it('serializes steps with property groups', () => {
    const steps = [
      {
        id: 'id-verification',
        label: 'ID Verification',
        instanceId: 'id-1',
        propertyGroups: [
          {
            groupId: 'fraud-analysis-settings',
            groupName: 'Fraud Analysis',
            properties: [
              {
                id: 'enable-fraud-analysis',
                label: 'Enable',
                type: 'boolean' as const,
                value: true,
              },
            ],
          },
        ],
      },
    ];
    const result = serializeWorkflowForSave(steps);
    expect(result).toHaveLength(1);
    expect(result[0].config['fraud-analysis-settings']['enable-fraud-analysis']).toBe(true);
  });

  it('serializes range values as lower/upper object', () => {
    const steps = [
      {
        id: 'test',
        label: 'Test',
        instanceId: 'test-1',
        propertyGroups: [
          {
            groupId: 'age',
            groupName: 'Age',
            properties: [{ id: 'range', label: 'Range', type: 'range' as const, value: [18, 65] }],
          },
        ],
      },
    ];
    const result = serializeWorkflowForSave(steps);
    expect(result[0].config['age']['range']).toEqual({ lower: 18, upper: 65 });
  });
});

describe('buildWorkflowFromTemplate', () => {
  it('builds a workflow from a template', () => {
    const result = buildWorkflowFromTemplate('kyc-onboarding', DEFAULT_TEMPLATES, DEFAULT_STEPS);
    expect(result.name).toBe('KYC Onboarding');
    expect(result.steps.length).toBe(4);
    expect(result.steps[0].id).toBe('id-verification');
  });

  it('returns empty workflow for unknown template', () => {
    const result = buildWorkflowFromTemplate('nonexistent', DEFAULT_TEMPLATES, DEFAULT_STEPS);
    expect(result.name).toBe('');
    expect(result.steps).toHaveLength(0);
  });
});

describe('getStepGradient', () => {
  it('returns gradient for known step', () => {
    const gradient = getStepGradient('id-verification');
    expect(gradient).toContain('linear-gradient');
  });

  it('returns fallback for unknown step', () => {
    const gradient = getStepGradient('nonexistent');
    expect(gradient).toContain('#8E8E93');
  });
});
