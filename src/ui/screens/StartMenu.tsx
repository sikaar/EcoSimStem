import { useState } from 'react';
import type { CSSProperties } from 'react';
import { clearSave, loadSave, type SaveV1 } from '../../store/persistence';

/**
 * §12: "Never auto-resume." The prototype called loadState() at boot and
 * jumped straight into a running sim whenever a save existed, with no
 * route back to the start screen. This offers resume — it never hijacks.
 */
export interface StartMenuProps {
  onNewRun: () => void;
  onResume: (save: SaveV1) => void;
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
  width: 'min(360px, 92vw)',
  textAlign: 'center',
};

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

export function StartMenu({ onNewRun, onResume }: StartMenuProps) {
  const [save, setSave] = useState<SaveV1 | null>(() => loadSave());

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

        <button style={save ? ghostButtonStyle : primaryButtonStyle} onClick={onNewRun}>
          NEW RUN
        </button>
      </div>
    </main>
  );
}
