import { create } from 'zustand';
import type { DayPhase } from '../engine/day';
import { emptyDeathTally, type DayReport, type DeathCause } from '../engine/systems/lifecycle';

/**
 * UI reads aggregates from here — never per-step, never the live entity
 * arrays (§4.1). The engine writes a fresh snapshot at ~4Hz; the render
 * layer reads entity transforms straight off the running sim each frame
 * instead, bypassing this store entirely (see render/creatureView.ts).
 */
export interface SimSnapshot {
  day: number;
  phase: DayPhase;
  phaseElapsed: number;
  rabbitCount: number;
  predatorCount: number;
  plantCount: number;
  meanSense: number;
  /** Deepest generation reached so far — surfaced for the extinction
   * screen's "generations reached" tally. */
  maxGeneration: number;
}

/** Lifetime totals across the whole run, not per-day — accumulated as each
 * day report lands, read by the extinction screen when both populations
 * hit zero. Separate from geneHistory (which already covers founder→final
 * gene drift on its own) because death causes and births don't have a
 * "trend line" — they only need a sum. */
export interface RunTally {
  totalBorn: number;
  totalDeaths: Record<DeathCause, number>;
  peakRabbits: number;
}

function emptyRunTally(): RunTally {
  return { totalBorn: 0, totalDeaths: emptyDeathTally(), peakRabbits: 0 };
}

/** One point per day for the genes panel's sparklines (§9.2) — recorded
 * for every day report, including draft days whose report display gets
 * skipped (§8.2), so the trend line has no gaps. */
export interface GeneHistoryPoint {
  day: number;
  sense: number;
  speed: number;
  urge: number;
  gest: number;
  des: number;
}

export const GENE_HISTORY_LIMIT = 60;

interface SimStoreState extends SimSnapshot {
  paused: boolean;
  speedMultiplier: number;
  /** Sense-radius ring overlay (render/senseRings.ts) — an observation aid,
   * off by default since dozens of overlapping circles is noise most of
   * the time, not a run-state concern, so it isn't reset by
   * requestRestart/resetRunState the way dayReport etc. are. */
  showSenseRings: boolean;
  toggleSenseRings: () => void;
  /** Currently displayed day report, or null when none is showing. */
  dayReport: DayReport | null;
  /** The last report that was dismissed — the baseline for the "▲/▼ vs
   * yesterday" deltas the *next* report shows (§8.2). */
  previousDayReport: DayReport | null;
  setSnapshot: (snapshot: SimSnapshot) => void;
  togglePaused: () => void;
  setSpeedMultiplier: (multiplier: number) => void;
  /** Shown briefly at resolve (§8.2) — also soft-pauses the sim so the
   * player has time to read it, independent of the manual pause button. */
  showDayReport: (report: DayReport) => void;
  dismissDayReport: () => void;
  /** Trend history for the genes panel. Separate from showDayReport
   * because that's display-and-pause only and gets skipped entirely on
   * draft days — history recording must not skip right along with it. */
  geneHistory: GeneHistoryPoint[];
  recordDayReport: (report: DayReport) => void;
  /** Bumped by the tuning panel's Restart button. App.tsx's setup effect
   * depends on this, so a change tears down and recreates the whole sim —
   * the only way creation-time-only tuning fields (predatorStart, den
   * counts) actually take effect. */
  restartSignal: number;
  requestRestart: () => void;
  /** The day-phase machine correctly pauses at `draft` every
   * draftIntervalDays (§4.2) waiting for a card pick — but the card draft
   * UI is Phase 2 and doesn't exist yet, so without this the sim gets
   * stuck there forever with nothing to dismiss it. Placeholder until
   * real cards land. */
  draftPending: boolean;
  draftDismissRequested: boolean;
  showDraftPending: () => void;
  requestDraftDismiss: () => void;
  runTally: RunTally;
  /** True once both populations have hit zero and the extinction screen has
   * been shown for this run — a dedicated flag rather than deriving
   * "extinct" from rabbitCount/predatorCount on every render, since the
   * screen should show exactly once per run, not re-fire on every frame
   * the (permanently empty) counts are re-read. */
  extinctionShown: boolean;
  /** Called once, from the step loop, the frame both populations reach
   * zero. Also pauses the sim — nothing left to simulate, and freezing the
   * "DAY N" clock at the moment of extinction reads better than letting it
   * silently keep ticking behind the modal.
   *
   * Takes the engine's current (not-yet-reported) death tally and born
   * count as arguments rather than reading them off runTally alone: a
   * population can hit zero mid-day, before that day's `resolve` has ever
   * built a report, in which case runTally hasn't accumulated today's
   * deaths yet (recordDayReport only fires at resolve). Merging the live,
   * in-progress sim.deathTally in at the moment of extinction avoids a
   * screen that shows fewer deaths than a population that's provably 100%
   * dead must have had. */
  showExtinction: (finalDayDeaths: Record<DeathCause, number>, finalDayBorn: number) => void;
  /** Shared by requestRestart (same GameView instance, tuning-panel
   * Restart) and GameView's mount effect (a fresh instance after Main
   * Menu → New Run) — both need the same "wipe transient run state"
   * behavior; only requestRestart also needs to bump restartSignal to
   * force GameView's setup effect to re-run. */
  resetRunState: () => void;
}

