import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from '../src/config/tuning';
import {
  applyEnergyDrain,
  carriedSurplus,
  costPerMetre,
  dawnEnergy,
  energyDrainPerSecond,
  hasCollapsed,
  refillEnergy,
} from '../src/engine/systems/energy';

describe('energyDrainPerSecond — superlinear movement cost (§6.5)', () => {
  it('matches the §5.4 derivation at speed 2 / sense 8', () => {
    const drain = energyDrainPerSecond(DEFAULT_TUNING, 2, 8, true);
    expect(drain).toBeCloseTo(0.33 * 4 + 0.04 * 8 + 0.15, 5);
    expect(drain).toBeCloseTo(1.79, 2);
  });

  it('matches the §5.4 derivation at speed 3 / sense 8', () => {
    const drain = energyDrainPerSecond(DEFAULT_TUNING, 3, 8, true);
    expect(drain).toBeCloseTo(0.33 * 9 + 0.04 * 8 + 0.15, 5);
    expect(drain).toBeCloseTo(3.44, 2);
  });

  it('quadruples the movement component when speed doubles, isolated from the flat sense/idle terms', () => {
    const isolated = { moveCostK: DEFAULT_TUNING.moveCostK, senseCostK: 0, idleCost: 0 };
    const atSpeed1 = energyDrainPerSecond(isolated, 1, 0, true);
    const atSpeed2 = energyDrainPerSecond(isolated, 2, 0, true);
    expect(atSpeed2 / atSpeed1).toBeCloseTo(4, 5);
  });

  it('drops the movement term entirely when not moving, keeping sense/idle', () => {
    const moving = energyDrainPerSecond(DEFAULT_TUNING, 3, 8, true);
    const idle = energyDrainPerSecond(DEFAULT_TUNING, 3, 8, false);
    expect(idle).toBeCloseTo(DEFAULT_TUNING.senseCostK * 8 + DEFAULT_TUNING.idleCost, 5);
    expect(idle).toBeLessThan(moving);
  });
});

describe('dawnEnergy — condition throttles tomorrow, not today (§6.5)', () => {
  it('equals energyMax with zero condition and zero carryover', () => {
    expect(dawnEnergy(DEFAULT_TUNING, 0, 0, 0)).toBe(DEFAULT_TUNING.energyMax);
  });

  it('is reduced by the worse of hunger/thirst, not their sum', () => {
    const hungryOnly = dawnEnergy(DEFAULT_TUNING, 0.8, 0, 0);
    const bothBad = dawnEnergy(DEFAULT_TUNING, 0.8, 0.8, 0);
    expect(hungryOnly).toBe(bothBad);
    expect(hungryOnly).toBeLessThan(DEFAULT_TUNING.energyMax);
  });

  it('adds carried surplus on top', () => {
    expect(dawnEnergy(DEFAULT_TUNING, 0, 0, 10)).toBe(DEFAULT_TUNING.energyMax + 10);
  });
});

describe('carriedSurplus', () => {
  it('carries the configured fraction of a positive surplus', () => {
    expect(carriedSurplus(DEFAULT_TUNING, 40)).toBeCloseTo(40 * DEFAULT_TUNING.energyCarryover);
  });

  it('never carries a negative amount', () => {
    expect(carriedSurplus(DEFAULT_TUNING, -20)).toBe(0);
  });
});

describe('refillEnergy / applyEnergyDrain / hasCollapsed', () => {
  it('refill clamps at energyMax', () => {
    expect(refillEnergy(DEFAULT_TUNING.energyMax - 5, DEFAULT_TUNING)).toBe(DEFAULT_TUNING.energyMax);
  });

  it('drain never goes negative', () => {
    expect(applyEnergyDrain(1, 100, 1)).toBe(0);
  });

  it('collapse triggers only at zero or below', () => {
    expect(hasCollapsed(0)).toBe(true);
    expect(hasCollapsed(0.01)).toBe(false);
  });
});

describe('costPerMetre', () => {
  it('is linear in speed (derived from the speed^2 drain / speed travel time)', () => {
    const at1 = costPerMetre(DEFAULT_TUNING, 1);
    const at2 = costPerMetre(DEFAULT_TUNING, 2);
    expect(at2 / at1).toBeCloseTo(2, 5);
  });
});
