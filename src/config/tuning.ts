import type { Tuning } from '../engine/types';

/**
 * Retuned from the §5.4 starting points against a real running simulation
 * (engine/sim.ts, PR7) — the §5.4 numbers verbatim produced near-total
 * extinction by day 1 (~29 of 30 starting creatures dead of energy
 * collapse). `balance.test.ts` is still the authority and these values
 * remain free to move; this is one documented pass, not a final answer.
 *
 * What changed from §5.4 and why, in the order each was found:
 * - energyMax 100 -> 280. The derivation note itself flags that a 100-pool
 *   lasts ~56s of a 75s+15s day under continuous movement — every moving
 *   creature was arithmetically certain to run dry before the day ended.
 * - senseMin/Max 5-10 -> 7-14. Founders often had no water in sense range
 *   at all (5 small lakes over a 56x56m map); wider sense made resource
 *   discovery survivable rather than luck-of-the-spawn.
 * - energyFromPlant 45 -> 90, plants 34 -> 50, regrowDays 1 -> 0.5. Once
 *   population growth via births kicked in, 34 plants regrowing once a
 *   day couldn't keep pace with a larger population's hunger.
 * - hungerPerDay 0.34 -> 0.28, thirstPerDay 0.4 -> 0.35. Both still clear
 *   invariant 3's >=2-day floor (now ~3.6 and ~2.9 days) with more buffer
 *   for a creature to actually reach a resource before the cap kills it.
 *
 * Two bugs, not tuning, were fixed alongside these (see the commit for
 * detail): hunger/thirst were incrementing once at dawn instead of
 * accruing continuously through the day, which left food/water urgency
 * flat all day; and the day-scaled mate-cooldown constants had carried
 * over their literal values from the prototype's *seconds*-scale model
 * (female cooldown = gest+5 *days* instead of gest+1) without rescaling.
 *
 * ---------------------------------------------------------------------
 * Second pass, after a diagnostic run found the population collapsing to
 * extinction by day 13 with zero predators and 50 plants untouched. That
 * turned out to be three engine defects, not tuning — all fixed in the
 * same change (drives.ts, movement.ts, predation.ts); see those files. The
 * constants below were then re-derived by measured sweep against 5-7
 * seeds over 20 days, not by guesswork:
 *
 * - returnSafetyMargin 1.15 -> 2.5 (new knob). Urgency is computed from
 *   the straight-line distance home, but the real path detours around
 *   five lakes. At 1.15 a rabbit 16m out turned for home with 1.2s of
 *   slack in a 15s dusk and routinely died at resolve; exposure was the
 *   single largest cause of death (218 across 5 seeds). At 2.5 it drops
 *   to 70 and every seed survives.
 * - duskLengthSec 15 -> 20, denRadius 1.5 -> 2.5. Both widen the same
 *   arrival window; measured as secondary to the margin but additive.
 * - energyFromKill 140 (new knob). A kill previously restored hunger but
 *   not energy, so predators had no refill path at all and collapsed on
 *   day 1 of every run, well fed, mid-hunt.
 * - predatorHuntThreshold 0.15, predatorPatrolFactor 0.55 (new knobs).
 *   Ported from prototype behaviour our first pass dropped: a predator
 *   that hunts while full crops the prey population past what it needs,
 *   and one that sprints while merely patrolling cannot balance its own
 *   energy budget.
 * - predatorSense 11 -> 7, predatorStart 4 -> 2, predatorDens 2 -> 4.
 *   Sense is by far the strongest lever on prey survival (11: rabbits
 *   wiped out in 3 of 5 seeds; 7: all 5 survive). More dens cut predator
 *   exposure deaths, which dominated once their energy was fixed.
 *
 * ---------------------------------------------------------------------
 * Third pass, which closed the "predators dwindle to zero" item the second
 * pass left open. That, too, turned out to be a defect rather than a
 * number: predators spent 88% of the day inside the outer 3m of the map
 * (rabbits: 18%, the band's fair share of the area), because a wander
 * heading that pointed out of the world got clamped ONTO the boundary and
 * accepted, and because "place predator dens as far from the rabbit dens
 * as possible" has exactly one answer on a square map — the corners. Both
 * are fixed in movement.ts and world.ts; edge occupancy is now 17%.
 *
 * With predators finally hunting where the prey actually are, the old
 * numbers made them far too effective — every seed ended in a prey crash —
 * so the predator block was re-derived by sweep against 4-7 seeds:
 *
 * - predatorHungerPerDay 0.22 (new knob, was the shared 0.28). Predators
 *   need their own hunger clock: a rabbit grazes several times a day off
 *   food that doesn't run away, a fox lands ~0.5-1 kills a day with heavy
 *   variance. On the rabbits' rate an ordinary run of bad luck starved
 *   them out, which was the single largest source of run-to-run variance.
 * - predatorSense 7 -> 6 and predatorBreedThreshold 0.22 -> 0.12. Both cut
 *   predation pressure: fewer pursuits per day, and a much slower boom
 *   after a good hunting streak. Sense is still the strongest single lever
 *   on prey survival, and it is still deliberately below the rabbits' 7-14
 *   range so prey usually spots the hunter first.
 *
 * Measured on the five balance seeds: both species share the world for
 * 20/19/20/20/11 of 20 days, with both still alive at day 20 in 3 of 5 —
 * against 0 of 5 and a starved-out predator in every run before. Kills per
 * run went 8 -> 14-41. balance.test.ts invariant 7 pins this.
 *
 * Known open item, in the same spirit as the one this pass closed: with
 * predators present, mean sense now drifts DOWN (-0.42 across the five
 * seeds, versus +0.48 with predators off). Keen sense makes a rabbit flee
 * earlier and more often, and fleeing is charged at speed², so under
 * predation the gene partly punishes itself. Whether that is a feature
 * (a real evolutionary trade-off) or a mis-costed flee response is a
 * design question, not a bug to quietly tune away; invariant 4 asserts the
 * food-finding pressure where it is well-posed and says so explicitly.
 */