/** The fields a fresh run starts with — shared between requestRestart and
 * resetRunState so the two "start clean" paths can't drift apart. */
function freshRunState() {
  return {
    dayReport: null,
    previousDayReport: null,
    paused: false,
    draftPending: false,
    draftDismissRequested: false,
    geneHistory: [],
    runTally: emptyRunTally(),
    extinctionShown: false,
  };
}

export const useSimStore = create<SimStoreState>((set) => ({
  day: 1,
  phase: 'dawn',
  phaseElapsed: 0,
  rabbitCount: 0,
  predatorCount: 0,
  plantCount: 0,
  meanSense: 0,
  maxGeneration: 1,
  paused: false,
  speedMultiplier: 1,
  showSenseRings: false,
  toggleSenseRings: () => set((state) => ({ showSenseRings: !state.showSenseRings })),
  dayReport: null,
  previousDayReport: null,
  setSnapshot: (snapshot) =>
    set((state) => ({ ...snapshot, runTally: { ...state.runTally, peakRabbits: Math.max(state.runTally.peakRabbits, snapshot.rabbitCount) } })),
  togglePaused: () => set((state) => ({ paused: !state.paused })),
  setSpeedMultiplier: (multiplier) => set({ speedMultiplier: multiplier }),
  showDayReport: (report) => set({ dayReport: report, paused: true }),
  dismissDayReport: () =>
    set((state) => ({
      previousDayReport: state.dayReport ?? state.previousDayReport,
      dayReport: null,
      paused: false,
    })),
  geneHistory: [],
  recordDayReport: (report) =>
    set((state) => ({
      geneHistory: [
        ...state.geneHistory,
        { day: report.day, sense: report.meanSense, speed: report.meanSpeed, urge: report.meanUrge, gest: report.meanGest, des: report.meanDes },
      ].slice(-GENE_HISTORY_LIMIT),
      runTally: {
        ...state.runTally,
        totalBorn: state.runTally.totalBorn + report.born,
        totalDeaths: {
          exposure: state.runTally.totalDeaths.exposure + report.deaths.exposure,
          collapse: state.runTally.totalDeaths.collapse + report.deaths.collapse,
          starvation: state.runTally.totalDeaths.starvation + report.deaths.starvation,
          dehydration: state.runTally.totalDeaths.dehydration + report.deaths.dehydration,
          age: state.runTally.totalDeaths.age + report.deaths.age,
          predation: state.runTally.totalDeaths.predation + report.deaths.predation,
        },
      },
    })),
  restartSignal: 0,
  requestRestart: () => set((state) => ({ restartSignal: state.restartSignal + 1, ...freshRunState() })),
  draftPending: false,
  draftDismissRequested: false,
  showDraftPending: () => set({ draftPending: true }),
  requestDraftDismiss: () => set({ draftPending: false, draftDismissRequested: true }),
  runTally: emptyRunTally(),
  extinctionShown: false,
  showExtinction: (finalDayDeaths, finalDayBorn) =>
    set((state) => ({
      extinctionShown: true,
      paused: true,
      runTally: {
        ...state.runTally,
        totalBorn: state.runTally.totalBorn + finalDayBorn,
        totalDeaths: {
          exposure: state.runTally.totalDeaths.exposure + finalDayDeaths.exposure,
          collapse: state.runTally.totalDeaths.collapse + finalDayDeaths.collapse,
          starvation: state.runTally.totalDeaths.starvation + finalDayDeaths.starvation,
          dehydration: state.runTally.totalDeaths.dehydration + finalDayDeaths.dehydration,
          age: state.runTally.totalDeaths.age + finalDayDeaths.age,
          predation: state.runTally.totalDeaths.predation + finalDayDeaths.predation,
        },
      },
    })),
  resetRunState: () => set(freshRunState()),
}));
