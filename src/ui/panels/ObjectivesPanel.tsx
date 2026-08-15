import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useSimStore } from '../../store/simStore';
import { liveTuning } from '../../store/liveTuning';
import { simRef } from '../../store/simRef';
import { spawnPredators, spawnRabbits } from '../../engine/sim';
import { GAME_LEVELS } from '../../config/gameLevels';
import { buildObjectiveContext } from '../../store/objectiveContext';

const actionButtonStyle: CSSProperties = {
  flex: 1,
  fontFamily: 'var(--mono)',
  fontSize: 9.5,
  letterSpacing: '0.04em',
  color: 'var(--text)',
  background: 'transparent',
  border: '1px solid var(--line)',
  borderRadius: 4,
  padding: '7px 4px',
  cursor: 'pointer',
};

/**
 * Game Mode's objectives readout — current level, primary progress bar,
 * side-objective checklist, ADVANCE button once the primary completes.
 * Renders nothing outside Game Mode. Ported from V1's #objPanel, minus
 * the show/hide caret toggle (this app's panels are already individually
 * collapsible via TuningPanel-style open/closed toggles where it matters;
 * an always-visible objectives panel is simpler and this one is short).
 */
// Standalone desktop placement: below Census, on the otherwise-empty
// lower-left — the right side is already a two-deep Genes/TraitCloud
// stack (StatsDrawer), and Game Mode is opt-in, so it doesn't need to
// compete for that space. On mobile, GameView skips this entirely and
// StatsDrawer's drawer renders the `inline` variant instead.
const panelStyle: CSSProperties = {
  position: 'absolute',
  top: 150,
  left: 14,
  width: 210,
  fontFamily: 'var(--mono)',
  color: 'var(--dim)',
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 4,
  padding: '10px 14px 12px',
};

const inlinePanelStyle: CSSProperties = {
  fontFamily: 'var(--mono)',
  color: 'var(--dim)',
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 4,
  padding: '10px 14px 12px',
  width: '100%',
};

export interface ObjectivesPanelProps {
  inline?: boolean;
}

export function ObjectivesPanel({ inline = false }: ObjectivesPanelProps) {
  const mode = useGameStore((s) => s.mode);
  const level = useGameStore((s) => s.level);
  const ep = useGameStore((s) => s.ep);
  const levelDone = useGameStore((s) => s.levelDone);
  const sideDone = useGameStore((s) => s.sideDone);
  const consecutiveDaysMet = useGameStore((s) => s.consecutiveDaysMet);
  const predatorEverReleased = useGameStore((s) => s.predatorEverReleased);
  const founderMeanSpeed = useGameStore((s) => s.founderMeanSpeed);
  const advanceLevel = useGameStore((s) => s.advanceLevel);
  const markPredatorReleased = useGameStore((s) => s.markPredatorReleased);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const snapshot = useSimStore();
  const runTally = useSimStore((s) => s.runTally);
  const geneHistory = useSimStore((s) => s.geneHistory);

  if (mode !== 'game') return null;
  const lvl = GAME_LEVELS[level - 1];
  if (!lvl) return null;

  const ctx = {
    ...buildObjectiveContext({
      day: snapshot.day,
      rabbitCount: snapshot.rabbitCount,
      predatorCount: snapshot.predatorCount,
      maxGeneration: snapshot.maxGeneration,
      meanSense: snapshot.meanSense,
      runTally,
      geneHistory,
      tuning: liveTuning,
      predatorEverReleased,
      founderMeanSpeed,
    }),
    consecutiveDaysMet,
  };

  const progress = lvl.primaryProgress(ctx);
  const pct = Math.min((progress.val / progress.max) * 100, 100);

  const predatorSectionUnlocked = useGameStore.getState().isSectionUnlocked('predator');

  const addRabbits = () => {
    const sim = simRef.current;
    if (!sim) return;
    const spawned = spawnRabbits(sim, 20);
    setActionMsg(spawned > 0 ? `+${spawned} rabbits` : 'rabbit cap reached');
    window.setTimeout(() => setActionMsg(null), 2000);
  };

  const releasePredators = () => {
    if (!predatorSectionUnlocked) {
      setActionMsg(`predators unlock at level ${lvl.num < 4 ? 4 : lvl.num}`);
      window.setTimeout(() => setActionMsg(null), 2000);
      return;
    }
    const sim = simRef.current;
    if (!sim) return;
    const spawned = spawnPredators(sim, Math.max(1, liveTuning.predatorStart));
    markPredatorReleased();
    setActionMsg(spawned > 0 ? `${spawned} predators released` : 'predator cap reached');
    window.setTimeout(() => setActionMsg(null), 2000);
  };

  return (
    <div style={inline ? inlinePanelStyle : panelStyle}>
      <div style={{ fontSize: 9, letterSpacing: '0.16em', color: 'var(--teal)', marginBottom: 4 }}>
        LEVEL {lvl.num} — {lvl.name.toUpperCase()}
      </div>
      <div style={{ fontSize: 10, marginBottom: 8, lineHeight: 1.5 }}>{lvl.desc}</div>
      <div style={{ fontSize: 9, color: 'var(--dim)', marginBottom: 8 }}>
        EP <i style={{ color: 'var(--gold)', fontStyle: 'normal' }}>{Math.floor(ep)}</i>
      </div>

      <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--text)' }}>{lvl.primaryLabel}</div>
      <div style={{ height: 3, background: 'rgba(159,216,221,.15)', marginBottom: 2 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--teal)', transition: 'width .4s' }} />
      </div>
      <div style={{ fontSize: 9.5, color: 'var(--dim)', marginBottom: 10 }}>
        {progress.val} / {progress.max}
        {progress.label2 ? ` — ${progress.label2}` : ''}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <button onClick={addRabbits} style={actionButtonStyle}>
          +20 RABBITS
        </button>
        <button onClick={releasePredators} style={{ ...actionButtonStyle, opacity: predatorSectionUnlocked ? 1 : 0.5 }}>
          RELEASE PREDATORS
        </button>
      </div>
      {actionMsg && <div style={{ fontSize: 9.5, color: 'var(--teal)', marginBottom: 8 }}>{actionMsg}</div>}

      {lvl.sides.map((side, i) => (
        <div
          key={side.label}
          style={{
            fontSize: 11,
            padding: '3px 0',
            borderBottom: '1px solid rgba(159,216,221,.06)',
            color: sideDone[i] ? 'var(--leaf)' : 'var(--dim)',
            textDecoration: sideDone[i] ? 'line-through' : 'none',
          }}
        >
          {sideDone[i] ? '✓ ' : '○ '}
          {side.label}
        </div>
      ))}

      {levelDone && (
        <button
          onClick={advanceLevel}
          style={{
            width: '100%',
            marginTop: 10,
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '0.08em',
            color: 'var(--ink)',
            background: 'var(--teal)',
            border: '1px solid var(--teal)',
            borderRadius: 4,
            padding: '8px 0',
            cursor: 'pointer',
          }}
        >
          {level >= GAME_LEVELS.length ? 'COMPLETE' : `ADVANCE TO LEVEL ${level + 1}`}
        </button>
      )}
    </div>
  );
}
