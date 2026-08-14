import type { CSSProperties } from 'react';
import { useSimStore } from '../../store/simStore';
import { Sparkline } from '../components/Sparkline';
import type { GeneHistoryPoint } from '../../store/simStore';

/** Top-right genes panel (§10.1, §9.2). Trait cloud (the 3D scatter) is a
 * separate, larger piece — this is just "keep per-gene sparklines for
 * trend," which is the cheaper half of §9.2 and stands on its own. */
const TRAITS: ReadonlyArray<{
  key: keyof Omit<GeneHistoryPoint, 'day'>;
  label: string;
  color: string;
  format: (v: number) => string;
}> = [
  { key: 'sense', label: 'sense', color: '#63b3c4', format: (v) => `${v.toFixed(1)}m` },
  { key: 'speed', label: 'speed', color: '#c2a479', format: (v) => `${v.toFixed(2)}m/s` },
  { key: 'urge', label: 'urge', color: '#c94f3d', format: (v) => v.toFixed(2) },
  { key: 'gest', label: 'gest', color: '#77b258', format: (v) => `${v.toFixed(1)}d` },
  { key: 'des', label: 'des', color: '#f0c05a', format: (v) => v.toFixed(2) },
];

const panelStyle: CSSProperties = {
  position: 'absolute',
  top: 14,
  right: 14,
  fontFamily: 'var(--mono)',
  color: 'var(--dim)',
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 4,
  padding: '10px 14px',
  width: 130,
};

const headerStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.16em',
  color: 'var(--teal)',
  marginBottom: 8,
};

const rowStyle: CSSProperties = { marginBottom: 8 };
const labelRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 10,
  marginBottom: 2,
};

export function Genes() {
  const geneHistory = useSimStore((s) => s.geneHistory);
  if (geneHistory.length === 0) return null;

  const latest = geneHistory[geneHistory.length - 1]!;

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>GENES · DAY {latest.day}</div>
      {TRAITS.map((trait) => (
        <div key={trait.key} style={rowStyle}>
          <div style={labelRowStyle}>
            <span>{trait.label}</span>
            <i style={{ color: 'var(--text)', fontStyle: 'normal' }}>{trait.format(latest[trait.key])}</i>
          </div>
          <Sparkline values={geneHistory.map((p) => p[trait.key])} color={trait.color} />
        </div>
      ))}
    </div>
  );
}
