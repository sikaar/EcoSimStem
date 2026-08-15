import type { Tuning } from '../engine/types';

/**
 * Single source of truth for every debug/Game-Mode-adjustable knob:
 * label, range, formatting, an explanatory tip, which panel section it
 * lives in, and which knobs unlock at which level (§ level unlock table
 * in gameLevels.ts references `section`). Both TuningPanel.tsx (render)
 * and the EP cost engine (gameLevels.ts / gameStore.ts) read from here so
 * a knob's range can't drift between "what it costs to change" and "what
 * the slider actually shows."
 *
 * `tier` is the Game Mode EP cost category, ported from the V1
 * prototype's KNOB_TIER map: immediate (population-level effects, scales
 * ~quadratically with how far you move it), structural (shapes future
 * generations — starting genes, mutation), terminal (predator knobs —
 * the highest-stakes lever), cosmetic (pacing/reach knobs), free (pure
 * performance caps, no gameplay cost). Irrelevant in Free Mode, where
 * every knob is always adjustable regardless of tier.
 */
export type CostTier = 'immediate' | 'structural' | 'terminal' | 'cosmetic' | 'free';

export type TuningSection = 'environment' | 'rabbitMetabolism' | 'rabbitGenes' | 'predator' | 'shared' | 'restart' | 'performance';

export const SECTION_LABEL: Record<TuningSection, string> = {
  environment: 'Environment',
  rabbitMetabolism: 'Rabbit — metabolism',
  rabbitGenes: 'Rabbit — starting genes',
  predator: 'Predator',
  shared: 'Shared (energy / cost)',
  restart: 'Restart required',
  performance: 'Performance',
};

export interface TuningFieldDef {
  key: keyof Tuning;
  label: string;
  min: number;
  max: number;
  step: number;
  format?: ((v: number) => string) | undefined;
  tip: string;
  section: TuningSection;
  tier: CostTier;
}

