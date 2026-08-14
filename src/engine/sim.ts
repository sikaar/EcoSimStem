import { createRng, type Rng } from './rng';
import { createDayState, advanceDayPhase, completeDraft, type DayState } from './day';
import { generateWorld, nearestOwnDen, nearestWaterPoint, type Point, type World } from './world';
import { makeRabbit, type Rabbit } from './entities/rabbit';
import { makePredator, type Predator } from './entities/predator';
import { spawnPlant, respawnPlant, type Plant } from './entities/plant';
import { SpatialHash, SPATIAL_HASH_CELL_SIZE, type SpatialEntry } from './systems/perception';
import { arbitrate, computeReturnUrgency, type DriveKind } from './systems/drives';
import { move, wanderTarget } from './systems/movement';
import {
  applyEnergyDrain,
  carriedSurplus,
  dawnEnergy,
  energyDrainPerSecond,
  refillEnergy,
} from './systems/energy';
import { accrueHunger, accrueThirst } from './systems/condition';
import {
  advanceGestation,
  attemptMate,
  birthLitter,
  canBreed,
  gestationComplete,
} from './systems/reproduction';
import { checkVitalDeathCause, emptyDeathTally, resolveFieldSurvival, trackGeneration, type DayReport, type DeathCause } from './systems/lifecycle';
import { breedPredator, canPredatorBreed, huntRabbit, isWithinKillRange } from './systems/predation';
import type { Tuning } from './types';

/**
 * The full step() orchestrator — ties world, entities, drives, movement,
 * energy, condition, reproduction, lifecycle, and predation together
 * through the day-phase machine. This is what a headless 20-day run
 * exercises for balance.test.ts's 4th invariant.
 *
 * Not in DEFAULT_TUNING and not re-specified for v2, so ported from the
 * prototype/derived directly here rather than invented from nothing:
 */
const RABBIT_START = 26; // prototype's resetSim() founding population
const MATE_CONTACT_RADIUS = 0.6; // prototype's d^2 < 0.36 mate-contact check
const GROWTH_MIN_FRACTION = 0.4; // prototype's clamp(age/maturity, .4, 1)
const FLEE_QUERY_PADDING = 1.2; // hash query radius; arbitrate() re-checks the exact sense*1.15 threshold

export interface SimState {
  world: World;
  tuning: Tuning;
  rng: Rng;
  day: DayState;
  rabbits: Rabbit[];
  predators: Predator[];
  plants: Plant[];
  maxGeneration: number;
  deathTally: Record<DeathCause, number>;
  bornToday: number;
  lastDayReport: DayReport | null;
  nextEntityId: number;
}

function nextId(sim: SimState): number {
  return sim.nextEntityId++;
}

export function createSim(seed: number, tuning: Tuning): SimState {
  const rng = createRng(seed);
  const world = generateWorld(rng, tuning);
  const sim: SimState = {
    world,
    tuning,
    rng,
    day: createDayState(1),
    rabbits: [],
    predators: [],
    plants: [],
    maxGeneration: 1,
    deathTally: emptyDeathTally(),
    bornToday: 0,
    lastDayReport: null,
    nextEntityId: 1,
  };

  for (let i = 0; i < tuning.plants; i++) {
    sim.plants.push(spawnPlant(nextId(sim), world, rng));
  }
  // Founders spawn at their den, same as every later dawn's "creatures
  // emerge from dens" (§4.2) — not at a fully random land point. A random
  // spawn routinely put a founder 20-30m from its nearest den, which made
  // returnUrgency's timeRatio climb early in day 1 and crowd out foraging
  // for the entire day before it had a chance to eat or drink even once.
  const rabbitDens = world.dens.filter((d) => d.species === 'rabbit');
  for (let i = 0; i < RABBIT_START; i++) {
    const p = spawnNearDen(sim, rabbitDens);
    sim.rabbits.push(makeRabbit({ id: nextId(sim), x: p.x, z: p.z, generation: 1, mature: true, rng, tuning }));
  }
  const predatorDens = world.dens.filter((d) => d.species === 'predator');
  for (let i = 0; i < tuning.predatorStart; i++) {
    const p = spawnNearDen(sim, predatorDens);
    sim.predators.push(makePredator({ id: nextId(sim), x: p.x, z: p.z, rng, tuning }));
  }

  return sim;
}

