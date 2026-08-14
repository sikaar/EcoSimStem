import type { CSSProperties } from 'react';
import { DEFAULT_TUNING } from '../../config/tuning';
import { useSimStore } from '../../store/simStore';

/**
 * Persistent day/phase readout with a daylight-remaining bar (§10.2) — the
 * clock the player reads to anticipate resolve. Drains through `forage`,
 * turns amber for the last stretch through `dusk`, matching the "return
 * pressure ramps to maximum" framing in §4.2's phase table.
 */
const wrapStyle: CSSProperties = {
  position: 'absolute',
  top: 14,
  left: '50%',
  transform: 'translateX(-50%)',
  fontFamily: 'var(--mono)',
  fontSize: 11,
  letterSpacing: '0.08em',
  color: 'var(--text)',
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 4,
  padding: '6px 14px',
  pointerEvents: 'none',
  minWidth: 140,
  textAlign: 'center',
};

function daylightRemainingFraction(phase: string, phaseElapsed: number): number {
  const totalWindow = DEFAULT_TUNING.dayLengthSec + DEFAULT_TUNING.duskLengthSec;
  let elapsedInWindow: number;
  if (phase === 'forage') elapsedInWindow = phaseElapsed;
  else if (phase === 'dusk') elapsedInWindow = DEFAULT_TUNING.dayLengthSec + phaseElapsed;
  else if (phase === 'dawn') elapsedInWindow = 0;
  else elapsedInWindow = totalWindow; // resolve/draft/night — the window has closed
  return Math.max(0, Math.min(1, 1 - elapsedInWindow / totalWindow));
}

export function DayPhaseIndicator() {
  const { day, phase, phaseElapsed } = useSimStore();
  const remaining = daylightRemainingFraction(phase, phaseElapsed);
  const barColor = phase === 'dusk' ? 'var(--gold)' : 'var(--teal)';

  return (
    <div style={wrapStyle}>
      <div>
        DAY {day} · {phase.toUpperCase()}
      </div>
      <div style={{ height: 3, background: 'rgba(159,216,221,.15)', marginTop: 6, borderRadius: 2 }}>
        <div
          style={{
            height: '100%',
            width: `${remaining * 100}%`,
            background: barColor,
            borderRadius: 2,
            transition: 'width 0.2s linear, background 0.4s',
          }}
        />
      </div>
    </div>
  );
}
