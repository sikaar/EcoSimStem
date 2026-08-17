import type { CSSProperties } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';

/**
 * Persistent exit, present in every screen that isn't the start menu
 * itself (Free Mode, Game Mode, Legacy). Before this, the only way back to
 * the menu was the ExtinctionScreen's MAIN MENU button — reachable only
 * after both populations died, which meant a run in progress (or the
 * legacy iframe, which has no extinction screen at all) had no way out
 * except closing the tab.
 *
 * No confirmation dialog: autosave already covers this (day-boundary and
 * on-blur, see GameView), so leaving mid-run loses at most a partial day,
 * the same tradeoff a tab close already has. That matches the existing
 * MAIN MENU button on the extinction screen, which also doesn't confirm.
 *
 * Bottom corner, opposite TuningPanel's toggle so the two never collide:
 * TuningPanel sits bottom-left on desktop / bottom-right on mobile, so
 * this takes the other corner on each.
 */
const baseStyle: CSSProperties = {
  position: 'absolute',
  fontFamily: 'var(--mono)',
  fontSize: 10,
  letterSpacing: '0.1em',
  color: 'var(--dim)',
  background: 'var(--panel2)',
  border: '1px solid var(--line)',
  borderRadius: 4,
  padding: '6px 12px',
  cursor: 'pointer',
  zIndex: 6,
};

const desktopStyle: CSSProperties = { ...baseStyle, bottom: 14, right: 14 };
const mobileStyle: CSSProperties = { ...baseStyle, bottom: 8, left: 8, fontSize: 9, padding: '5px 9px' };

export interface BackToMenuButtonProps {
  onClick: () => void;
}

export function BackToMenuButton({ onClick }: BackToMenuButtonProps) {
  const isMobile = useIsMobile();
  return (
    <button style={isMobile ? mobileStyle : desktopStyle} onClick={onClick}>
      ← MENU
    </button>
  );
}
