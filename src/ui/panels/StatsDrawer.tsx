import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';
import { Genes } from './Genes';
import { TraitCloud } from './TraitCloud';
import { ObjectivesPanel } from './ObjectivesPanel';

/**
 * Genes and TraitCloud are two independently-positioned top-right panels
 * (top:14 and top:320) that fit side by side with the phase indicator on a
 * desktop-width screen but have nowhere to go on a phone. On mobile this
 * replaces both with a single "STATS" toggle that opens a scrollable
 * drawer containing them — same components, `inline` mode, no duplicated
 * gene/trait-cloud logic.
 */
const toggleStyle: CSSProperties = {
  position: 'absolute',
  top: 8,
  right: 8,
  fontFamily: 'var(--mono)',
  fontSize: 9,
  letterSpacing: '0.1em',
  color: 'var(--dim)',
  background: 'var(--panel2)',
  border: '1px solid var(--line)',
  borderRadius: 4,
  padding: '5px 10px',
  cursor: 'pointer',
  zIndex: 5,
};

const drawerStyle: CSSProperties = {
  position: 'absolute',
  top: 8,
  right: 8,
  width: 'min(200px, calc(100vw - 16px))',
  maxHeight: 'calc(100vh - 90px)',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  zIndex: 5,
};

export function StatsDrawer() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (!isMobile) {
    return (
      <>
        <Genes />
        <TraitCloud />
      </>
    );
  }

  if (!open) {
    return (
      <button style={toggleStyle} onClick={() => setOpen(true)}>
        STATS
      </button>
    );
  }

  return (
    <div style={drawerStyle}>
      <button style={{ ...toggleStyle, position: 'static', alignSelf: 'flex-end' }} onClick={() => setOpen(false)}>
        CLOSE
      </button>
      <Genes inline />
      <TraitCloud inline />
      <ObjectivesPanel inline />
    </div>
  );
}
