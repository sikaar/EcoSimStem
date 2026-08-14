import { useSimStore } from '../../store/simStore';
import type { DeathCause } from '../../engine/systems/lifecycle';

/**
 * Shown briefly at resolve (§8.2) — skippable via click or the CONTINUE
 * button. showDayReport() (simStore) also pauses the sim, so this genuinely
 * holds the game still rather than just visually overlaying a running scene.
 */
const DEATH_CAUSE_LABEL: Record<DeathCause, string> = {
  exposure: 'exposure',
  collapse: 'collapse',
  starvation: 'starvation',
  dehydration: 'thirst',
  age: 'old age',
  predation: 'predation',
};

function formatDelta(current: number, previous: number | undefined): string {
  if (previous === undefined) return '';
  const delta = current - previous;
  if (Math.abs(delta) < 0.05) return '';
  const arrow = delta > 0 ? '▲' : '▼';
  return ` (${arrow} ${Math.abs(delta).toFixed(1)})`;
}

export function DayReport() {
  const { dayReport, previousDayReport, dismissDayReport } = useSimStore();
  if (!dayReport) return null;

  const totalDeaths = Object.values(dayReport.deaths).reduce((a, b) => a + b, 0);
  const deathBreakdown = (Object.entries(dayReport.deaths) as Array<[DeathCause, number]>)
    .filter(([, count]) => count > 0)
    .map(([cause, count]) => `${count} ${DEATH_CAUSE_LABEL[cause]}`)
    .join(' · ');

  return (
    <div
      onClick={dismissDayReport}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(13,20,22,0.82)',
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        zIndex: 10,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          fontFamily: 'var(--mono)',
          color: 'var(--text)',
          background: 'var(--panel2)',
          border: '1px solid var(--line2)',
          borderRadius: 6,
          padding: '24px 32px',
          minWidth: 320,
          textAlign: 'center',
          cursor: 'default',
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--teal)', marginBottom: 10 }}>
          DAY {dayReport.day}
        </div>
        <div style={{ fontSize: 15, marginBottom: 8 }}>
          {dayReport.survived} survived · {dayReport.born} born · {totalDeaths} died
        </div>
        {deathBreakdown && <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 12 }}>{deathBreakdown}</div>}
        <div style={{ fontSize: 11, color: 'var(--dim)', fontStyle: 'italic' }}>
          mean sense {dayReport.meanSense.toFixed(1)}m{formatDelta(dayReport.meanSense, previousDayReport?.meanSense)}
          {' · '}
          mean speed {dayReport.meanSpeed.toFixed(2)}m/s{formatDelta(dayReport.meanSpeed, previousDayReport?.meanSpeed)}
        </div>
        <button
          onClick={dismissDayReport}
          style={{
            marginTop: 18,
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '0.1em',
            color: 'var(--text)',
            background: 'transparent',
            border: '1px solid var(--line)',
            borderRadius: 4,
            padding: '6px 16px',
            cursor: 'pointer',
          }}
        >
          CONTINUE
        </button>
      </div>
    </div>
  );
}
