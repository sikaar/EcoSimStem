import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/rng';
import { DEFAULT_TUNING } from '../src/config/tuning';
import { makeRabbit } from '../src/engine/entities/rabbit';
import {
  advanceGestation,
  attemptMate,
  birthLitter,
  canBreed,
  gestationComplete,
} from '../src/engine/systems/reproduction';

function adult(overrides: Partial<Parameters<typeof makeRabbit>[0]> = {}) {
  return makeRabbit({ id: 1, x: 0, z: 0, generation: 1, mature: true, rng: createRng(1), tuning: DEFAULT_TUNING, ...overrides });
}

describe('canBreed', () => {
  it('requires maturity, no active pregnancy, and no cooldown', () => {
    const base = { ageDays: 10, maturityDays: 4, pregnantDaysLeft: 0, cooldownDays: 0 };
    expect(canBreed(base)).toBe(true);
    expect(canBreed({ ...base, ageDays: 2 })).toBe(false);
    expect(canBreed({ ...base, pregnantDaysLeft: 1 })).toBe(false);
    expect(canBreed({ ...base, cooldownDays: 1 })).toBe(false);
  });
});

describe('attemptMate', () => {
  it('refuses outright if the female is already pregnant or cooling down', () => {
    const male = adult({ id: 1 });
    const pregnantFemale = adult({ id: 2 });
    pregnantFemale.pregnantDaysLeft = 2;
    const result = attemptMate(male, pregnantFemale, createRng(1));
    expect(result.accepted).toBe(false);
    expect(result.female).toBe(pregnantFemale); // untouched
  });

  it('rolls acceptance from the male des gene and sets day-scaled cooldowns on success', () => {
    const male = adult({ id: 1 });
    male.genes = { ...male.genes, des: 1 }; // acceptance prob = 0.25 + 1*0.7 = 0.95
    const female = adult({ id: 2 });
    const rng = createRng(42);
    let accepted = false;
    let result;
    for (let i = 0; i < 20 && !accepted; i++) {
      result = attemptMate(male, female, rng);
      accepted = result.accepted;
    }
    expect(accepted).toBe(true);
    expect(result!.female.pregnantDaysLeft).toBe(female.genes.gest);
    expect(result!.female.carryGenes).toEqual(male.genes);
    expect(result!.female.cooldownDays).toBe(female.genes.gest + 5);
    expect(result!.male.cooldownDays).toBe(3);
  });

  it('never mutates the inputs — pure function', () => {
    const male = adult({ id: 1 });
    male.genes = { ...male.genes, des: 1 };
    const female = adult({ id: 2 });
    const femaleBefore = { ...female };
    attemptMate(male, female, createRng(7));
    expect(female).toEqual(femaleBefore);
  });
});

describe('gestation', () => {
  it('advances by one day per call and floors at zero', () => {
    expect(advanceGestation(2)).toBe(1);
    expect(advanceGestation(1)).toBe(0);
    expect(advanceGestation(0)).toBe(0);
  });

  it('is complete once days reach zero and carried genes are present', () => {
    expect(gestationComplete({ pregnantDaysLeft: 0, carryGenes: { sense: 1, speed: 1, urge: 1, gest: 1, des: 1 } })).toBe(true);
    expect(gestationComplete({ pregnantDaysLeft: 1, carryGenes: { sense: 1, speed: 1, urge: 1, gest: 1, des: 1 } })).toBe(false);
    expect(gestationComplete({ pregnantDaysLeft: 0, carryGenes: null })).toBe(false);
  });
});

describe('birthLitter (§5.3, §0.3 item 3)', () => {
  it('gives short gestation more, weaker (later-maturing... no, earlier) kits than long gestation', () => {
    const rng = createRng(3);
    const mother = adult({ id: 1 });
    mother.genes = { ...mother.genes, gest: DEFAULT_TUNING.gestMinDays };
    const father = adult({ id: 2 }).genes;
    let idCounter = 100;
    const shortGestKits = birthLitter({ mother, fatherGenes: father, nextId: () => idCounter++, rng, tuning: DEFAULT_TUNING });

    mother.genes = { ...mother.genes, gest: DEFAULT_TUNING.gestMaxDays };
    const longGestKits = birthLitter({ mother, fatherGenes: father, nextId: () => idCounter++, rng, tuning: DEFAULT_TUNING });

    expect(shortGestKits.length).toBeGreaterThan(longGestKits.length);
  });

  it('spawns kits at the den (mother position), not mid-field, and each is a newborn', () => {
    const rng = createRng(5);
    const mother = adult({ id: 1, x: 3, z: -4 });
    mother.genes = { ...mother.genes, gest: DEFAULT_TUNING.gestMinDays };
    const father = adult({ id: 2 }).genes;
    let idCounter = 0;
    const kits = birthLitter({ mother, fatherGenes: father, nextId: () => idCounter++, rng, tuning: DEFAULT_TUNING });
    for (const kit of kits) {
      expect(kit.x).toBe(3);
      expect(kit.z).toBe(-4);
      expect(kit.ageDays).toBe(0);
      expect(kit.generation).toBe(mother.generation + 1);
    }
  });

  it('applies the gestation-to-maturity coupling to each kit individually', () => {
    const rng = createRng(9);
    const mother = adult({ id: 1 });
    mother.genes = { ...mother.genes, gest: DEFAULT_TUNING.gestMinDays };
    const father = adult({ id: 2 }).genes;
    let idCounter = 0;
    const kits = birthLitter({ mother, fatherGenes: father, nextId: () => idCounter++, rng, tuning: DEFAULT_TUNING });
    for (const kit of kits) {
      expect(kit.maturityDays).toBeCloseTo(kit.genes.gest * 1.6 + DEFAULT_TUNING.maturityDays * 0.5);
    }
  });
});