const FOUNDER_DEN_SCATTER = 2; // metres — keeps founders inside denRadius-ish of home

function spawnNearDen(sim: SimState, dens: readonly Point[]): Point {
  if (dens.length === 0) return { x: 0, z: 0 };
  const den = sim.rng.pick(dens);
  return {
    x: den.x + sim.rng.range(-FOUNDER_DEN_SCATTER, FOUNDER_DEN_SCATTER),
    z: den.z + sim.rng.range(-FOUNDER_DEN_SCATTER, FOUNDER_DEN_SCATTER),
  };
}

/** Advance the simulation by one fixed timestep. Mutates `sim` in place —
 * this is the one place births/deaths/day transitions actually happen, and
 * it's also the only place the RNG is consumed (§7). */
export function step(sim: SimState, dt: number): void {
  const nextDay = advanceDayPhase(sim.day, dt, sim.tuning);
  const phaseChanged = nextDay.phase !== sim.day.phase;
  sim.day = nextDay;

  if (sim.day.phase === 'forage' || sim.day.phase === 'dusk') {
    simulateRabbits(sim, dt);
    simulatePredators(sim, dt);
  }

  if (phaseChanged && sim.day.phase === 'resolve') {
    resolveDay(sim);
  } else if (phaseChanged && sim.day.phase === 'dawn') {
    startDay(sim);
  }
}

/** Headless convenience for balance testing and tuning tools: run until
 * `sim.day.day` reaches `targetDay`, auto-completing any `draft` phase
 * encountered along the way (cards aren't built yet — Phase 2). */
export function runUntilDay(sim: SimState, targetDay: number, dt = 1 / 60): void {
  const maxSteps = 5_000_000; // guards against a stalled phase graph, not a real budget
  let steps = 0;
  while (sim.day.day < targetDay && steps++ < maxSteps) {
    step(sim, dt);
    if (sim.day.phase === 'draft') sim.day = completeDraft(sim.day);
  }
}

function buildHash(entries: SpatialEntry[]): SpatialHash {
  const hash = new SpatialHash(SPATIAL_HASH_CELL_SIZE);
  hash.rebuild(entries);
  return hash;
}

