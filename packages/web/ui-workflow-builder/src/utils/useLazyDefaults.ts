import { useState, useEffect } from 'react';
import type { StepDefinition, WorkflowTemplate } from '../types.js';

interface Defaults {
  steps: StepDefinition[];
  templates: WorkflowTemplate[];
}

const EMPTY: Defaults = { steps: [], templates: [] };

/**
 * Lazily loads the heavy default step/template data only when the consumer
 * doesn't supply their own via props. This keeps the main bundle small —
 * the ~500-line defaults module is split into a separate chunk by tsup.
 */
export function useLazyDefaults(
  stepsProp: StepDefinition[] | undefined,
  templatesProp: WorkflowTemplate[] | undefined,
): Defaults {
  const needsDefaults = !stepsProp || !templatesProp;
  const [defaults, setDefaults] = useState(EMPTY);

  useEffect(() => {
    if (!needsDefaults) return;

    let cancelled = false;
    void import('../data/defaults.js').then((mod) => {
      if (!cancelled) {
        setDefaults({ steps: mod.DEFAULT_STEPS, templates: mod.DEFAULT_TEMPLATES });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [needsDefaults]);

  return needsDefaults ? defaults : EMPTY;
}
