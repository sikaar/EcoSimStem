import type { Rng } from '../engine/rng';
import type { Tuning } from '../engine/types';
import { TUNING_FIELDS } from './tuningFields';

/**
 * The card draft (§8.3) — the pick the day-phase machine has been pausing
 * for since PR5, which until now showed a "not built yet" placeholder every
 * `draftIntervalDays`.
 *
 * Two constraints shaped the deck, and both are worth stating because they
 * rule out the obvious card ideas:
 *
 * 1. Every card is a pure tuning delta. Saves persist `seed`, `day` and a
 *    tuning delta, and resume works by deterministic replay
 *    (persistence.ts) — so a card that added rabbits, moved a lake, or
 *    killed a predator would simply vanish on resume, while a card that
 *    changes tuning survives it. The approximation this leaves is the same
 *    one the tuning panel already has: a card taken on day 6 replays as if
 *    it had been in force since day 1.
 *
 * 2. Every card is a trade-off, never a pure gift. This is a selection
 *    game, and a draft of straight upgrades is just a slower "win" button —
 *    the interesting question is which pressure you would rather live
 *    under, so each card loosens one screw and tightens another.
 *
 * Deltas are clamped to each knob's published range (TUNING_FIELDS) when
 * applied, so repeatedly drafting the same card walks a value to the edge
 * of its slider and stops there rather than off the end of the model.
 */
export interface DraftCard {
  id: string;
  title: string;
  /** One line, present tense, naming the trade explicitly. */
  description: string;
  /** Additive deltas, keyed by tuning field. Applied through
   * `applyDraftCard`, which clamps to the knob's range. */
  delta: Partial<Record<keyof Tuning, number>>;
}

export const DRAFT_DECK: readonly DraftCard[] = [
  {
    id: 'wet-season',
    title: 'Wet Season',
    description: 'Plenty grows, and it grows back fast — but a fed population breeds into the next shortage.',
    delta: { plants: 12, regrowDays: -0.15, hungerPerDay: 0.03 },
  },
  {
    id: 'drought',
    title: 'Drought',
    description: 'The map thins out. What survives it goes further on less.',
    delta: { plants: -12, energyMax: 30 },
  },
  {
    id: 'fallow-ground',
    title: 'Fallow Ground',
    description: 'More standing food than the map has ever held, and a long wait for any of it to come back.',
    delta: { plants: 14, regrowDays: 0.4 },
  },
  {
    id: 'cautious-blood',
    title: 'Cautious Blood',
    description: 'They turn for home far earlier. Almost nobody is caught out after dark; almost nobody eats their fill.',
    delta: { returnSafetyMargin: 0.8, plants: -6 },
  },
  {
    id: 'mutagenic-bloom',
    title: 'Mutagenic Bloom',
    description: 'Mutation runs hot. Evolution moves faster — in both directions.',
    delta: { mutChance: 0.08, mutStep: 0.03 },
  },
  {
    id: 'keen-stock',
    title: 'Keen Stock',
    description: 'Newborns see further, and pay for the eyes every second they are open.',
    delta: { senseMin: 1, senseMax: 1, senseCostK: 0.012 },
  },
  {
    id: 'lean-legs',
    title: 'Lean Legs',
    description: 'A faster founding stock, on a metabolism that punishes running.',
    delta: { speedMin: 0.2, speedMax: 0.2, moveCostK: 0.04 },
  },
  {
    id: 'fertile-ground',
    title: 'Fertile Ground',
    description: 'Shorter pregnancies and a stronger urge — more mouths, sooner.',
    delta: { gestMinDays: -0.3, urgeMin: 0.06, hungerPerDay: 0.02 },
  },
  {
    id: 'old-blood',
    title: 'Old Blood',
    description: 'Long lives carrying old genes, and slow to make new ones.',
    delta: { lifeMinDays: 3, lifeMaxDays: 3, gestMinDays: 0.5 },
  },
  {
    id: 'mange',
    title: 'Mange',
    description: 'The predators sicken: slower on their feet, and slower to starve.',
    delta: { predatorSpeed: -0.25, predatorHungerPerDay: -0.04 },
  },
  {
    id: 'hard-winter',
    title: 'Hard Winter',
    description: 'Everything costs more to simply be. The marginal die; the efficient inherit.',
    delta: { idleCost: 0.05, energyMax: 30 },
  },
  {
    id: 'still-water',
    title: 'Still Water',
    description: 'Drinking from further out, at the price of a thirstier animal.',
    delta: { drinkRadius: 0.5, thirstPerDay: 0.04 },
  },
];

const FIELD_RANGE = new Map(TUNING_FIELDS.map((f) => [f.key, { min: f.min, max: f.max }] as const));

/** Applies a card's deltas to a tuning object, clamped to each knob's
 * published slider range. Returns a new object — callers decide whether to
 * assign it into `liveTuning` (the live run) or somewhere else. */
export function applyDraftCard(tuning: Tuning, card: DraftCard): Tuning {
  const next = { ...tuning };
  for (const [key, delta] of Object.entries(card.delta) as Array<[keyof Tuning, number]>) {
    const range = FIELD_RANGE.get(key);
    const raw = next[key] + delta;
    next[key] = range ? Math.min(range.max, Math.max(range.min, raw)) : raw;
  }
  return next;
}

/**
 * Draws `count` distinct cards.
 *
 * The caller passes an RNG that is NOT the simulation's own. Drawing from
 * `sim.rng` would consume the same stream the simulation advances on, so a
 * run that drafted would diverge from the identical-seed replay that
 * `runUntilDay` performs on resume — the determinism the save format is
 * built on. Seeding a throwaway RNG from (seed, day) keeps the draw
 * reproducible without touching that stream.
 */
export function drawDraftHand(rng: Rng, count = 3, deck: readonly DraftCard[] = DRAFT_DECK): DraftCard[] {
  const pool = [...deck];
  const hand: DraftCard[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const index = Math.min(pool.length - 1, Math.floor(rng.next() * pool.length));
    hand.push(pool.splice(index, 1)[0]!);
  }
  return hand;
}