function simulateRabbits(sim: SimState, dt: number): void {
  const { tuning, world, rng, day } = sim;
  const plantHash = buildHash(
    sim.plants.filter((p) => p.alive).map((p) => ({ id: p.id, x: p.x, z: p.z })),
  );
  const rabbitHash = buildHash(sim.rabbits.map((r) => ({ id: r.id, x: r.x, z: r.z })));
  const predatorHash = buildHash(sim.predators.map((p) => ({ id: p.id, x: p.x, z: p.z })));

  for (let i = sim.rabbits.length - 1; i >= 0; i--) {
    const rabbit = sim.rabbits[i]!;

    rabbit.hunger = accrueHunger(rabbit.hunger, tuning, dt);
    rabbit.thirst = accrueThirst(rabbit.thirst, tuning, dt);

    const vitalCause = checkVitalDeathCause({
      ageDays: rabbit.ageDays,
      lifespanDays: rabbit.lifespanDays,
      energy: rabbit.energy,
      hunger: rabbit.hunger,
      thirst: rabbit.thirst,
    });
    if (vitalCause) {
      sim.rabbits.splice(i, 1);
      sim.deathTally[vitalCause]++;
      continue;
    }

    const sense = rabbit.genes.sense;
    const den = nearestOwnDen(rabbit, world.dens, 'rabbit');
    const distHome = den ? Math.hypot(den.x - rabbit.x, den.z - rabbit.z) : 0;
    const returnUrgency = computeReturnUrgency({
      distHome,
      speed: rabbit.genes.speed,
      energy: rabbit.energy,
      secondsUntilNightfall: secondsUntilNightfallFor(day, tuning),
      tuning,
    });

    const nearestPredatorEntry = nearestInHash(predatorHash, rabbit, sense * FLEE_QUERY_PADDING);
    const ready = canBreed(rabbit);

    const findTarget = (kind: DriveKind): Point | null => {
      if (kind === 'water') return nearestWaterPoint(world, rabbit.x, rabbit.z, sense);
      if (kind === 'food') return nearestInHash(plantHash, rabbit, sense);
      if (kind === 'mate') return nearestMate(rabbitHash, sim.rabbits, rabbit, sense);
      return den; // 'return' — always known, sense-independent
    };

    const decision = arbitrate({
      selfPos: rabbit,
      sense,
      thirst: rabbit.thirst,
      hunger: rabbit.hunger,
      canBreed: ready,
      urge: rabbit.genes.urge,
      returnUrgency,
      nearestPredator: nearestPredatorEntry,
      findTarget,
    });

    const grown = clamp(rabbit.ageDays / Math.max(rabbit.maturityDays, 0.001), GROWTH_MIN_FRACTION, 1);
    let targetX: number;
    let targetZ: number;
    let speedMultiplier = 1;
    if (decision.action === 'flee') {
      targetX = rabbit.x * 2 - decision.from.x;
      targetZ = rabbit.z * 2 - decision.from.z;
      speedMultiplier = 1.35;
    } else if (decision.action === 'commit') {
      targetX = decision.target.x;
      targetZ = decision.target.z;
    } else {
      const w = wanderTarget(world, rabbit, rabbit.dir, 3);
      targetX = w.x;
      targetZ = w.z;
    }

    const speed = rabbit.genes.speed * grown * speedMultiplier;
    const result = move(world, rabbit, targetX, targetZ, speed, dt);
    rabbit.x = result.x;
    rabbit.z = result.z;
    rabbit.vx = result.vx;
    rabbit.vz = result.vz;
    rabbit.dir = result.dir;

    const drain = energyDrainPerSecond(tuning, speed, sense, result.moved);
    rabbit.energy = applyEnergyDrain(rabbit.energy, drain, dt);

    if (decision.action === 'commit') {
      const d2 = (decision.target.x - rabbit.x) ** 2 + (decision.target.z - rabbit.z) ** 2;
      if (decision.kind === 'water' && d2 < tuning.drinkRadius ** 2) {
        rabbit.thirst = 0;
      } else if (decision.kind === 'food' && d2 < tuning.eatRadius ** 2) {
        const plant = sim.plants.find((p) => p.alive && p.x === decision.target.x && p.z === decision.target.z);
        if (plant) {
          plant.alive = false;
          plant.respawnDaysLeft = tuning.regrowDays;
          rabbit.hunger = 0;
          rabbit.energy = refillEnergy(rabbit.energy, tuning);
        }
      } else if (decision.kind === 'mate' && d2 < MATE_CONTACT_RADIUS ** 2) {
        // Re-query by id at contact time rather than matching the drive
        // target's snapshot coordinates — the partner may have moved
        // earlier in this same tick's loop.
        const partner = nearestMate(rabbitHash, sim.rabbits, rabbit, MATE_CONTACT_RADIUS);
        if (partner) {
          const [male, female] = rabbit.male ? [rabbit, partner] : [partner, rabbit];
          const outcome = attemptMate(male, female, rng);
          Object.assign(male, outcome.male);
          Object.assign(female, outcome.female);
        }
      }
    }
  }
}

