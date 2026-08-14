import { useEffect, useRef } from 'react';
import { DEFAULT_TUNING } from '../config/tuning';
import { createSim, step, type SimState } from '../engine/sim';
import { createFixedTimestepLoop } from '../engine/loop';
import { createScene } from '../render/scene';
import { createOrbitControls } from '../render/orbit';
import { createCreatureLayers } from '../render/creatureView';
import { useSimStore, type SimSnapshot } from '../store/simStore';
import { Census } from './panels/Census';
import { DayPhaseIndicator } from './components/DayPhaseIndicator';
import { PlayBar } from './controls/PlayBar';
import { DayReport } from './screens/DayReport';

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
      <DayPhaseIndicator />
      <Census />
      <PlayBar />
      <DayReport />
    </main>
  );
}
