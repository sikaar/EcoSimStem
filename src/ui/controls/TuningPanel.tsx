import { useState } from 'react';
import type { CSSProperties } from 'react';
import { liveTuning, resetLiveTuning } from '../../store/liveTuning';
import { useSimStore } from '../../store/simStore';
import { Knob } from '../components/Knob';
import type { Tuning } from '../../engine/types';

/**
 * Debug tuning panel — bottom-left (§10.1). Not the eventual 4-tab
 * Environment/Rabbit/Predator/Settings panel from §10.4; this exists to
 * make the predator-balance open item (tuning.ts's header note: predators
 * die out by day 2 in a full run) explorable live instead of via a
 * code-change-and-redeploy loop.
 *
 * Most fields take effect on the next tick — `liveTuning` is the same
 * object reference the running sim reads every step. `predatorStart` is
 * creation-time-only (only read inside createSim), so it's grouped with
 * an explicit Restart button rather than pretending it applies live.
 */
interface TuningField {
  key: keyof Tuning;
  label: string;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
}

const PREDATOR_FIELDS: TuningField[] = [
  { key: 'predatorSpeed', label: 'speed', min: 1, max: 6, step: 0.1, format: (v) => `${v.toFixed(1)} m/s` },
  { key: 'predatorSense', label: 'sense', min: 4, max: 22, step: 0.5, format: (v) => `${v.toFixed(1)} m` },
  { key: 'predatorGain', label: 'hunger gain / kill', min: 0.1, max: 1, step: 0.02, format: (v) => v.toFixed(2) },
  { key: 'predatorBreedThreshold', label: 'breed threshold', min: 0.05, max: 0.6, step: 0.01, format: (v) => v.toFixed(2) },
];

const RESTART_ONLY_FIELDS: TuningField[] = [
  { key: 'predatorStart', label: 'starting predators', min: 0, max: 12, step: 1 },
];

const SHARED_FIELDS: TuningField[] = [
  { key: 'moveCostK', label: 'move cost / speed²', min: 0.05, max: 0.8, step: 0.01, format: (v) => v.toFixed(2) },
  { key: 'senseCostK', label: 'sense cost / m', min: 0, max: 0.2, step: 0.005, format: (v) => v.toFixed(3) },
  { key: 'idleCost', label: 'idle cost / s', min: 0, max: 0.6, step: 0.01, format: (v) => v.toFixed(2) },
  { key: 'energyMax', label: 'energy pool max', min: 60, max: 400, step: 10 },
  { key: 'hungerPerDay', label: 'hunger / day', min: 0.1, max: 0.6, step: 0.01, format: (v) => v.toFixed(2) },
];

const toggleStyle: CSSProperties = {
  position: 'absolute',
  bottom: 14,
  left: 14,
  fontFamily: 'var(--mono)',
  fontSize: 10,
  letterSpacing: '0.1em',
  color: 'var(--dim)',
  background: 'var(--panel2)',
  border: '1px solid var(--line)',
  borderRadius: 4,
  padding: '6px 12px',
  cursor: 'pointer',
};

const panelStyle: CSSProperties = {
  position: 'absolute',
  bottom: 50,
  left: 14,
  width: 240,
  maxHeight: '60vh',
  overflowY: 'auto',
  fontFamily: 'var(--mono)',
  color: 'var(--text)',
  background: 'var(--panel2)',
  border: '1px solid var(--line2)',
  borderRadius: 4,
  padding: '12px 14px',
};

const groupLabelStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--teal)',
  margin: '10px 0 6px',
  paddingBottom: 3,
  borderBottom: '1px solid rgba(99,179,196,.14)',
};

export function TuningPanel() {
  const [open, setOpen] = useState(false);
  const [, bump] = useState(0);
  const requestRestart = useSimStore((s) => s.requestRestart);

  const setField = (key: keyof Tuning) => (value: number) => {
    liveTuning[key] = value;
    bump((n) => n + 1);
  };

  if (!open) {
    return (
      <button style={toggleStyle} onClick={() => setOpen(true)}>
        TUNING
      </button>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--dim)' }}>DEBUG TUNING</span>
        <button
          onClick={() => setOpen(false)}
          style={{ background: 'transparent', border: 0, color: 'var(--dim)', cursor: 'pointer', fontSize: 14 }}
        >
          ×
        </button>
      </div>

      <div style={groupLabelStyle}>Predator</div>
      {PREDATOR_FIELDS.map((field) => (
        <Knob
          key={field.key}
          label={field.label}
          value={liveTuning[field.key] as number}
          min={field.min}
          max={field.max}
          step={field.step}
          format={field.format}
          onChange={setField(field.key)}
        />
      ))}

      <div style={groupLabelStyle}>Shared (energy / cost)</div>
      {SHARED_FIELDS.map((field) => (
        <Knob
          key={field.key}
          label={field.label}
          value={liveTuning[field.key] as number}
          min={field.min}
          max={field.max}
          step={field.step}
          format={field.format}
          onChange={setField(field.key)}
        />
      ))}

      <div style={groupLabelStyle}>Restart required</div>
      {RESTART_ONLY_FIELDS.map((field) => (
        <Knob
          key={field.key}
          label={field.label}
          value={liveTuning[field.key] as number}
          min={field.min}
          max={field.max}
          step={field.step}
          format={field.format}
          onChange={setField(field.key)}
        />
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          onClick={requestRestart}
          style={{
            flex: 1,
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '0.08em',
            color: 'var(--ink)',
            background: 'var(--teal)',
            border: '1px solid var(--teal)',
            borderRadius: 4,
            padding: '7px 0',
            cursor: 'pointer',
          }}
        >
          RESTART
        </button>
        <button
          onClick={() => {
            resetLiveTuning();
            bump((n) => n + 1);
          }}
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '0.08em',
            color: 'var(--dim)',
            background: 'transparent',
            border: '1px solid var(--line)',
            borderRadius: 4,
            padding: '7px 12px',
            cursor: 'pointer',
          }}
        >
          DEFAULTS
        </button>
      </div>
    </div>
  );
}
