import { useEffect, useRef } from 'react';
import { liveTuning } from '../store/liveTuning';
import { createSim, step, type SimState } from '../engine/sim';
import { completeDraft } from '../engine/day';
import { createFixedTimestepLoop } from '../engine/loop';
import { createScene } from '../render/scene';
import { createOrbitControls } from '../render/orbit';
import { createCreatureLayers } from '../render/creatureView';
import { useSimStore, type SimSnapshot } from '../store/simStore';
import { Census } from './panels/Census';
import { Genes } from './panels/Genes';
import { DayPhaseIndicator } from './components/DayPhaseIndicator';
import { PlayBar } from './controls/PlayBar';
import { TuningPanel } from './controls/TuningPanel';
import { DayReport } from './screens/DayReport';
import { DraftModal } from './screens/DraftModal';

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
  const restartSignal = useSimStore((s) => s.restartSignal);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // liveTuning is read by reference, not copied — most debug-panel edits
    // land on the very next tick. Fields only read inside createSim
    // (predatorStart, den counts) need this effect to re-run, which is
    // exactly what bumping restartSignal below triggers.
    const seed = Math.floor(Math.random() * 1e9);
    const sim = createSim(seed, liveTuning);

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
        const store = useSimStore.getState();
        if (store.paused) return;
        step(sim, dt);

        // draft never auto-advances (§4.2) — without a real card-draft UI
        // (Phase 2), this is the only way out of it once a run hits a
        // draftIntervalDays boundary.
        if (sim.day.phase === 'draft') {
          if (store.draftDismissRequested) {
            sim.day = completeDraft(sim.day);
            useSimStore.setState({ draftDismissRequested: false });
          } else if (!store.draftPending) {
            store.showDraftPending();
          }
        }
      },
      render: () => {
        creatures.rabbits.sync(sim.rabbits);
        creatures.predators.sync(sim.predators);
        creatures.plants.sync(sim.plants.filter((p) => p.alive));
        controls.update();
        renderer.render(scene, camera);

        if (sim.lastDayReport && sim.lastDayReport.day !== lastReportedDay) {
          lastReportedDay = sim.lastDayReport.day;
          // Recorded for every day, including draft days, so the genes
          // panel's sparklines have no gaps — separate from *showing* the
          // report, which §8.2 skips on draft days (see below).
          useSimStore.getState().recordDayReport(sim.lastDayReport);

          // §8.2: "auto-skipped when a draft follows" — a draft-interval
          // day would otherwise show the report AND the draft placeholder
          // stacked on top of each other, since they're triggered
          // independently (report here in render(), draft in step() below).
          const isDraftDay = sim.lastDayReport.day % sim.tuning.draftIntervalDays === 0;
          if (!isDraftDay) {
            useSimStore.getState().showDayReport(sim.lastDayReport);
          }
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
  }, [restartSignal]);

  return (
    <main style={{ position: 'relative', height: '100%' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none' }} />
      <DayPhaseIndicator />
      <Census />
      <Genes />
      <PlayBar />
      <TuningPanel />
      <DayReport />
      <DraftModal />
    </main>
  );
}
