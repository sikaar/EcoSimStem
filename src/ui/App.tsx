import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { DEFAULT_TUNING } from '../config/tuning';
import { createSim, step, type SimState } from '../engine/sim';
import { createFixedTimestepLoop } from '../engine/loop';
import { createScene } from '../render/scene';
import { createOrbitControls } from '../render/orbit';
import { createCreatureLayers } from '../render/creatureView';
import { useSimStore, type SimSnapshot } from '../store/simStore';
import type { DeathCause } from '../engine/systems/lifecycle';

const SNAPSHOT_INTERVAL_MS = 250; // ~4Hz per §4.1 — never per-step

function computeSnapshot(sim: SimState): SimSnapshot {
  const senseSum = sim.rabbits.reduce((sum, r) => sum + r.genes.sense, 0);
  return {
    day: sim.day.day,
    phase: sim.day.phase,
    phaseElapsed: sim.day.phaseElapsed,
    rabbitCount: sim.rabbits.length,
    predatorCount: sim.predators.length,
    plantCount: sim.plants.filter((p) => p.alive).length,
    meanSense: sim.rabbits.length ? senseSum / sim.rabbits.length : 0,
  };
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const seed = Math.floor(Math.random() * 1e9);
    const sim = createSim(seed, DEFAULT_TUNING);

    const { scene, camera, renderer, resize, dispose: disposeScene } = createScene(canvas, sim.world);
    const controls = createOrbitControls(camera, canvas);
    const creatures = createCreatureLayers(scene);

    // Shown briefly at resolve (§8.2) — showDayReport also sets `paused`,
    // which the step callback below already honors, so the sim genuinely
    // holds still while the player reads it rather than racing ahead.
    let lastReportedDay = 0;

    const loop = createFixedTimestepLoop({
      dt: 1 / 60,
      step: (dt) => {
        if (useSimStore.getState().paused) return;
        step(sim, dt);
      },
      render: () => {
        creatures.rabbits.sync(sim.rabbits);
        creatures.predators.sync(sim.predators);
        creatures.plants.sync(sim.plants.filter((p) => p.alive));
        controls.update();
        renderer.render(scene, camera);

        if (sim.lastDayReport && sim.lastDayReport.day !== lastReportedDay) {
          lastReportedDay = sim.lastDayReport.day;
          useSimStore.getState().showDayReport(sim.lastDayReport);
        }
      },
      getSpeedMultiplier: () => useSimStore.getState().speedMultiplier,
    });

    let rafId = 0;
    const frame = (now: number) => {
      loop.tick(now);
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);

    const snapshotTimer = window.setInterval(() => {
      useSimStore.getState().setSnapshot(computeSnapshot(sim));
    }, SNAPSHOT_INTERVAL_MS);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearInterval(snapshotTimer);
      resizeObserver.disconnect();
      controls.dispose();
      creatures.dispose();
      disposeScene();
    };
  }, []);

  return (
    <main style={{ position: 'relative', height: '100%' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none' }} />
      <Hud />
      <DayReportModal />
    </main>
  );
}

function Hud() {
  const { day, phase, rabbitCount, predatorCount, plantCount, meanSense, paused, togglePaused } = useSimStore();

  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: 'var(--mono)',
          fontSize: 11,
          letterSpacing: '0.08em',
          color: 'var(--text)',
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderRadius: 4,
          padding: '6px 14px',
          pointerEvents: 'none',
        }}
      >
        DAY {day} · {phase.toUpperCase()}
      </div>
      <div
        style={{
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
        }}
      >
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
      <button
        onClick={togglePaused}
        style={{
          position: 'absolute',
          bottom: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: 'var(--mono)',
          fontSize: 11,
          letterSpacing: '0.1em',
          color: 'var(--text)',
          background: 'var(--panel2)',
          border: '1px solid var(--line2)',
          borderRadius: 4,
          padding: '8px 20px',
          cursor: 'pointer',
        }}
      >
        {paused ? 'PLAY' : 'PAUSE'}
      </button>
    </>
  );
}

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

function DayReportModal() {
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
