import { useState } from 'react';
import type { CSSProperties } from 'react';
import { liveTuning, resetLiveTuning } from '../../store/liveTuning';
import { useSimStore } from '../../store/simStore';
import { Knob } from '../components/Knob';
import { useIsMobile } from '../hooks/useMediaQuery';
import { AboutScreen } from '../screens/AboutScreen';
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
  tip?: string;
}

const PREDATOR_FIELDS: TuningField[] = [
  {
    key: 'predatorSpeed',
    label: 'speed',
    min: 1,
    max: 6,
    step: 0.1,
    format: (v) => `${v.toFixed(1)} m/s`,
    tip: 'The primary coexistence lever. Drop below evolved rabbit speed to make the chase survivable.',
  },
  {
    key: 'predatorSense',
    label: 'sense',
    min: 4,
    max: 22,
    step: 0.5,
    format: (v) => `${v.toFixed(1)} m`,
    tip: 'How far a predator detects rabbits. Rabbits flee any predator within their own sense radius.',
  },
  {
    key: 'predatorGain',
    label: 'hunger gain / kill',
    min: 0.1,
    max: 1,
    step: 0.02,
    format: (v) => v.toFixed(2),
    tip: 'Energy restored per kill, as a fraction of the energy pool. Lower forces constant hunting.',
  },
  {
    key: 'predatorBreedThreshold',
    label: 'breed threshold',
    min: 0.05,
    max: 0.6,
    step: 0.01,
    format: (v) => v.toFixed(2),
    tip: 'A well-fed predator breeds below this energy fraction. Lower slows the boom-bust cycle.',
  },
];

const RESTART_ONLY_FIELDS: TuningField[] = [
  { key: 'predatorStart', label: 'starting predators', min: 0, max: 12, step: 1, tip: 'How many predators exist at day 1.' },
  {
    key: 'plants',
    label: 'plant count',
    min: 6,
    max: 140,
    step: 1,
    tip: 'How many plants exist as rabbit food — set once at world generation, unlike regrow delay below which applies live.',
  },
];

const SHARED_FIELDS: TuningField[] = [
  {
    key: 'moveCostK',
    label: 'move cost / speed²',
    min: 0.05,
    max: 0.8,
    step: 0.01,
    format: (v) => v.toFixed(2),
    tip: 'Energy drained per second scales with speed² × this — the superlinear cost (§5.2) that makes running expensive.',
  },
  {
    key: 'senseCostK',
    label: 'sense cost / m',
    min: 0,
    max: 0.2,
    step: 0.005,
    format: (v) => v.toFixed(3),
    tip: 'Energy drained per metre of sense radius per second. A wide sense range costs, it isn’t free.',
  },
  {
    key: 'idleCost',
    label: 'idle cost / s',
    min: 0,
    max: 0.6,
    step: 0.01,
    format: (v) => v.toFixed(2),
    tip: 'Energy drained per second even standing still — the floor cost of being alive.',
  },
  {
    key: 'energyMax',
    label: 'energy pool max',
    min: 60,
    max: 400,
    step: 10,
    tip: 'Size of the per-day energy pool (§5.1). Hits zero → collapse, independent of hunger/thirst.',
  },
];

const RABBIT_METABOLISM_FIELDS: TuningField[] = [
  {
    key: 'hungerPerDay',
    label: 'hunger / day',
    min: 0.1,
    max: 0.6,
    step: 0.01,
    format: (v) => v.toFixed(2),
    tip: 'Hunger gained per day (§6.1) — full starvation kills at 1.0. The multi-day search budget, separate from the energy pool.',
  },
  {
    key: 'thirstPerDay',
    label: 'thirst / day',
    min: 0.1,
    max: 0.6,
    step: 0.01,
    format: (v) => v.toFixed(2),
    tip: 'Thirst gained per day. Ponds are sparser than plants, so this usually kills first.',
  },
  {
    key: 'maturityDays',
    label: 'maturity',
    min: 1,
    max: 12,
    step: 0.5,
    format: (v) => `${v}d`,
    tip: 'Age at which a rabbit can breed.',
  },
  {
    key: 'lifeMinDays',
    label: 'lifespan floor',
    min: 4,
    max: 40,
    step: 1,
    format: (v) => `${v}d`,
    tip: 'Shortest natural lifespan. Old age should be rare — if it dominates, the world is too easy.',
  },
  {
    key: 'lifeMaxDays',
    label: 'lifespan ceiling',
    min: 6,
    max: 60,
    step: 1,
    format: (v) => `${v}d`,
    tip: 'Longest natural lifespan. Longer lives slow generational turnover.',
  },
];

