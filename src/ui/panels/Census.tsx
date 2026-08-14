import type { CSSProperties } from 'react';
import { useSimStore } from '../../store/simStore';

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

export function Census() {
  const { rabbitCount, predatorCount, plantCount, meanSense } = useSimStore();

  return (
    <div style={panelStyle}>
      <div>
        <span style={{ color: 'var(--rabbit)' }}>rabbits</span> <i style={{ color: 'var(--text)' }}>{rabbitCount}</i>
      </div>
      <div>
        <span style={{ color: 'var(--fox)' }}>predators</span> <i style={{ color: 'var(--text)' }}>{predatorCount}</i>
      </div>
      <div>
        <span style={{ color: 'var(--leaf)' }}>plants</span> <i style={{ color: 'var(--text)' }}>{plantCount}</i>
      </div>
      <div>
        mean sense <i style={{ color: 'var(--text)' }}>{meanSense.toFixed(1)}m</i>
      </div>
    </div>
  );
}