export const TUNING_FIELDS: readonly TuningFieldDef[] = [
  // ---- environment ----
  {
    key: 'regrowDays',
    label: 'regrow delay',
    min: 0.1,
    max: 3,
    step: 0.1,
    format: (v) => `${v.toFixed(1)}d`,
    tip: 'Days before an eaten plant reappears elsewhere on the map.',
    section: 'environment',
    tier: 'cosmetic',
  },
  {
    key: 'eatRadius',
    label: 'reach to eat',
    min: 0.2,
    max: 3,
    step: 0.05,
    format: (v) => `${v.toFixed(2)} m`,
    tip: 'Arrival distance to consume a plant. Widen to diagnose movement stalls.',
    section: 'environment',
    tier: 'cosmetic',
  },
  {
    key: 'drinkRadius',
    label: 'reach to drink',
    min: 0.4,
    max: 5,
    step: 0.1,
    format: (v) => `${v.toFixed(2)} m`,
    tip: 'Distance from the shore that counts as drinking.',
    section: 'environment',
    tier: 'cosmetic',
  },

  // ---- rabbit metabolism ----
  {
    key: 'hungerPerDay',
    label: 'hunger / day',
    min: 0.1,
    max: 0.6,
    step: 0.01,
    format: (v) => v.toFixed(2),
    tip: 'Hunger gained per day (§6.1) — full starvation kills at 1.0. The multi-day search budget, separate from the energy pool.',
    section: 'rabbitMetabolism',
    tier: 'immediate',
  },
  {
    key: 'thirstPerDay',
    label: 'thirst / day',
    min: 0.1,
    max: 0.6,
    step: 0.01,
    format: (v) => v.toFixed(2),
    tip: 'Thirst gained per day. Ponds are sparser than plants, so this usually kills first.',
    section: 'rabbitMetabolism',
    tier: 'immediate',
  },
  {
    key: 'maturityDays',
    label: 'maturity',
    min: 1,
    max: 12,
    step: 0.5,
    format: (v) => `${v}d`,
    tip: 'Age at which a rabbit can breed.',
    section: 'rabbitMetabolism',
    tier: 'structural',
  },
  {
    key: 'lifeMinDays',
    label: 'lifespan floor',
    min: 4,
    max: 40,
    step: 1,
    format: (v) => `${v}d`,
    tip: 'Shortest natural lifespan. Old age should be rare — if it dominates, the world is too easy.',
    section: 'rabbitMetabolism',
    tier: 'cosmetic',
  },
  {
    key: 'lifeMaxDays',
    label: 'lifespan ceiling',
    min: 6,
    max: 60,
    step: 1,
    format: (v) => `${v}d`,
    tip: 'Longest natural lifespan. Longer lives slow generational turnover.',
    section: 'rabbitMetabolism',
    tier: 'cosmetic',
  },

  // ---- rabbit starting genes ----
  {
    key: 'senseMin',
    label: 'sense min',
    min: 2,
    max: 15,
    step: 0.5,
    format: (v) => `${v}m`,
    tip: 'Lower bound of founding sensory radius. Blind outside this distance.',
    section: 'rabbitGenes',
    tier: 'structural',
  },
  {
    key: 'senseMax',
    label: 'sense max',
    min: 3,
    max: 15,
    step: 0.5,
    format: (v) => `${v}m`,
    tip: 'Upper bound. A wide spread gives selection more to work with.',
    section: 'rabbitGenes',
    tier: 'structural',
  },
  {
    key: 'speedMin',
    label: 'speed min',
    min: 0.5,
    max: 4,
    step: 0.1,
    format: (v) => `${v.toFixed(1)} m/s`,
    tip: 'Lower bound of founding speed.',
    section: 'rabbitGenes',
    tier: 'structural',
  },
  {
    key: 'speedMax',
    label: 'speed max',
    min: 0.8,
    max: 4.2,
    step: 0.1,
    format: (v) => `${v.toFixed(1)} m/s`,
    tip: 'Upper bound. Whether speed is worth its move cost is what the sim answers.',
    section: 'rabbitGenes',
    tier: 'structural',
  },
  {
    key: 'urgeMin',
    label: 'urge min',
    min: 0.12,
    max: 0.95,
    step: 0.01,
    format: (v) => v.toFixed(2),
    tip: 'Lower bound of founding reproductive urge. High urge outranks foraging in drive arbitration (§6.2).',
    section: 'rabbitGenes',
    tier: 'structural',
  },
  {
    key: 'urgeMax',
    label: 'urge max',
    min: 0.15,
    max: 0.95,
    step: 0.01,
    format: (v) => v.toFixed(2),
    tip: 'Upper bound. Under predation pressure this gene tends to climb.',
    section: 'rabbitGenes',
    tier: 'structural',
  },
  {
    key: 'gestMinDays',
    label: 'gestation min',
    min: 0.5,
    max: 8,
    step: 0.5,
    format: (v) => `${v}d`,
    tip: 'Founding gestation range, coupled to offspring maturity (§5.3): short gestation matures faster.',
    section: 'rabbitGenes',
    tier: 'structural',
  },
  {
    key: 'gestMaxDays',
    label: 'gestation max',
    min: 1,
    max: 10,
    step: 0.5,
    format: (v) => `${v}d`,
    tip: 'Upper bound of gestation range.',
    section: 'rabbitGenes',
    tier: 'structural',
  },
  {
    key: 'mutChance',
    label: 'mutation chance',
    min: 0,
    max: 0.6,
    step: 0.01,
    format: (v) => `${Math.round(v * 100)}%`,
    tip: 'Odds each inherited gene mutates on birth. Zero freezes the gene pool.',
    section: 'rabbitGenes',
    tier: 'structural',
  },
  {
    key: 'mutStep',
    label: 'mutation step',
    min: 0.01,
    max: 0.4,
    step: 0.01,
    format: (v) => `${Math.round(v * 100)}% of range`,
    tip: 'Size of a mutation when it occurs, as a fraction of that gene’s range.',
    section: 'rabbitGenes',
    tier: 'structural',
  },

  // ---- predator ----
  {
    key: 'predatorSpeed',
    label: 'speed',
    min: 1,
    max: 6,
    step: 0.1,
    format: (v) => `${v.toFixed(1)} m/s`,
    tip: 'The primary coexistence lever. Drop below evolved rabbit speed to make the chase survivable.',
    section: 'predator',
    tier: 'terminal',
  },
  {
    key: 'predatorSense',
    label: 'sense',
    min: 4,
    max: 22,
    step: 0.5,
    format: (v) => `${v.toFixed(1)} m`,
    tip: 'How far a predator detects rabbits. Rabbits flee any predator within their own sense radius.',
    section: 'predator',
    tier: 'immediate',
  },
  {
    key: 'predatorGain',
    label: 'hunger gain / kill',
    min: 0.1,
    max: 1,
    step: 0.02,
    format: (v) => v.toFixed(2),
    tip: 'Energy restored per kill, as a fraction of the energy pool. Lower forces constant hunting.',
    section: 'predator',
    tier: 'terminal',
  },
  {
    key: 'predatorBreedThreshold',
    label: 'breed threshold',
    min: 0.05,
    max: 0.6,
    step: 0.01,
    format: (v) => v.toFixed(2),
    tip: 'A well-fed predator breeds below this energy fraction. Lower slows the boom-bust cycle.',
    section: 'predator',
    tier: 'terminal',
  },

  // ---- shared (energy / cost) ----
  {
    key: 'moveCostK',
    label: 'move cost / speed²',
    min: 0.05,
    max: 0.8,
    step: 0.01,
    format: (v) => v.toFixed(2),
    tip: 'Energy drained per second scales with speed² × this — the superlinear cost (§5.2) that makes running expensive.',
    section: 'shared',
    tier: 'cosmetic',
  },
  {
    key: 'senseCostK',
    label: 'sense cost / m',
    min: 0,
    max: 0.2,
    step: 0.005,
    format: (v) => v.toFixed(3),
    tip: 'Energy drained per metre of sense radius per second. A wide sense range costs, it isn’t free.',
    section: 'shared',
    tier: 'cosmetic',
  },
  {
    key: 'idleCost',
    label: 'idle cost / s',
    min: 0,
    max: 0.6,
    step: 0.01,
    format: (v) => v.toFixed(2),
    tip: 'Energy drained per second even standing still — the floor cost of being alive.',
    section: 'shared',
    tier: 'cosmetic',
  },
  {
    key: 'energyMax',
    label: 'energy pool max',
    min: 60,
    max: 400,
    step: 10,
    tip: 'Size of the per-day energy pool (§5.1). Hits zero → collapse, independent of hunger/thirst.',
    section: 'shared',
    tier: 'cosmetic',
  },

  // ---- restart required (creation-time-only) ----
  {
    key: 'predatorStart',
    label: 'starting predators',
    min: 0,
    max: 12,
    step: 1,
    tip: 'How many predators exist at day 1 — irrelevant in Game Mode, where predators only ever arrive via RELEASE PREDATORS.',
    section: 'restart',
    tier: 'terminal',
  },
  {
    key: 'plants',
    label: 'plant count',
    min: 6,
    max: 140,
    step: 1,
    tip: 'How many plants exist as rabbit food — set once at world generation, unlike regrow delay above which applies live.',
    section: 'restart',
    tier: 'immediate',
  },

  // ---- performance (no gameplay cost, either mode) ----
  {
    key: 'capRabbits',
    label: 'rabbit cap',
    min: 20,
    max: 400,
    step: 10,
    tip: 'Hard ceiling on rabbits. A performance guard, not an ecological one.',
    section: 'performance',
    tier: 'free',
  },
  {
    key: 'capPredators',
    label: 'predator cap',
    min: 4,
    max: 120,
    step: 2,
    tip: 'Hard ceiling on predators.',
    section: 'performance',
    tier: 'free',
  },
];

