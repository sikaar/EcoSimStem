import { useSimStore, type GeneHistoryPoint } from '../../store/simStore';
import { clearSave } from '../../store/persistence';
import type { DeathCause } from '../../engine/systems/lifecycle';

/**
 * Full-run extinction screen — both populations hit zero. Distinct from
 * DayReport (§8.2, per-day, always dismissible) in that this is a dead end:
 * nothing left to simulate, so the only ways out are RUN AGAIN (a fresh
 * seed, same tuning) or MAIN MENU. Ported from the V1 prototype's recap
 * screen, extended for causes V1 didn't have (exposure, collapse — the day-
 * cycle model's own failure modes) alongside the ones it did (starvation,
 * dehydration, predation, age).
 */
const VERDICT: Record<DeathCause, { title: string; verdict: (share: number) => string }> = {
  predation: {
    title: 'The predators ate everything, then starved.',
    verdict: (share) => `Predation took ${share}% of all deaths. Lower predator speed or sense to give coexistence a chance.`,
  },
  starvation: {
    title: 'They starved.',
    verdict: (share) => `Starvation took ${share}% of deaths. Raise plant count, or ease the hunger rate, to test whether it's supply or search time.`,
  },
  dehydration: {
    title: 'They died of thirst.',
    verdict: (share) => `Dehydration took ${share}% of deaths — a search-budget failure. Add water, or widen sense so it's easier to find.`,
  },
  exposure: {
    title: 'The night caught them in the open.',
    verdict: (share) =>
      `Exposure took ${share}% of deaths — creatures were still out when resolve hit. Shorten the day, or raise sense so return timing kicks in earlier.`,
  },
  collapse: {
    title: 'Their energy ran out.',
    verdict: (share) =>
      `Collapse took ${share}% of deaths — the movement-cost pool hit zero before hunger or thirst ever did. Lower move cost / speed², or raise the energy pool max.`,
  },
  age: {
    title: 'They lived out their lifespans.',
    verdict: () => 'Old age dominated — the world is too gentle for selection to bite. Tighten survival pressures.',
  },
};

const DEATH_CAUSE_LABEL: Record<DeathCause, string> = {
  exposure: 'exposure',
  collapse: 'collapse',
  starvation: 'starvation',
  dehydration: 'thirst',
  age: 'old age',
  predation: 'predation',
};

const DRIFT_TRAITS: ReadonlyArray<{ key: keyof Omit<GeneHistoryPoint, 'day'>; label: string; format: (v: number) => string }> = [
  { key: 'sense', label: 'Sensory range', format: (v) => `${v.toFixed(1)}m` },
  { key: 'speed', label: 'Speed', format: (v) => `${v.toFixed(2)}m/s` },
  { key: 'urge', label: 'Repro. urge', format: (v) => v.toFixed(2) },
  { key: 'gest', label: 'Gestation', format: (v) => `${v.toFixed(1)}d` },
  { key: 'des', label: 'Desirability', format: (v) => v.toFixed(2) },
];

export interface ExtinctionScreenProps {
  onMainMenu: () => void;
}

