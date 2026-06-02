import type { CSSProperties } from 'react';
import type { WorkflowBuilderTheme } from '../types.js';

// ----------------------------------------------------------------------
// Maps a WorkflowBuilderTheme object to inline CSS custom properties.
// Only non-undefined keys are emitted, so the CSS defaults remain
// for anything the consumer doesn't override.
// ----------------------------------------------------------------------

// Hex → rgba helper for generating alpha variants from a single primary color
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6 && clean.length !== 3) return null;
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

const TOKEN_MAP: Record<keyof WorkflowBuilderTheme, string> = {
  colorPrimary: '--deepidv-color-primary',
  colorPrimaryLight: '--deepidv-color-primary-light',
  colorBg: '--deepidv-color-bg',
  colorBgSubtle: '--deepidv-color-bg-subtle',
  colorBgCanvas: '--deepidv-color-bg-canvas',
  colorText: '--deepidv-color-text',
  colorTextSecondary: '--deepidv-color-text-secondary',
  colorTextDisabled: '--deepidv-color-text-disabled',
  colorBorder: '--deepidv-color-border',
  colorSuccess: '--deepidv-color-success',
  colorError: '--deepidv-color-error',
  colorWarning: '--deepidv-color-warning',
  fontFamily: '--deepidv-font-family',
  radiusMd: '--deepidv-radius-md',
  radiusSm: '--deepidv-radius-sm',
};

export function buildThemeStyle(theme: WorkflowBuilderTheme | undefined): CSSProperties {
  if (!theme) return {};

  const style: Record<string, string> = {};

  for (const [key, cssVar] of Object.entries(TOKEN_MAP)) {
    const value = theme[key as keyof WorkflowBuilderTheme];
    if (value !== undefined) {
      style[cssVar] = value;
    }
  }

  // Auto-derive alpha variants when primary is overridden
  if (theme.colorPrimary) {
    const rgb = hexToRgb(theme.colorPrimary);
    if (rgb) {
      style['--deepidv-color-primary-alpha-10'] = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`;
      style['--deepidv-color-primary-alpha-20'] = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`;
      style['--deepidv-color-primary-alpha-40'] = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`;
    }
  }

  // Also set divider when border is overridden (they share the same default)
  if (theme.colorBorder && !style['--deepidv-color-divider']) {
    style['--deepidv-color-divider'] = theme.colorBorder;
  }

  return style as CSSProperties;
}
