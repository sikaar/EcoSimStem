import type { CSSProperties } from 'react';
import { useSimStore } from '../../store/simStore';

/**
 * Bottom-centre control bar (§10.1). Speed multiplier is what makes a
 * ~93s day (dawn + forage + dusk) testable without sitting through it —
 * loop.ts already threads a speedMultiplier through the fixed-timestep
 * accumulator, this is just the UI to change it.
 */
const SPEED_OPTIONS = [1, 2, 4, 8, 16] as const;

const barStyle: CSSProperties = {
  position: 'absolute',
  bottom: 14,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontFamily: 'var(--mono)',
  fontSize: 11,
  letterSpacing: '0.06em',
  color: 'var(--text)',
  background: 'var(--panel2)',
  border: '1px solid var(--line2)',
  borderRadius: 4,
  padding: '6px 10px',
};

const playButtonStyle: CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 11,
  letterSpacing: '0.1em',
  color: 'var(--text)',
  background: 'transparent',
  border: '1px solid var(--line)',
  borderRadius: 4,
  padding: '6px 16px',
  cursor: 'pointer',
};

function speedButtonStyle(active: boolean): CSSProperties {
  return {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    color: active ? 'var(--ink)' : 'var(--dim)',
    background: active ? 'var(--teal)' : 'transparent',
    border: '1px solid ' + (active ? 'var(--teal)' : 'var(--line)'),
    borderRadius: 3,
    padding: '4px 7px',
    cursor: 'pointer',
    lineHeight: 1,
  };
}

export function PlayBar() {
  const paused = useSimStore((s) => s.paused);
  const togglePaused = useSimStore((s) => s.togglePaused);
  const speedMultiplier = useSimStore((s) => s.speedMultiplier);
  const setSpeedMultiplier = useSimStore((s) => s.setSpeedMultiplier);

  return (
    <div style={barStyle}>
      <button onClick={togglePaused} style={playButtonStyle}>
        {paused ? 'PLAY' : 'PAUSE'}
      </button>
      <div style={{ display: 'flex', gap: 4 }}>
        {SPEED_OPTIONS.map((speed) => (
          <button
            key={speed}
            onClick={() => setSpeedMultiplier(speed)}
            style={speedButtonStyle(speed === speedMultiplier)}
            aria-pressed={speed === speedMultiplier}
          >
            {speed}×
          </button>
        ))}
      </div>
    </div>
  );
}