export function ExtinctionScreen({ onMainMenu }: ExtinctionScreenProps) {
  const extinctionShown = useSimStore((s) => s.extinctionShown);
  const day = useSimStore((s) => s.day);
  const maxGeneration = useSimStore((s) => s.maxGeneration);
  const runTally = useSimStore((s) => s.runTally);
  const geneHistory = useSimStore((s) => s.geneHistory);
  const requestRestart = useSimStore((s) => s.requestRestart);
  if (!extinctionShown) return null;

  const totalDeaths = Object.values(runTally.totalDeaths).reduce((a, b) => a + b, 0);
  const [dominantCause] = (Object.entries(runTally.totalDeaths) as Array<[DeathCause, number]>).sort((a, b) => b[1] - a[1])[0]!;
  const share = totalDeaths ? Math.round((runTally.totalDeaths[dominantCause] / totalDeaths) * 100) : 0;
  const { title, verdict } = VERDICT[dominantCause];

  const founder = geneHistory[0];
  const final = geneHistory[geneHistory.length - 1];

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(13,20,22,0.82)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 10,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--mono)',
          color: 'var(--text)',
          background: 'var(--panel2)',
          border: '1px solid var(--line2)',
          borderRadius: 6,
          padding: '24px 32px',
          width: 'min(420px, 92vw)',
          maxHeight: '86vh',
          overflowY: 'auto',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--fox)', marginBottom: 10 }}>EXTINCTION</div>
        <div style={{ fontSize: 16, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 16 }}>{verdict(share)}</div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1,
            background: 'var(--line)',
            border: '1px solid var(--line)',
            marginBottom: 16,
          }}
        >
          {[
            [day, 'DAYS'],
            [maxGeneration, 'GENERATIONS'],
            [runTally.peakRabbits, 'PEAK RABBITS'],
            [runTally.totalBorn, 'BORN'],
            [runTally.totalDeaths.predation, 'EATEN'],
            [runTally.totalDeaths.starvation + runTally.totalDeaths.dehydration, 'STARVED/DRIED'],
          ].map(([value, label]) => (
            <div key={label} style={{ background: 'var(--panel)', padding: '9px 10px' }}>
              <b style={{ display: 'block', fontSize: 18, fontWeight: 600 }}>{value}</b>
              <span style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--dim)' }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 10, color: 'var(--dim)', textAlign: 'left', marginBottom: 16 }}>
          {(Object.entries(runTally.totalDeaths) as Array<[DeathCause, number]>)
            .filter(([, count]) => count > 0)
            .map(([cause, count]) => (
              <div key={cause} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid rgba(159,216,221,.08)' }}>
                <span>{DEATH_CAUSE_LABEL[cause]}</span>
                <i style={{ color: 'var(--text)', fontStyle: 'normal' }}>{count}</i>
              </div>
            ))}
        </div>

        {founder && final && geneHistory.length > 1 ? (
          <div style={{ fontSize: 10, textAlign: 'left', marginBottom: 20 }}>
            <div style={{ fontSize: 9, letterSpacing: '0.16em', color: 'var(--teal)', marginBottom: 8 }}>GENE DRIFT — DAY {founder.day} → DAY {final.day}</div>
            {DRIFT_TRAITS.map(({ key, label, format }) => {
              const a = founder[key];
              const b = final[key];
              const pct = a ? Math.round(((b - a) / a) * 100) : 0;
              const flat = Math.abs(pct) < 3;
              const color = flat ? 'var(--dim)' : pct > 0 ? 'var(--leaf)' : 'var(--fox)';
              const arrow = flat ? '—' : pct > 0 ? '▲' : '▼';
              return (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(159,216,221,.08)', color: 'var(--dim)' }}>
                  <span>{label}</span>
                  <i style={{ fontStyle: 'normal', color: 'var(--text)' }}>
                    {format(a)} → {format(b)} <span style={{ color }}>{arrow} {pct > 0 ? '+' : ''}{pct}%</span>
                  </i>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 20 }}>Not enough days for drift to be meaningful.</div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={requestRestart}
            style={{
              flex: 1,
              minWidth: 120,
              fontFamily: 'var(--mono)',
              fontSize: 11,
              letterSpacing: '0.08em',
              color: 'var(--ink)',
              background: 'var(--teal)',
              border: '1px solid var(--teal)',
              borderRadius: 4,
              padding: '10px 0',
              cursor: 'pointer',
            }}
          >
            RUN AGAIN
          </button>
          <button
            onClick={() => {
              clearSave();
              onMainMenu();
            }}
            style={{
              flex: 1,
              minWidth: 120,
              fontFamily: 'var(--mono)',
              fontSize: 11,
              letterSpacing: '0.08em',
              color: 'var(--dim)',
              background: 'transparent',
              border: '1px solid var(--line)',
              borderRadius: 4,
              padding: '10px 0',
              cursor: 'pointer',
            }}
          >
            MAIN MENU
          </button>
        </div>
      </div>
    </div>
  );
}
