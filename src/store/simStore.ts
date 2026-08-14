import { create } from 'zustand';
import type { DayPhase } from '../engine/day';
import type { DayReport } from '../engine/systems/lifecycle';

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

const GENE_HISTORY_LIMIT = 60;

interface SimStoreState extends SimSnapshot {
  paused: boolean;
  speedMultiplier: number;
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
}

export const useSimStore = create<SimStoreState>((set) => ({
  day: 1,
  phase: 'dawn',
  phaseElapsed: 0,
  rabbitCount: 0,
  predatorCount: 0,
  plantCount: 0,
  meanSense: 0,
  paused: false,
  speedMultiplier: 1,
  dayReport: null,
  previousDayReport: null,
  setSnapshot: (snapshot) => set(snapshot),
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
    })),
  restartSignal: 0,
  requestRestart: () =>
    set((state) => ({
      restartSignal: state.restartSignal + 1,
      dayReport: null,
      previousDayReport: null,
      paused: false,
      draftPending: false,
      draftDismissRequested: false,
      geneHistory: [],
    })),
  draftPending: false,
  draftDismissRequested: false,
  showDraftPending: () => set({ draftPending: true }),
  requestDraftDismiss: () => set({ draftPending: false, draftDismissRequested: true }),
}));
