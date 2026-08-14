import type { Tuning } from '../types';

/**
 * Condition — hunger and thirst, persistent across days (renamed from
 * "metabolism"). Unchanged in role from the prototype but now day-scaled
 * (§6.5): a fully-unfed day adds hungerPerDay total, not per second — but
 * that total accrues continuously *through* the day (accrueHunger/
 * accrueThirst), not as one lump added at dawn. A flat once-a-day jump
 * leaves hunger constant all through forage, which starves the food/water
 * drives of urgency and removes the mid-day refuel loop entirely — the
 * derivation in §5.4 assumes creatures actually stop to eat/drink during
 * the day, and that only happens if hunger/thirst are visibly rising while
 * forage is in progress.
 *
 * Eating/drinking still zeroes them, and reaching the 0..1 cap still kills
 * — starvation and dehydration are distinct death causes (§8.2) — but at
 * day-scaled rates it now takes multiple bad days instead of one bad
 * forage (§5.5 invariant 3). Short of that cap, condition also throttles
 * tomorrow's dawn energy (energy.ts) rather than acting directly on
 * today's pool.
 */

/** Continuous per-tick accrual: `dayLengthSec` of unfed forage time adds
 * exactly `hungerPerDay` total, matching the daily-rate derivation while
 * actually varying during the day. */
export function accrueHunger(
  hunger: number,
  tuning: Pick<Tuning, 'hungerPerDay' | 'dayLengthSec'>,
  dt: number,
): number {
  return hunger + (tuning.hungerPerDay / tuning.dayLengthSec) * dt;
}

export function accrueThirst(
  thirst: number,
  tuning: Pick<Tuning, 'thirstPerDay' | 'dayLengthSec'>,
  dt: number,
): number {
  return thirst + (tuning.thirstPerDay / tuning.dayLengthSec) * dt;
}

/** Whole-day lump increment — useful for analytic/balance checks and for
 * any entity that isn't simulated tick-by-tick, not for the live forage
 * loop (see accrueHunger/accrueThirst above). */
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
