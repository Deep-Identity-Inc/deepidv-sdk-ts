import React from 'react';
import { Icon } from '@iconify/react';
import type { StepProperty, TextListItem } from '../types.js';

// ----------------------------------------------------------------------

interface PropertyRendererProps {
  property: StepProperty;
  onChange: (propId: string, value: unknown) => void;
  allProperties: StepProperty[];
  groupProperties?: StepProperty[];
}

// ----------------------------------------------------------------------

export function PropertyRenderer({
  property,
  onChange,
  allProperties,
  groupProperties,
}: PropertyRendererProps): React.ReactElement | null {
  // Conditional visibility
  if (property.requirement) {
    const reqId = typeof property.requirement === 'string' ? property.requirement : property.requirement.id;
    const pool = groupProperties ?? allProperties;
    const reqProp = pool.find((p) => p.id === reqId);
    if (reqProp) {
      if (typeof property.requirement === 'object') {
        if (reqProp.value === property.requirement.notEquals) return null;
      } else if (!reqProp.value) {
        return null;
      }
    }
  }

  if (property.type === 'hidden') return null;

  switch (property.type) {
    case 'boolean':
      return (
        <div>
          <label className="deepidv--toggle-row">
            <span className="deepidv--toggle-label">{property.label}</span>
            <span className="deepidv--switch">
              <input
                type="checkbox"
                checked={!!property.value}
                onChange={(e) => { onChange(property.id, e.target.checked); }}
              />
              <span className="deepidv--switch-track" />
            </span>
          </label>
          {property.sublabel && (
            <p className="deepidv--toggle-sublabel">{property.sublabel}</p>
          )}
        </div>
      );

    case 'slider':
      return (
        <div className="deepidv--slider-wrapper">
          <div className="deepidv--slider-header">
            {property.label && (
              <span className="deepidv--slider-label">{property.label}</span>
            )}
            {property.unit === '%' && (
              <span className="deepidv--slider-value">{String(property.value)}%</span>
            )}
          </div>
          <input
            type="range"
            className="deepidv--slider"
            value={Number(property.value)}
            onChange={(e) => { onChange(property.id, Number(e.target.value)); }}
            min={property.min ?? 0}
            max={property.max ?? 100}
            step={property.step ?? 1}
          />
          {property.marks && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--deepidv-color-text-secondary)' }}>
              {property.marks
                .filter((m) => m.value === (property.min ?? 0) || m.value === (property.max ?? 100) || m.value === Number(property.value))
                .map((m) => (
                  <span key={m.value}>{m.label}</span>
                ))}
            </div>
          )}
        </div>
      );

    case 'range': {
      const rangeValue = Array.isArray(property.value)
        ? property.value as [number, number]
        : [property.min ?? 0, property.max ?? 100] as [number, number];

      const lowColor = property.lowerColor ?? '#EF4444';
      const midColor = property.middleColor ?? '#22C55E';
      const highColor = property.upperColor ?? '#EF4444';

      return (
        <div className="deepidv--slider-wrapper">
          {property.label && (
            <span className="deepidv--slider-label">{property.label}</span>
          )}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="number"
              className="deepidv--input"
              style={{ width: 60, textAlign: 'center' }}
              value={rangeValue[0]}
              onChange={(e) => { onChange(property.id, [Number(e.target.value), rangeValue[1]]); }}
              min={property.min ?? 0}
              max={rangeValue[1]}
            />
            <span style={{ color: 'var(--deepidv-color-text-secondary)' }}>to</span>
            <input
              type="number"
              className="deepidv--input"
              style={{ width: 60, textAlign: 'center' }}
              value={rangeValue[1]}
              onChange={(e) => { onChange(property.id, [rangeValue[0], Number(e.target.value)]); }}
              min={rangeValue[0]}
              max={property.max ?? 100}
            />
          </div>
          <div className="deepidv--range-zones">
            <div className="deepidv--range-zone" style={{ backgroundColor: `${lowColor}15` }}>
              <span className="deepidv--range-zone-label" style={{ color: lowColor }}>
                &bull; {property.lowerLabel ?? 'Too low'}
              </span>
              <span className="deepidv--range-zone-value">&lt; {rangeValue[0]}</span>
            </div>
            <div className="deepidv--range-zone" style={{ backgroundColor: `${midColor}15` }}>
              <span className="deepidv--range-zone-label" style={{ color: midColor }}>
                &bull; {property.middleLabel ?? 'Valid'}
              </span>
              <span className="deepidv--range-zone-value">{rangeValue[0]} - {rangeValue[1]}</span>
            </div>
            <div className="deepidv--range-zone" style={{ backgroundColor: `${highColor}15` }}>
              <span className="deepidv--range-zone-label" style={{ color: highColor }}>
                &bull; {property.upperLabel ?? 'Too high'}
              </span>
              <span className="deepidv--range-zone-value">&gt; {rangeValue[1]}</span>
            </div>
          </div>
        </div>
      );
    }

    case 'select':
      return (
        <div className="deepidv--select-wrapper">
          <label className="deepidv--select-label">{property.label}</label>
          <select
            className="deepidv--select"
            value={typeof property.value === 'string' || typeof property.value === 'number' ? String(property.value) : ''}
            onChange={(e) => { onChange(property.id, e.target.value); }}
          >
            {(property.options ?? []).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      );

    case 'text':
      return (
        <div className="deepidv--input-wrapper">
          <label className="deepidv--input-label">{property.label}</label>
          <textarea
            className="deepidv--input"
            value={typeof property.value === 'string' ? property.value : ''}
            onChange={(e) => { onChange(property.id, e.target.value); }}
            maxLength={property.maxLength}
            rows={3}
          />
        </div>
      );

    case 'text-list': {
      const items = (property.value ?? []) as TextListItem[];
      return (
        <div>
          <div className="deepidv--text-list-label">{property.label}</div>
          {items.map((item, idx) => (
            <div key={idx} className="deepidv--text-list-item">
              <input
                className="deepidv--input"
                value={item.text}
                onChange={(e) => {
                  const newList = [...items];
                  newList[idx] = { ...newList[idx], text: e.target.value };
                  onChange(property.id, newList);
                }}
              />
              <button
                type="button"
                className="deepidv--icon-btn"
                disabled={items.length <= 1}
                onClick={() => { onChange(property.id, items.filter((_, i) => i !== idx)); }}
              >
                <Icon icon="mingcute:close-line" width={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="deepidv--add-btn"
            onClick={() => { onChange(property.id, [...items, { text: '' }]); }}
          >
            <Icon icon="mingcute:add-line" width={16} /> Add
          </button>
        </div>
      );
    }

    case 'doc-upload': {
      const docs = (property.value ?? []) as TextListItem[];
      return (
        <div>
          <div className="deepidv--text-list-label">{property.label}</div>
          {docs.map((item, idx) => (
            <div key={idx} className="deepidv--text-list-item">
              <input
                className="deepidv--input"
                value={item.text}
                placeholder="Document name"
                onChange={(e) => {
                  const newList = [...docs];
                  newList[idx] = { ...newList[idx], text: e.target.value };
                  onChange(property.id, newList);
                }}
              />
              <button
                type="button"
                className="deepidv--icon-btn"
                disabled={docs.length <= 1}
                onClick={() => { onChange(property.id, docs.filter((_, i) => i !== idx)); }}
              >
                <Icon icon="mingcute:close-line" width={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="deepidv--add-btn"
            onClick={() => { onChange(property.id, [...docs, { text: '' }]); }}
          >
            <Icon icon="mingcute:add-line" width={16} /> Add document
          </button>
        </div>
      );
    }

    default:
      return null;
  }
}
