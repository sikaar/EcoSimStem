import { create } from 'zustand';
import { GAME_LEVELS, unlockedSections, type GameLevelObjectiveContext } from '../config/gameLevels';
import type { TuningSection } from '../config/tuningFields';

/**
 * Game Mode's economy and objective-progression state — separate from
 * simStore (per-run sim aggregates) since this genuinely is a different
 * concern: simStore would exist identically with Game Mode deleted
 * entirely, and this store has nothing to say about a Free Mode run.
 *
 * `mode` starts `null`: unset until StartMenu's FREE/GAME choice, not
 * defaulted to Free — GameView shouldn't silently assume a mode nobody
 * picked. App.tsx always sets it before mounting GameView.
 */
export type GameMode = 'free' | 'game';

const SIDE_OBJECTIVE_EP = 30; // flat per-side award, matches V1

interface GameStoreState {
  mode: GameMode | null;
  level: number; // 1-indexed into GAME_LEVELS
  ep: number;
  epHistory: Array<{ amt: number; reason: string; day: number }>;
  levelDone: boolean;
  sideDone: boolean[]; // parallel to GAME_LEVELS[level-1].sides
  consecutiveDaysMet: number;
  predatorEverReleased: boolean;
  founderMeanSpeed: number | undefined;

  setMode: (mode: GameMode) => void;
  /** Full reset for a fresh run — called from GameView's mount effect,
   * same "wipe transient state on every mount" pattern simStore's
   * resetRunState uses, and for the same reason: the store is a
   * module-level singleton that doesn't know a new run started on its
   * own. `mode` itself is passed in since it's chosen on the start menu,
   * before GameView (and this reset) ever runs. */
  resetForNewRun: (mode: GameMode) => void;
  addEP: (amount: number, reason: string, day: number) => void;
  /** Returns false (and charges nothing) if `cost` exceeds current EP —
   * Free Mode calls this too, but always succeeds since TuningPanel never
   * computes a nonzero cost outside Game Mode. */
  spendEP: (cost: number, reason: string, day: number) => boolean;
  markPredatorReleased: () => void;
  captureFounderSpeed: (meanSpeed: number) => void;
  /** Called once per day (from GameView, the same place recordDayReport
   * fires) with the day's objective context minus consecutiveDaysMet —
   * this computes that internally from the current level's
   * dailyConditionMet, then checks primary/side completion and awards EP. */
  tickDay: (ctx: Omit<GameLevelObjectiveContext, 'consecutiveDaysMet'>) => void;
  advanceLevel: () => void;
  isSectionUnlocked: (section: TuningSection) => boolean;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  mode: null,
  level: 1,
  ep: 0,
  epHistory: [],
  levelDone: false,
  sideDone: [false, false],
  consecutiveDaysMet: 0,
  predatorEverReleased: false,
  founderMeanSpeed: undefined,

  setMode: (mode) => set({ mode }),

  resetForNewRun: (mode) =>
    set({
      mode,
      level: 1,
      ep: 0,
      epHistory: [],
      levelDone: false,
      sideDone: [false, false],
      consecutiveDaysMet: 0,
      predatorEverReleased: false,
      founderMeanSpeed: undefined,
    }),

  addEP: (amount, reason, day) =>
    set((state) => ({
      ep: state.ep + amount,
      epHistory: [...state.epHistory, { amt: amount, reason, day }].slice(-20),
    })),

  spendEP: (cost, reason, day) => {
    if (cost <= 0) return true;
    const { ep } = get();
    if (ep < cost) return false;
    set((state) => ({
      ep: state.ep - cost,
      epHistory: [...state.epHistory, { amt: -cost, reason, day }].slice(-20),
    }));
    return true;
  },

  markPredatorReleased: () => set({ predatorEverReleased: true }),
  captureFounderSpeed: (meanSpeed) => set((state) => (state.founderMeanSpeed === undefined ? { founderMeanSpeed: meanSpeed } : {})),

  tickDay: (baseCtx) => {
    const state = get();
    const level = GAME_LEVELS[state.level - 1];
    if (!level) return;

    const consecutiveDaysMet = level.dailyConditionMet
      ? level.dailyConditionMet({ ...baseCtx, consecutiveDaysMet: state.consecutiveDaysMet }) // dailyConditionMet ignores this field; passed for type completeness
        ? state.consecutiveDaysMet + 1
        : 0
      : state.consecutiveDaysMet;

    const ctx: GameLevelObjectiveContext = { ...baseCtx, consecutiveDaysMet };

    const newSideDone = level.sides.map((side, i) => state.sideDone[i] || side.check(ctx));
    for (let i = 0; i < newSideDone.length; i++) {
      if (newSideDone[i] && !state.sideDone[i]) {
        get().addEP(SIDE_OBJECTIVE_EP, `side objective — ${level.sides[i]!.label}`, baseCtx.day);
      }
    }

    const primaryJustDone = !state.levelDone && level.primaryCheck(ctx);
    if (primaryJustDone) {
      get().addEP(level.epBonus, `level ${level.num} complete`, baseCtx.day);
    }

    set({ consecutiveDaysMet, sideDone: newSideDone, levelDone: state.levelDone || primaryJustDone });
  },

  advanceLevel: () =>
    set((state) => {
      if (state.level >= GAME_LEVELS.length) return {};
      const nextLevel = state.level + 1;
      return {
        level: nextLevel,
        levelDone: false,
        sideDone: GAME_LEVELS[nextLevel - 1]!.sides.map(() => false),
        consecutiveDaysMet: 0,
      };
    }),

  isSectionUnlocked: (section) => {
    const { mode, level } = get();
    if (mode !== 'game') return true;
    return unlockedSections(level).has(section);
  },
}));
