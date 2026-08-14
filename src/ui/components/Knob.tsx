import type { CSSProperties } from 'react';

export interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: ((value: number) => string) | undefined;
}

const wrapStyle: CSSProperties = { marginBottom: 8 };
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

/** Labeled range input — the tuning panel's atom (§3, `ui/components/Knob`). */
export function Knob({ label, value, min, max, step, onChange, format }: KnobProps) {
  return (
    <div style={wrapStyle}>
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
