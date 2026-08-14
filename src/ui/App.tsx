import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { DEFAULT_TUNING } from '../config/tuning';
import { createSim, step, type SimState } from '../engine/sim';
import { createFixedTimestepLoop } from '../engine/loop';
import { createScene } from '../render/scene';
import { createOrbitControls } from '../render/orbit';
import { createCreatureLayers } from '../render/creatureView';
import { useSimStore, type SimSnapshot } from '../store/simStore';

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
