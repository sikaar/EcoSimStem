import { useState } from 'react';
import type { CSSProperties } from 'react';

export interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: ((value: number) => string) | undefined;
  /** Explanatory text shown on hover/focus, ported from the V1 prototype's
   * per-knob tooltips (its TAB_DEF `tip` strings). Optional since the
   * predator/shared knobs predate this and don't all have one yet. */
  tip?: string | undefined;
}

const wrapStyle: CSSProperties = { marginBottom: 8, position: 'relative' };
const labelRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontFamily: 'var(--mono)',
  fontSize: 10,
  color: 'var(--dim)',
  marginBottom: 2,
  gap: 8,
};
const sliderStyle: CSSProperties = { width: '100%' };

const tooltipStyle: CSSProperties = {
  position: 'absolute',
  bottom: '100%',
  left: 0,
  right: 0,
  marginBottom: 4,
  padding: '6px 8px',
  background: '#080f11',
  border: '1px solid rgba(99,179,196,.38)',
  borderRadius: 3,
  fontFamily: 'var(--mono)',
  fontSize: 9.5,
  lineHeight: 1.5,
  color: 'var(--text)',
  boxShadow: '0 8px 24px rgba(0,0,0,.5)',
  zIndex: 6,
  pointerEvents: 'none',
};

/** Labeled range input — the tuning panel's atom (§3, `ui/components/Knob`).
 * CSS `:hover` isn't available on inline style objects, and this codebase
 * has no stylesheet beyond the global reset, so the tooltip's visibility
 * is plain hover/focus state instead of a CSS pseudo-class. */
export function Knob({ label, value, min, max, step, onChange, format, tip }: KnobProps) {
  const [showTip, setShowTip] = useState(false);

  return (
    <div
      style={wrapStyle}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
      onFocus={() => setShowTip(true)}
      onBlur={() => setShowTip(false)}
    >
      {tip && showTip && <div style={tooltipStyle}>{tip}</div>}
      <div style={labelRowStyle}>
        <span>{label}</span>
        <i style={{ color: 'var(--text)', fontStyle: 'normal' }}>{format ? format(value) : value}</i>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={sliderStyle}
      />
    </div>
  );
}
