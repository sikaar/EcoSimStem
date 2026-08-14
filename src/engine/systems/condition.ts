import type { Tuning } from '../types';

/**
 * Condition — hunger and thirst, persistent across days (renamed from
 * "metabolism"). Unchanged in role from the prototype but now day-scaled
 * (§6.5): they rise once per day rather than continuously, eating/drinking
 * still zeroes them, and reaching the 0..1 cap still kills — starvation and
 * dehydration are distinct death causes (§8.2) — but at day-scaled rates it
 * now takes multiple bad days instead of one bad forage (§5.5 invariant 3).
 * Short of that cap, condition also throttles tomorrow's dawn energy
 * (energy.ts) rather than acting directly on today's pool.
 */

export function applyDailyHunger(hunger: number, tuning: Pick<Tuning, 'hungerPerDay'>): number {
  return hunger + tuning.hungerPerDay;
}

export function applyDailyThirst(thirst: number, tuning: Pick<Tuning, 'thirstPerDay'>): number {
  return thirst + tuning.thirstPerDay;
}

export function isStarved(hunger: number): boolean {
  return hunger >= 1;
}

export function isDehydrated(thirst: number): boolean {
  return thirst >= 1;
}
