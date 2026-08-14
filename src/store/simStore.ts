import { create } from 'zustand';
import type { DayPhase } from '../engine/day';

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

interface SimStoreState extends SimSnapshot {
  paused: boolean;
  speedMultiplier: number;
  setSnapshot: (snapshot: SimSnapshot) => void;
  togglePaused: () => void;
  setSpeedMultiplier: (multiplier: number) => void;
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
  setSnapshot: (snapshot) => set(snapshot),
  togglePaused: () => set((state) => ({ paused: !state.paused })),
  setSpeedMultiplier: (multiplier) => set({ speedMultiplier: multiplier }),
}));