const RABBIT_GENE_FIELDS: TuningField[] = [
  {
    key: 'senseMin',
    label: 'sense min',
    min: 2,
    max: 15,
    step: 0.5,
    format: (v) => `${v}m`,
    tip: 'Lower bound of founding sensory radius. Blind outside this distance.',
  },
  {
    key: 'senseMax',
    label: 'sense max',
    min: 3,
    max: 15,
    step: 0.5,
    format: (v) => `${v}m`,
    tip: 'Upper bound. A wide spread gives selection more to work with.',
  },
  {
    key: 'speedMin',
    label: 'speed min',
    min: 0.5,
    max: 4,
    step: 0.1,
    format: (v) => `${v.toFixed(1)} m/s`,
    tip: 'Lower bound of founding speed.',
  },
  {
    key: 'speedMax',
    label: 'speed max',
    min: 0.8,
    max: 4.2,
    step: 0.1,
    format: (v) => `${v.toFixed(1)} m/s`,
    tip: 'Upper bound. Whether speed is worth its move cost is what the sim answers.',
  },
  {
    key: 'urgeMin',
    label: 'urge min',
    min: 0.12,
    max: 0.95,
    step: 0.01,
    format: (v) => v.toFixed(2),
    tip: 'Lower bound of founding reproductive urge. High urge outranks foraging in drive arbitration (§6.2).',
  },
  {
    key: 'urgeMax',
    label: 'urge max',
    min: 0.15,
    max: 0.95,
    step: 0.01,
    format: (v) => v.toFixed(2),
    tip: 'Upper bound. Under predation pressure this gene tends to climb.',
  },
  {
    key: 'gestMinDays',
    label: 'gestation min',
    min: 0.5,
    max: 8,
    step: 0.5,
    format: (v) => `${v}d`,
    tip: 'Founding gestation range, coupled to offspring maturity (§5.3): short gestation matures faster.',
  },
  {
    key: 'gestMaxDays',
    label: 'gestation max',
    min: 1,
    max: 10,
    step: 0.5,
    format: (v) => `${v}d`,
    tip: 'Upper bound of gestation range.',
  },
  {
    key: 'mutChance',
    label: 'mutation chance',
    min: 0,
    max: 0.6,
    step: 0.01,
    format: (v) => `${Math.round(v * 100)}%`,
    tip: 'Odds each inherited gene mutates on birth. Zero freezes the gene pool.',
  },
  {
    key: 'mutStep',
    label: 'mutation step',
    min: 0.01,
    max: 0.4,
    step: 0.01,
    format: (v) => `${Math.round(v * 100)}% of range`,
    tip: 'Size of a mutation when it occurs, as a fraction of that gene’s range.',
  },
];

const ENVIRONMENT_FIELDS: TuningField[] = [
  {
    key: 'regrowDays',
    label: 'regrow delay',
    min: 0.1,
    max: 3,
    step: 0.1,
    format: (v) => `${v.toFixed(1)}d`,
    tip: 'Days before an eaten plant reappears elsewhere on the map.',
  },
  {
    key: 'eatRadius',
    label: 'reach to eat',
    min: 0.2,
    max: 3,
    step: 0.05,
    format: (v) => `${v.toFixed(2)} m`,
    tip: 'Arrival distance to consume a plant. Widen to diagnose movement stalls.',
  },
  {
    key: 'drinkRadius',
    label: 'reach to drink',
    min: 0.4,
    max: 5,
    step: 0.1,
    format: (v) => `${v.toFixed(2)} m`,
    tip: 'Distance from the shore that counts as drinking.',
  },
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

// Bottom-right instead of bottom-left, and smaller — bottom-left is where
// PlayBar's centered pill reaches on a narrow phone, so left would collide.
const mobileToggleStyle: CSSProperties = {
  ...toggleStyle,
  bottom: 8,
  left: 'auto',
  right: 8,
  fontSize: 9,
  padding: '5px 9px',
};

const panelStyle: CSSProperties = {
  position: 'absolute',
  bottom: 50,
  left: 14,
  width: 260,
  maxHeight: '60vh',
  overflowY: 'auto',
  fontFamily: 'var(--mono)',
  color: 'var(--text)',
  background: 'var(--panel2)',
  border: '1px solid var(--line2)',
  borderRadius: 4,
  padding: '12px 14px',
};

const mobilePanelStyle: CSSProperties = {
  ...panelStyle,
  bottom: 44,
  left: 'auto',
  right: 8,
  width: 'min(260px, calc(100vw - 16px))',
  maxHeight: '50vh',
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
  const [aboutOpen, setAboutOpen] = useState(false);
  const [, bump] = useState(0);
  const requestRestart = useSimStore((s) => s.requestRestart);
  const isMobile = useIsMobile();

  const setField = (key: keyof Tuning) => (value: number) => {
    liveTuning[key] = value;
    bump((n) => n + 1);
  };

  const renderGroup = (title: string, fields: TuningField[]) => (
    <div key={title}>
      <div style={groupLabelStyle}>{title}</div>
      {fields.map((field) => (
        <Knob
          key={field.key}
          label={field.label}
          value={liveTuning[field.key] as number}
          min={field.min}
          max={field.max}
          step={field.step}
          format={field.format}
          tip={field.tip}
          onChange={setField(field.key)}
        />
      ))}
    </div>
  );

  if (!open) {
    return (
      <button style={isMobile ? mobileToggleStyle : toggleStyle} onClick={() => setOpen(true)}>
        TUNING
      </button>
    );
  }

  return (
    <div style={isMobile ? mobilePanelStyle : panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--dim)' }}>DEBUG TUNING</span>
        <button
          onClick={() => setOpen(false)}
          style={{ background: 'transparent', border: 0, color: 'var(--dim)', cursor: 'pointer', fontSize: 14 }}
        >
          ×
        </button>
      </div>

      {renderGroup('Environment', ENVIRONMENT_FIELDS)}
      {renderGroup('Rabbit — metabolism', RABBIT_METABOLISM_FIELDS)}
      {renderGroup('Rabbit — starting genes', RABBIT_GENE_FIELDS)}
      {renderGroup('Predator', PREDATOR_FIELDS)}
      {renderGroup('Shared (energy / cost)', SHARED_FIELDS)}
      {renderGroup('Restart required', RESTART_ONLY_FIELDS)}

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

      <button
        onClick={() => setAboutOpen(true)}
        style={{
          marginTop: 8,
          width: '100%',
          background: 'transparent',
          border: 0,
          fontFamily: 'var(--mono)',
          fontSize: 9,
          color: 'var(--dim)',
          cursor: 'pointer',
        }}
      >
        ⓘ ABOUT
      </button>
      <AboutScreen open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
}