export function fieldsInSection(section: TuningSection): TuningFieldDef[] {
  return TUNING_FIELDS.filter((f) => f.section === section);
}

export function getTuningField(key: keyof Tuning): TuningFieldDef | undefined {
  return TUNING_FIELDS.find((f) => f.key === key);
}

const COST_BASE: Record<Exclude<CostTier, 'free'>, number> = {
  immediate: 40,
  structural: 20,
  terminal: 60,
  cosmetic: 8,
};

/** EP cost to move a knob from `oldVal` to `newVal`, ported from the V1
 * prototype's per-tier formulas. `immediate` scales roughly with the
 * *square* of how far you move it (small nudges are cheap, big swings get
 * expensive fast); the rest scale linearly. Free Mode never calls this —
 * TuningPanel only reaches for it when a run is in Game Mode. */
export function computeKnobCost(field: TuningFieldDef, oldVal: number, newVal: number): number {
  if (field.tier === 'free') return 0;
  const span = field.max - field.min;
  if (span <= 0) return 0;
  const delta = Math.abs(newVal - oldVal);
  const fraction = delta / span;
  const base = COST_BASE[field.tier];
  switch (field.tier) {
    case 'immediate':
      return Math.round(base * fraction ** 2 * 100 + 2);
    case 'structural':
      return Math.round(base * fraction * 80 + 2);
    case 'terminal':
      return Math.round(base * fraction * 60 + base * 0.5);
    case 'cosmetic':
      return Math.round(base * fraction * 30 + 1);
  }
}
