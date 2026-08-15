import type { CSSProperties } from 'react';
import { useSimStore } from '../../store/simStore';
import { useIsMobile } from '../hooks/useMediaQuery';

/** Top-left counts panel (§10.1). */
const panelStyle: CSSProperties = {
  position: 'absolute',
  top: 14,
  left: 14,
  fontFamily: 'var(--mono)',
  fontSize: 11,
  color: 'var(--dim)',
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 4,
  padding: '10px 14px',
  lineHeight: 1.6,
};

// Shrunk so it can't collide with DayPhaseIndicator's centered pill on a
// narrow phone — the two share the top row with nothing to route around.
const mobilePanelStyle: CSSProperties = {
  ...panelStyle,
  top: 8,
  left: 8,
  fontSize: 9,
  padding: '6px 9px',
  lineHeight: 1.45,
};

export function Census() {
  const { rabbitCount, predatorCount, plantCount, meanSense } = useSimStore();
  const isMobile = useIsMobile();

  return (
    <div style={isMobile ? mobilePanelStyle : panelStyle}>
      <div>
        <span style={{ color: 'var(--rabbit)' }}>rabbits</span> <i style={{ color: 'var(--text)' }}>{rabbitCount}</i>
      </div>
      <div>
        <span style={{ color: 'var(--fox)' }}>predators</span> <i style={{ color: 'var(--text)' }}>{predatorCount}</i>
      </div>
      <div>
        <span style={{ color: 'var(--leaf)' }}>plants</span> <i style={{ color: 'var(--text)' }}>{plantCount}</i>
      </div>
      {!isMobile && (
        <div>
          mean sense <i style={{ color: 'var(--text)' }}>{meanSense.toFixed(1)}m</i>
        </div>
      )}
    </div>
  );
}
