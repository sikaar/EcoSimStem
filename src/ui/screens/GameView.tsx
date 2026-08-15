import { useEffect, useRef } from 'react';
import { liveTuning } from '../../store/liveTuning';
import { simRef } from '../../store/simRef';
import { createSim, runUntilDay, step, type SimState } from '../../engine/sim';
import { completeDraft } from '../../engine/day';
import { createFixedTimestepLoop } from '../../engine/loop';
import { createScene } from '../../render/scene';
import { createOrbitControls } from '../../render/orbit';
import { createCreatureLayers } from '../../render/creatureView';
import { useSimStore, type SimSnapshot } from '../../store/simStore';
import { saveRun } from '../../store/persistence';
import { Census } from '../panels/Census';
import { StatsDrawer } from '../panels/StatsDrawer';
import { DayPhaseIndicator } from '../components/DayPhaseIndicator';
import { PlayBar } from '../controls/PlayBar';
import { TuningPanel } from '../controls/TuningPanel';
import { DayReport } from './DayReport';
import { DraftModal } from './DraftModal';

const SNAPSHOT_INTERVAL_MS = 250; // ~4Hz per §4.1 — never per-step

export interface GameViewProps {
  seed: number;
  /** If set (and > 1), the initial mount replays deterministically up to
   * this day via runUntilDay instead of starting fresh at day 1 — the
   * resume path (§12). Only honored on the very first mount; the tuning
   * panel's Restart button always starts a genuinely fresh run. */
  resumeDay?: number | undefined;
}

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

export function GameView({ seed, resumeDay }: GameViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const restartSignal = useSimStore((s) => s.restartSignal);
  // Captured once at first render and never reassigned. A mutable ref that
  // instead flips to `false` *inside* the effect breaks under React 18
  // StrictMode's dev-only mount→cleanup→mount double-invoke: the first
  // invocation would flip it before the second one reads it, so the second
  // (the one StrictMode actually leaves mounted) would always see "not the
  // first run" and silently drop the resume replay. Comparing against the
  // restartSignal value seen at first render sidesteps that — it's stable
  // across the synthetic double-invoke (same store value both times) and
  // only changes when the Restart button genuinely fires.
  const initialRestartSignal = useRef(restartSignal);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // liveTuning is read by reference, not copied — most debug-panel edits
    // land on the very next tick. Fields only read inside createSim
    // (predatorStart, den counts) need this effect to re-run, which is
    // exactly what bumping restartSignal below triggers.
    //
    // The seed/resumeDay props only apply to the initial mount — the
    // Restart button (via restartSignal) always means "fresh run with
    // current tuning," not "replay the resumed run again."
    const isRestart = restartSignal !== initialRestartSignal.current;
    const useResume = !isRestart && resumeDay !== undefined && resumeDay > 1;
    const runSeed = isRestart ? Math.floor(Math.random() * 1e9) : seed;

    const sim = createSim(runSeed, liveTuning);
    if (useResume) {
      // Deterministic replay (§12): createSim + runUntilDay reproduces the
      // exact state the original run had reached, the same guarantee
      // sim.test.ts's determinism checks rely on. This blocks the main
      // thread for the length of the replay — acceptable for the day
      // counts a balance-limited run actually reaches, but a save from a
      // very long run would show a brief hitch here rather than a spinner.
      runUntilDay(sim, resumeDay, 1 / 60);
    }
    simRef.current = sim;

    const { scene, camera, renderer, ground, resize, dispose: disposeScene } = createScene(canvas, sim.world);
    const controls = createOrbitControls(camera, canvas);
    const creatures = createCreatureLayers(scene, ground);

    // Shown briefly at resolve (§8.2) — showDayReport also sets `paused`,
    // which the step callback below already honors, so the sim genuinely
    // holds still while the player reads it rather than racing ahead.
    let lastReportedDay = 0;
    let lastSavedDay = useResume ? resumeDay! : 0;

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

        // Autosave at day boundaries (§12), not on a timer.
        if (sim.day.phase === 'dawn' && sim.day.day !== lastSavedDay) {
          lastSavedDay = sim.day.day;
          saveRun(runSeed, liveTuning, sim.day.day);
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

    // Autosave on tab blur too (§12), same day-boundary-granularity save.
    const onBlur = () => saveRun(runSeed, liveTuning, sim.day.day);
    window.addEventListener('blur', onBlur);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearInterval(snapshotTimer);
      resizeObserver.disconnect();
      window.removeEventListener('blur', onBlur);
      controls.dispose();
      creatures.dispose();
      disposeScene();
      if (simRef.current === sim) simRef.current = null;
    };
  }, [restartSignal, seed, resumeDay]);

  return (
    <main style={{ position: 'relative', height: '100%' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none' }} />
      <DayPhaseIndicator />
      <Census />
      <StatsDrawer />
      <PlayBar />
      <TuningPanel />
      <DayReport />
      <DraftModal />
    </main>
  );
}
