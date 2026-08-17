import { useEffect, useRef } from 'react';
import { liveTuning } from '../../store/liveTuning';
import { simRef } from '../../store/simRef';
import { createSim, runUntilDay, step, type SimState } from '../../engine/sim';
import { completeDraft } from '../../engine/day';
import { createRng } from '../../engine/rng';
import { drawDraftHand } from '../../config/draftCards';
import { createFixedTimestepLoop } from '../../engine/loop';
import { createScene } from '../../render/scene';
import { createOrbitControls } from '../../render/orbit';
import { createCreatureLayers } from '../../render/creatureView';
import { createSenseRings } from '../../render/senseRings';
import { useSimStore, type SimSnapshot } from '../../store/simStore';
import { useGameStore, type GameMode } from '../../store/gameStore';
import { buildObjectiveContext } from '../../store/objectiveContext';
import { saveRun } from '../../store/persistence';
import { Census } from '../panels/Census';
import { StatsDrawer } from '../panels/StatsDrawer';
import { ObjectivesPanel } from '../panels/ObjectivesPanel';
import { DayPhaseIndicator } from '../components/DayPhaseIndicator';
import { PlayBar } from '../controls/PlayBar';
import { TuningPanel } from '../controls/TuningPanel';
import { useIsMobile } from '../hooks/useMediaQuery';
import { DayReport } from './DayReport';
import { DraftModal } from './DraftModal';
import { ExtinctionScreen } from './ExtinctionScreen';

const SNAPSHOT_INTERVAL_MS = 250; // ~4Hz per §4.1 — never per-step

export interface GameViewProps {
  seed: number;
  mode: GameMode;
  /** If set (and > 1), the initial mount replays deterministically up to
   * this day via runUntilDay instead of starting fresh at day 1 — the
   * resume path (§12). Only honored on the very first mount; the tuning
   * panel's Restart button always starts a genuinely fresh run. */
  resumeDay?: number | undefined;
  /** Extinction screen's MAIN MENU button — bubbles back up to App.tsx,
   * which is the only place holding the start/playing screen state. */
  onMainMenu: () => void;
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
    maxGeneration: sim.maxGeneration,
  };
}

