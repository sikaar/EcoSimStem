import { useState } from 'react';
import type { CSSProperties } from 'react';
import { clearSave, loadSave, type SaveV1 } from '../../store/persistence';
import type { GameMode } from '../../store/gameStore';
import { AboutScreen } from './AboutScreen';

/**
 * §12: "Never auto-resume." The prototype called loadState() at boot and
 * jumped straight into a running sim whenever a save existed, with no
 * route back to the start screen. This offers resume — it never hijacks.
 */
export interface StartMenuProps {
  onNewRun: (mode: GameMode) => void;
  onResume: (save: SaveV1) => void;
  /** Launches the original single-file V1 prototype (public/legacy.html)
   * in its own screen, so the rebuild can be checked against it directly
   * instead of from memory. Deliberately styled as a secondary action
   * below the two real modes, not a third card beside them — it isn't a
   * way to play, it's a reference to play against. */
  onLegacy: () => void;
}

function timeAgo(ms: number): string {
  const diffMin = Math.floor((Date.now() - ms) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

const wrapStyle: CSSProperties = {
  position: 'relative',
  height: '100%',
  display: 'grid',
  placeItems: 'center',
  fontFamily: 'var(--mono)',
  color: 'var(--text)',
};

const cardStyle: CSSProperties = {
  background: 'var(--panel2)',
  border: '1px solid var(--line2)',
  borderRadius: 8,
  padding: '32px 40px',
  width: 'min(460px, 92vw)',
  textAlign: 'center',
};

const modeGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  textAlign: 'left',
};

const modeCardStyle: CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 6,
  padding: 16,
  cursor: 'pointer',
  background: 'transparent',
  textAlign: 'left',
  fontFamily: 'var(--sans)',
};

const modeBadgeStyle = (color: string): CSSProperties => ({
  display: 'inline-block',
  fontFamily: 'var(--mono)',
  fontSize: 8.5,
  letterSpacing: '0.12em',
  padding: '2px 6px',
  border: `1px solid ${color}`,
  color,
  marginBottom: 8,
});

const titleStyle: CSSProperties = { fontSize: 22, letterSpacing: '0.1em', margin: 0, color: 'var(--text)' };
const subtitleStyle: CSSProperties = { fontSize: 12, color: 'var(--dim)', marginTop: 8, marginBottom: 24 };

const saveCardStyle: CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 6,
  padding: '12px 14px',
  marginBottom: 20,
  textAlign: 'left',
};

const buttonBase: CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 11,
  letterSpacing: '0.08em',
  borderRadius: 4,
  padding: '9px 0',
  cursor: 'pointer',
  width: '100%',
};

const primaryButtonStyle: CSSProperties = {
  ...buttonBase,
  color: 'var(--ink)',
  background: 'var(--teal)',
  border: '1px solid var(--teal)',
};

const ghostButtonStyle: CSSProperties = {
  ...buttonBase,
  color: 'var(--dim)',
  background: 'transparent',
  border: '1px solid var(--line)',
};

export function StartMenu({ onNewRun, onResume, onLegacy }: StartMenuProps) {
  const [save, setSave] = useState<SaveV1 | null>(() => loadSave());
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <main style={wrapStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>ECOSYSTEM</h1>
        <p style={subtitleStyle}>Evolution under selection, day by day.</p>

        {save && (
          <div style={saveCardStyle}>
            <div style={{ fontSize: 12, marginBottom: 10 }}>
              Resume previous run? <i style={{ color: 'var(--teal)', fontStyle: 'normal' }}>Day {save.day}</i>
              <br />
              <span style={{ color: 'var(--dim)', fontSize: 10 }}>saved {timeAgo(save.savedAt)}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={primaryButtonStyle} onClick={() => onResume(save)}>
                RESUME
              </button>
              <button
                style={ghostButtonStyle}
                onClick={() => {
                  clearSave();
                  setSave(null);
                }}
              >
                DISCARD
              </button>
            </div>
          </div>
        )}

        <div style={modeGridStyle}>
          <button style={modeCardStyle} onClick={() => onNewRun('free')}>
            <span style={modeBadgeStyle('var(--teal)')}>FREE</span>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6, color: 'var(--text)' }}>Free Mode</div>
            <div style={{ fontSize: 11.5, color: 'var(--dim)', lineHeight: 1.5 }}>
              All parameters unlocked from the start. No objectives, no costs. Pure observation and experimentation.
            </div>
          </button>
          <button style={modeCardStyle} onClick={() => onNewRun('game')}>
            <span style={modeBadgeStyle('var(--gold)')}>GAME</span>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6, color: 'var(--text)' }}>Game Mode</div>
            <div style={{ fontSize: 11.5, color: 'var(--dim)', lineHeight: 1.5 }}>
              Start with only environmental controls. Complete objectives to unlock parameters. Adjustments cost Evo
              Points.
            </div>
          </button>
        </div>

        <button
          onClick={onLegacy}
          style={{
            marginTop: 16,
            width: '100%',
            background: 'transparent',
            border: '1px solid var(--line)',
            borderRadius: 4,
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '0.06em',
            color: 'var(--dim)',
            padding: '8px 0',
            cursor: 'pointer',
          }}
        >
          ▸ LEGACY V1 <span style={{ color: 'var(--dim2)' }}>— original single-file prototype</span>
        </button>

        <button
          onClick={() => setAboutOpen(true)}
          style={{ marginTop: 12, background: 'transparent', border: 0, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)', cursor: 'pointer' }}
        >
          ⓘ ABOUT
        </button>
      </div>
      <AboutScreen open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </main>
  );
}