function simulatePredators(sim: SimState, dt: number): void {
  const { tuning, world, rng, day } = sim;
  const rabbitHash = buildHash(sim.rabbits.map((r) => ({ id: r.id, x: r.x, z: r.z })));

  for (let i = sim.predators.length - 1; i >= 0; i--) {
    const predator = sim.predators[i]!;

    predator.hunger = accrueHunger(predator.hunger, tuning, dt);

    const vitalCause = checkVitalDeathCause({
      ageDays: predator.ageDays,
      lifespanDays: predator.lifespanDays,
      energy: predator.energy,
      hunger: predator.hunger,
    });
    if (vitalCause) {
      sim.predators.splice(i, 1);
      sim.deathTally[vitalCause]++;
      continue;
    }

    const den = nearestOwnDen(predator, world.dens, 'predator');
    const distHome = den ? Math.hypot(den.x - predator.x, den.z - predator.z) : 0;
    const returnUrgency = computeReturnUrgency({
      distHome,
      speed: tuning.predatorSpeed,
      energy: predator.energy,
      secondsUntilNightfall: secondsUntilNightfallFor(day, tuning),
      tuning,
    });

    const prey = nearestInHash(rabbitHash, predator, tuning.predatorSense);
    let targetX: number;
    let targetZ: number;
    if (returnUrgency >= 1 && den) {
      targetX = den.x;
      targetZ = den.z;
    } else if (prey) {
      targetX = prey.x;
      targetZ = prey.z;
    } else {
      const w = wanderTarget(world, predator, predator.dir, 4);
      targetX = w.x;
      targetZ = w.z;
    }

    const result = move(world, predator, targetX, targetZ, tuning.predatorSpeed, dt);
    predator.x = result.x;
    predator.z = result.z;
    predator.vx = result.vx;
    predator.vz = result.vz;
    predator.dir = result.dir;

    const drain = energyDrainPerSecond(tuning, tuning.predatorSpeed, tuning.predatorSense, result.moved);
    predator.energy = applyEnergyDrain(predator.energy, drain, dt);

    if (prey && isWithinKillRange(predator, prey)) {
      const victimIndex = sim.rabbits.findIndex((r) => r.id === prey.id);
      if (victimIndex >= 0) {
        sim.rabbits.splice(victimIndex, 1);
        sim.deathTally.predation++;
        const hunt = huntRabbit(predator, prey, tuning);
        Object.assign(predator, hunt.predator);
      }
    }

    if (canPredatorBreed(predator, tuning) && sim.predators.length < tuning.capPredators) {
      const bred = breedPredator(predator, () => nextId(sim), rng, tuning);
      Object.assign(predator, bred.parent);
      sim.predators.push(bred.child);
    }
  }
}

function resolveDay(sim: SimState): void {
  const { tuning, world } = sim;

  for (let i = sim.rabbits.length - 1; i >= 0; i--) {
    const rabbit = sim.rabbits[i]!;
    const result = resolveFieldSurvival(rabbit, 'rabbit', world.dens, tuning.denRadius);
    if (!result.survived) {
      sim.rabbits.splice(i, 1);
      sim.deathTally.exposure++;
    }
  }
  for (let i = sim.predators.length - 1; i >= 0; i--) {
    const predator = sim.predators[i]!;
    const result = resolveFieldSurvival(predator, 'predator', world.dens, tuning.denRadius);
    if (!result.survived) {
      sim.predators.splice(i, 1);
      sim.deathTally.exposure++;
    }
  }

  sim.lastDayReport = {
    day: sim.day.day,
    born: sim.bornToday,
    survived: sim.rabbits.length + sim.predators.length,
    deaths: sim.deathTally,
  };
  sim.deathTally = emptyDeathTally();
  sim.bornToday = 0;
}

