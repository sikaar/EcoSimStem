import { useState } from 'react';
import type { CSSProperties } from 'react';
import { liveTuning, resetLiveTuning } from '../../store/liveTuning';
import { useSimStore } from '../../store/simStore';
import { useGameStore } from '../../store/gameStore';
import { unlockLevelFor } from '../../config/gameLevels';
import { fieldsInSection, computeKnobCost, SECTION_LABEL, type TuningSection, type TuningFieldDef } from '../../config/tuningFields';
import { Knob } from '../components/Knob';
import { useIsMobile } from '../hooks/useMediaQuery';
import { AboutScreen } from '../screens/AboutScreen';
import type { Tuning } from '../../engine/types';

/**
 * Debug/Game-Mode tuning panel — bottom-left on desktop (§10.1). Field
 * data (range, tier, section, tooltip) lives in config/tuningFields.ts,
 * the single source both this panel and the EP cost engine read from.
 *
 * Free Mode: every section is always open, every knob always free — this
 * panel behaves exactly as it did before Game Mode existed.
 * Game Mode: a section renders a "locked" message until its level is
 * reached (config/gameLevels.ts's `unlocks`), and every adjustment inside
 * an unlocked section costs EP per config/tuningFields.ts's `tier` —
 * insufficient EP means the slider doesn't move (the input is a
 * controlled component bound to `liveTuning`, which spendEP-declined
 * onChange never touches).
 *
 * Most fields take effect on the next tick — `liveTuning` is the same
 * object reference the running sim reads every step. `predatorStart` is
 * creation-time-only (only read inside createSim), so it's grouped with
 * an explicit Restart button rather than pretending it applies live.
 */
const SECTION_ORDER: TuningSection[] = ['environment', 'rabbitMetabolism', 'rabbitGenes', 'predator', 'shared', 'restart', 'performance'];

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
  const [pendingBadge, setPendingBadge] = useState<{ key: keyof Tuning; text: string } | null>(null);
  const requestRestart = useSimStore((s) => s.requestRestart);
  const gameMode = useGameStore((s) => s.mode);
  const isSectionUnlocked = useGameStore((s) => s.isSectionUnlocked);
  const spendEP = useGameStore((s) => s.spendEP);
  const day = useSimStore((s) => s.day);
  const isMobile = useIsMobile();

  const setField = (field: TuningFieldDef) => (value: number) => {
    if (gameMode === 'game' && field.tier !== 'free') {
      const cost = computeKnobCost(field, liveTuning[field.key], value);
      if (cost > 0) {
        const ok = spendEP(cost, `${field.label} ${field.format ? field.format(liveTuning[field.key]) : liveTuning[field.key]} → ${field.format ? field.format(value) : value}`, day);
        setPendingBadge({ key: field.key, text: ok ? `−${cost} EP` : `need ${cost} EP` });
        window.setTimeout(() => setPendingBadge((b) => (b?.key === field.key ? null : b)), 1500);
        if (!ok) return; // declined — liveTuning untouched, slider snaps back to its bound value
      }
    }
    liveTuning[field.key] = value;
    bump((n) => n + 1);
  };

  const renderSection = (section: TuningSection) => {
    const fields = fieldsInSection(section);
    if (fields.length === 0) return null;
    const unlocked = isSectionUnlocked(section);
    return (
      <div key={section}>
        <div style={groupLabelStyle}>{SECTION_LABEL[section]}</div>
        {!unlocked ? (
          <div style={{ fontSize: 10.5, color: 'var(--dim)', padding: '4px 0 10px' }}>
            Unlocked at Level {unlockLevelFor(section)}. Complete the current objective to proceed.
          </div>
        ) : (
          fields.map((field) => (
            <Knob
              key={field.key}
              label={field.label}
              value={liveTuning[field.key] as number}
              min={field.min}
              max={field.max}
              step={field.step}
              format={field.format}
              tip={field.tip}
              badge={pendingBadge?.key === field.key ? pendingBadge.text : null}
              onChange={setField(field)}
            />
          ))
        )}
      </div>
    );
  };

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
        <span style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--dim)' }}>{gameMode === 'game' ? 'TUNING (COSTS EP)' : 'DEBUG TUNING'}</span>
        <button
          onClick={() => setOpen(false)}
          style={{ background: 'transparent', border: 0, color: 'var(--dim)', cursor: 'pointer', fontSize: 14 }}
        >
          ×
        </button>
      </div>

      {SECTION_ORDER.map(renderSection)}

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
