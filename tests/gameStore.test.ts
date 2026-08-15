import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../src/store/gameStore';
import { GAME_LEVELS, type GameLevelObjectiveContext } from '../src/config/gameLevels';

function baseCtx(overrides: Partial<Omit<GameLevelObjectiveContext, 'consecutiveDaysMet'>> = {}) {
  return {
    day: 1,
    rabbitCount: 0,
    predatorCount: 0,
    maxGeneration: 1,
    meanSense: 0,
    predatorEverReleased: false,
    totalExposureDeaths: 0,
    totalDehydrationDeaths: 0,
    totalCollapseDeaths: 0,
    predatorSpeed: 3,
    mutChance: 0.13,
    founderMeanSpeed: undefined,
    currentMeanSpeed: undefined,
    ...overrides,
  };
}

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.getState().resetForNewRun('game');
  });

  it('resetForNewRun sets mode and clears all transient state', () => {
    useGameStore.getState().addEP(50, 'test', 1);
    useGameStore.getState().resetForNewRun('free');
    const s = useGameStore.getState();
    expect(s.mode).toBe('free');
    expect(s.ep).toBe(0);
    expect(s.level).toBe(1);
    expect(s.levelDone).toBe(false);
  });

  it('spendEP blocks when insufficient and succeeds when affordable', () => {
    const s = useGameStore.getState();
    expect(s.spendEP(10, 'too expensive', 1)).toBe(false);
    expect(useGameStore.getState().ep).toBe(0);

    s.addEP(20, 'grant', 1);
    expect(useGameStore.getState().spendEP(10, 'affordable', 1)).toBe(true);
    expect(useGameStore.getState().ep).toBe(10);
  });

  it('spendEP with zero cost always succeeds without charging (Free Mode path)', () => {
    expect(useGameStore.getState().spendEP(0, 'free knob', 1)).toBe(true);
    expect(useGameStore.getState().ep).toBe(0);
  });

  it('isSectionUnlocked always true outside Game Mode', () => {
    useGameStore.getState().resetForNewRun('free');
    expect(useGameStore.getState().isSectionUnlocked('predator')).toBe(true);
    expect(useGameStore.getState().isSectionUnlocked('shared')).toBe(true);
  });

  it('isSectionUnlocked respects level gating in Game Mode', () => {
    expect(useGameStore.getState().isSectionUnlocked('predator')).toBe(false); // level 1
    expect(useGameStore.getState().isSectionUnlocked('environment')).toBe(true); // level 1's own unlock
  });

  it('tickDay awards a side objective exactly once when its condition first becomes true', () => {
    // Level 1's second side ("reach generation 3") is independent of the
    // primary (rabbitCount >= 30) and the first side (rabbitCount >= 30 by
    // day 5), so it's the one that isolates a side-only award.
    useGameStore.getState().tickDay(baseCtx({ day: 3, rabbitCount: 5, maxGeneration: 3 }));
    expect(useGameStore.getState().ep).toBe(30);
    expect(useGameStore.getState().sideDone[1]).toBe(true);
    expect(useGameStore.getState().levelDone).toBe(false);

    // Ticking again with the same condition true must not double-award.
    useGameStore.getState().tickDay(baseCtx({ day: 4, rabbitCount: 5, maxGeneration: 4 }));
    expect(useGameStore.getState().ep).toBe(30);
  });

  it('tickDay awards the level bonus once primary completes, and sets levelDone', () => {
    useGameStore.getState().tickDay(baseCtx({ day: 2, rabbitCount: 30 }));
    const s = useGameStore.getState();
    expect(s.levelDone).toBe(true);
    // Level 1 epBonus (60) + side "reach 30 by day 5" (30) both fire this tick.
    expect(s.ep).toBe(90);

    useGameStore.getState().tickDay(baseCtx({ day: 3, rabbitCount: 30 }));
    expect(useGameStore.getState().ep).toBe(90); // no double award
  });

  it('consecutive-day tracking resets when the daily condition breaks (level 2)', () => {
    useGameStore.getState().advanceLevel(); // -> level 2, whose primary is a 5-day streak of rabbitCount>=25
    expect(useGameStore.getState().level).toBe(2);

    useGameStore.getState().tickDay(baseCtx({ day: 1, rabbitCount: 25 }));
    useGameStore.getState().tickDay(baseCtx({ day: 2, rabbitCount: 25 }));
    expect(useGameStore.getState().consecutiveDaysMet).toBe(2);

    useGameStore.getState().tickDay(baseCtx({ day: 3, rabbitCount: 10 })); // breaks the streak
    expect(useGameStore.getState().consecutiveDaysMet).toBe(0);
    expect(useGameStore.getState().levelDone).toBe(false);

    for (let day = 4; day <= 8; day++) {
      useGameStore.getState().tickDay(baseCtx({ day, rabbitCount: 25 }));
    }
    expect(useGameStore.getState().consecutiveDaysMet).toBe(5);
    expect(useGameStore.getState().levelDone).toBe(true);
  });

  it('advanceLevel resets consecutiveDaysMet/sideDone and unlocks the next level’s sections', () => {
    useGameStore.getState().tickDay(baseCtx({ day: 1, rabbitCount: 30 })); // completes level 1
    useGameStore.getState().advanceLevel();
    const s = useGameStore.getState();
    expect(s.level).toBe(2);
    expect(s.levelDone).toBe(false);
    expect(s.sideDone).toEqual([false, false]);
    expect(s.consecutiveDaysMet).toBe(0);
    expect(s.isSectionUnlocked('rabbitMetabolism')).toBe(true);
  });

  it('advanceLevel is a no-op past the final level', () => {
    for (let i = 0; i < GAME_LEVELS.length - 1; i++) useGameStore.getState().advanceLevel();
    expect(useGameStore.getState().level).toBe(GAME_LEVELS.length);
    useGameStore.getState().advanceLevel();
    expect(useGameStore.getState().level).toBe(GAME_LEVELS.length);
  });

  it('captureFounderSpeed only stores the first call', () => {
    useGameStore.getState().captureFounderSpeed(2.0);
    useGameStore.getState().captureFounderSpeed(3.5);
    expect(useGameStore.getState().founderMeanSpeed).toBe(2.0);
  });
});