function startDay(sim: SimState): void {
  const { tuning, rng } = sim;

  // Hunger/thirst already accrued continuously through yesterday's
  // forage/dusk (see accrueHunger/accrueThirst in simulateRabbits) — dawn
  // just reads where they landed to throttle today's energy pool.
  for (const rabbit of sim.rabbits) {
    rabbit.ageDays += 1;
    rabbit.cooldownDays = Math.max(0, rabbit.cooldownDays - 1);
    const surplus = carriedSurplus(tuning, rabbit.energy);
    rabbit.energy = dawnEnergy(tuning, rabbit.hunger, rabbit.thirst, surplus);
    if (rabbit.pregnantDaysLeft > 0) rabbit.pregnantDaysLeft = advanceGestation(rabbit.pregnantDaysLeft);
  }
  for (const predator of sim.predators) {
    predator.ageDays += 1;
    predator.cooldownDays = Math.max(0, predator.cooldownDays - 1);
    const surplus = carriedSurplus(tuning, predator.energy);
    predator.energy = dawnEnergy(tuning, predator.hunger, 0, surplus);
  }

  // Overnight deaths — condition/age crossing the cap between yesterday's
  // resolve and this dawn's increment.
  for (let i = sim.rabbits.length - 1; i >= 0; i--) {
    const rabbit = sim.rabbits[i]!;
    const cause = checkVitalDeathCause({
      ageDays: rabbit.ageDays,
      lifespanDays: rabbit.lifespanDays,
      energy: rabbit.energy,
      hunger: rabbit.hunger,
      thirst: rabbit.thirst,
    });
    if (cause) {
      sim.rabbits.splice(i, 1);
      sim.deathTally[cause]++;
    }
  }
  for (let i = sim.predators.length - 1; i >= 0; i--) {
    const predator = sim.predators[i]!;
    const cause = checkVitalDeathCause({
      ageDays: predator.ageDays,
      lifespanDays: predator.lifespanDays,
      energy: predator.energy,
      hunger: predator.hunger,
    });
    if (cause) {
      sim.predators.splice(i, 1);
      sim.deathTally[cause]++;
    }
  }

  // Births — at dawn, in the den (§6.4), respecting the population cap.
  for (const mother of sim.rabbits) {
    if (!gestationComplete(mother) || !mother.carryGenes) continue;
    if (sim.rabbits.length >= tuning.capRabbits) continue;
    const litter = birthLitter({ mother, fatherGenes: mother.carryGenes, nextId: () => nextId(sim), rng, tuning });
    mother.carryGenes = null;
    for (const kit of litter) {
      if (sim.rabbits.length >= tuning.capRabbits) break;
      sim.rabbits.push(kit);
      sim.bornToday++;
      sim.maxGeneration = trackGeneration(sim.maxGeneration, kit.generation);
    }
  }

  // Plants regrow on a day timer, relocating on revival (§entities/plant.ts).
  for (const plant of sim.plants) {
    if (plant.alive) continue;
    plant.respawnDaysLeft -= 1;
    if (plant.respawnDaysLeft <= 0) respawnPlant(plant, sim.world, rng);
  }
}

function secondsUntilNightfallFor(day: DayState, tuning: Pick<Tuning, 'dayLengthSec' | 'duskLengthSec'>): number {
  if (day.phase === 'forage') return Math.max(0, tuning.dayLengthSec - day.phaseElapsed) + tuning.duskLengthSec;
  if (day.phase === 'dusk') return Math.max(0, tuning.duskLengthSec - day.phaseElapsed);
  return tuning.dayLengthSec + tuning.duskLengthSec;
}

function nearestInHash(hash: SpatialHash, pos: Point, radius: number): SpatialEntry | null {
  let best: SpatialEntry | null = null;
  let bestD = radius * radius;
  for (const entry of hash.queryRadius(pos.x, pos.z, radius)) {
    const d = (entry.x - pos.x) ** 2 + (entry.z - pos.z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = entry;
    }
  }
  return best;
}

function nearestMate(hash: SpatialHash, rabbits: readonly Rabbit[], self: Rabbit, sense: number): Rabbit | null {
  let best: Rabbit | null = null;
  let bestD = sense * sense;
  for (const entry of hash.queryRadius(self.x, self.z, sense)) {
    if (entry.id === self.id) continue;
    const candidate = rabbits.find((r) => r.id === entry.id);
    if (!candidate || candidate.male === self.male || !canBreed(candidate)) continue;
    const d = (candidate.x - self.x) ** 2 + (candidate.z - self.z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = candidate;
    }
  }
  return best;
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