export const DEFAULT_TUNING: Tuning = {
  // ---- day cycle ----
  dayLengthSec: 75,
  duskLengthSec: 20,
  draftIntervalDays: 2,
  returnSafetyMargin: 2.5,

  // ---- energy (per-day pool) ----
  energyMax: 280,
  moveCostK: 0.33,
  senseCostK: 0.04,
  idleCost: 0.15,
  energyFromPlant: 90,
  // A predator drains ~3.6/s at default speed/sense, so a 90s day costs
  // ~320 against a 280 pool — it cannot survive on the pool alone and must
  // hunt. At 140 a kill buys roughly 40s of pursuit, so ~2 kills/day is
  // break-even: enough that competent hunting sustains a predator, not so
  // much that one lucky catch coasts it through the day.
  energyFromKill: 140,
  energyCarryover: 0.25,

  // ---- condition (multi-day) ----
  hungerPerDay: 0.28,
  thirstPerDay: 0.35,
  conditionPenalty: 0.5,

  // ---- lifecycle (days) ----
  maturityDays: 4,
  lifeMinDays: 14,
  lifeMaxDays: 22,
  gestMinDays: 1,
  gestMaxDays: 4,

  // ---- world ----
  plants: 50,
  regrowDays: 0.5,
  rabbitDens: 6,
  predatorDens: 4,
  denRadius: 2.5,
  drinkRadius: 1.3,
  eatRadius: 0.6,

  // ---- inheritance ----
  mutChance: 0.13,
  mutStep: 0.09,
  senseMin: 7,
  senseMax: 14,
  speedMin: 1.4,
  speedMax: 2.6,
  urgeMin: 0.35,
  urgeMax: 0.8,

  // ---- predators ----
  predatorSpeed: 3.0,
  // Deliberately below the rabbit sense range (7-14): prey usually spots
  // the hunter first, which is what makes the sense gene worth selecting
  // for. Measured as by far the strongest lever on whether the prey
  // population survives at all — at 11 the rabbits were wiped out in 3 of
  // 5 seeds, at 7 they survived all 5.
  predatorSense: 6,
  predatorHuntThreshold: 0.15,
  predatorPatrolFactor: 0.55,
  predatorHungerPerDay: 0.22,
  predatorGain: 0.62,
  predatorBreedThreshold: 0.12,
  predatorStart: 2,

  // ---- caps ----
  capRabbits: 200,
  capPredators: 42,
};