export function GameView({ seed, mode, resumeDay, onMainMenu }: GameViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const restartSignal = useSimStore((s) => s.restartSignal);
  const isMobile = useIsMobile();
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

    // Wipes dayReport/geneHistory/runTally/extinctionShown etc. Needed here
    // (not just in requestRestart) because a fresh mount — Main Menu → New
    // Run — has no other path back to clean state: the zustand store is a
    // module-level singleton, so it doesn't reset itself just because a new
    // GameView instance mounted.
    useSimStore.getState().resetRunState();

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

    // Game Mode: EP/level/objective progress only resets on a genuinely
    // fresh run (Restart preserves it, same as V1's resetSim() leaving
    // level/ep untouched — only the population resets). A resumed run
    // doesn't restore Game Mode progress either (§ see the doc comment on
    // resetForNewRun) — it's a page-reload scenario Game Mode's EP/level
    // state was never persisted through in the first place.
    if (!isRestart) useGameStore.getState().resetForNewRun(mode);

    const sim = createSim(runSeed, liveTuning);
    if (useResume) {
      // Deterministic replay (§12): createSim + runUntilDay reproduces the
      // exact state the original run had reached, the same guarantee
      // sim.test.ts's determinism checks rely on. This blocks the main
      // thread for the length of the replay — acceptable for the day
      // counts a balance-limited run actually reaches, but a save from a
      // very long run would show a brief hitch here rather than a spinner.
      runUntilDay(sim, resumeDay, 1 / 60);
    } else if (mode === 'game') {
      // Game Mode never starts with predators present — they only ever
      // arrive via ObjectivesPanel's RELEASE PREDATORS action (ported from
      // V1, where foxes were always released on request, never spawned at
      // creation). Applies to both a genuinely fresh run and a Restart —
      // V1's resetSim() zeroed foxEverReleased unconditionally on every
      // reset, not just the initial start. Skipped on resume: replaying a
      // save doesn't know whether/when the player had clicked release.
      sim.predators.length = 0;
    }
    simRef.current = sim;

    const { scene, camera, renderer, ground, resize, dispose: disposeScene } = createScene(canvas, sim.world);
    const controls = createOrbitControls(camera, canvas);
    const creatures = createCreatureLayers(scene, ground);
    const senseRings = createSenseRings(scene);

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

        // draft never auto-advances (§4.2) — it waits for a card pick, and
        // completeDraft is the only way out of the phase. The hand is drawn
        // from a throwaway RNG seeded by (seed, day) rather than sim.rng:
        // the simulation's own stream is what resume replays against, so
        // drawing from it would make a drafted run diverge from its own
        // replay (see draftCards.ts).
        if (sim.day.phase === 'draft') {
          if (store.draftDismissRequested) {
            sim.day = completeDraft(sim.day);
            useSimStore.setState({ draftDismissRequested: false });
          } else if (!store.draftPending) {
            store.offerDraft(drawDraftHand(createRng(runSeed + sim.day.day * 7919)));
          }
        }

        // Autosave at day boundaries (§12), not on a timer.
        if (sim.day.phase === 'dawn' && sim.day.day !== lastSavedDay) {
          lastSavedDay = sim.day.day;
          saveRun(runSeed, liveTuning, sim.day.day, mode);
        }

        // Extinction can only happen via a death (there's no other way for
        // the arrays to empty), so the merged tally is guaranteed non-empty
        // by the time this fires — the screen never needs a "nothing had
        // time to happen" fallback. sim.deathTally/bornToday are passed in
        // live because a wipeout can land mid-day, before that day's
        // resolve has reported anything to runTally yet (see showExtinction's
        // doc comment).
        if (!store.extinctionShown && sim.rabbits.length === 0 && sim.predators.length === 0) {
          store.showExtinction(sim.deathTally, sim.bornToday);
        }
      },
      render: () => {
        creatures.rabbits.sync(sim.rabbits);
        creatures.predators.sync(sim.predators);
        creatures.plants.sync(sim.plants.filter((p) => p.alive));
        senseRings.update(sim.rabbits, sim.predators, liveTuning.predatorSense, useSimStore.getState().showSenseRings);
        controls.update();
        renderer.render(scene, camera);

        if (sim.lastDayReport && sim.lastDayReport.day !== lastReportedDay) {
          lastReportedDay = sim.lastDayReport.day;
          // Recorded for every day, including draft days, so the genes
          // panel's sparklines have no gaps — separate from *showing* the
          // report, which §8.2 skips on draft days (see below).
          useSimStore.getState().recordDayReport(sim.lastDayReport);

          if (mode === 'game') {
            const gameState = useGameStore.getState();
            if (sim.lastDayReport.day === 1) gameState.captureFounderSpeed(sim.lastDayReport.meanSpeed);
            const simState = useSimStore.getState();
            gameState.tickDay(
              buildObjectiveContext({
                day: sim.lastDayReport.day,
                rabbitCount: sim.rabbits.length,
                predatorCount: sim.predators.length,
                maxGeneration: sim.maxGeneration,
                meanSense: sim.lastDayReport.meanSense,
                runTally: simState.runTally,
                geneHistory: simState.geneHistory,
                tuning: liveTuning,
                predatorEverReleased: gameState.predatorEverReleased,
                founderMeanSpeed: gameState.founderMeanSpeed,
              }),
            );
          }

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
    const onBlur = () => saveRun(runSeed, liveTuning, sim.day.day, mode);
    window.addEventListener('blur', onBlur);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearInterval(snapshotTimer);
      resizeObserver.disconnect();
      window.removeEventListener('blur', onBlur);
      controls.dispose();
      creatures.dispose();
      senseRings.dispose();
      disposeScene();
      if (simRef.current === sim) simRef.current = null;
    };
  }, [restartSignal, seed, resumeDay, mode]);

  return (
    <main style={{ position: 'relative', height: '100%' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none' }} />
      <DayPhaseIndicator />
      <Census />
      <StatsDrawer />
      {!isMobile && <ObjectivesPanel />}
      <PlayBar />
      <TuningPanel />
      <DayReport />
      <DraftModal />
      <ExtinctionScreen onMainMenu={onMainMenu} />
    </main>
  );
}
