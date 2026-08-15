import type { GameLevelObjectiveContext } from '../config/gameLevels';
import type { RunTally, GeneHistoryPoint } from './simStore';
import type { Tuning } from '../engine/types';

/**
 * Assembles a GameLevelObjectiveContext (minus consecutiveDaysMet, which
 * only gameStore.tickDay knows how to compute — see its doc comment) from
 * the pieces already tracked elsewhere: simStore's snapshot/runTally/
 * geneHistory, liveTuning, and gameStore's own predatorEverReleased/
 * founderMeanSpeed. Shared by GameView (feeds tickDay once a day) and
 * ObjectivesPanel (recomputes the same shape every render, for display,
 * without a matching consecutiveDaysMet update) so the two call sites
 * can't drift on which fields come from where.
 */
export function buildObjectiveContext(args: {
  day: number;
  rabbitCount: number;
  predatorCount: number;
  maxGeneration: number;
  meanSense: number;
  runTally: RunTally;
  geneHistory: readonly GeneHistoryPoint[];
  tuning: Pick<Tuning, 'predatorSpeed' | 'mutChance'>;
  predatorEverReleased: boolean;
  founderMeanSpeed: number | undefined;
}): Omit<GameLevelObjectiveContext, 'consecutiveDaysMet'> {
  const latest = args.geneHistory[args.geneHistory.length - 1];
  return {
    day: args.day,
    rabbitCount: args.rabbitCount,
    predatorCount: args.predatorCount,
    maxGeneration: args.maxGeneration,
    meanSense: args.meanSense,
    predatorEverReleased: args.predatorEverReleased,
    totalExposureDeaths: args.runTally.totalDeaths.exposure,
    totalDehydrationDeaths: args.runTally.totalDeaths.dehydration,
    totalCollapseDeaths: args.runTally.totalDeaths.collapse,
    predatorSpeed: args.tuning.predatorSpeed,
    mutChance: args.tuning.mutChance,
    founderMeanSpeed: args.founderMeanSpeed,
    currentMeanSpeed: latest?.speed,
  };
}
