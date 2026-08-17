import { describe, expect, it } from 'vitest';
import { createRng } from '../src/engine/rng';
import { DEFAULT_TUNING } from '../src/config/tuning';
import { TUNING_FIELDS } from '../src/config/tuningFields';
import { DRAFT_DECK, applyDraftCard, drawDraftHand } from '../src/config/draftCards';
import type { Tuning } from '../src/engine/types';

describe('draft deck', () => {
  it('only touches knobs that exist and are published in TUNING_FIELDS', () => {
    // Both halves matter: a typo'd key would silently add a junk property
    // to Tuning at runtime, and a key with no published range would skip
    // the clamp in applyDraftCard and could walk a value out of the model.
    const known = new Set(TUNING_FIELDS.map((f) => f.key));
    for (const card of DRAFT_DECK) {
      const keys = Object.keys(card.delta) as Array<keyof Tuning>;
      expect(keys.length, `${card.id} has no effect`).toBeGreaterThan(0);
      for (const key of keys) {
        expect(key in DEFAULT_TUNING, `${card.id} touches unknown field ${key}`).toBe(true);
        expect(known.has(key), `${card.id} touches unpublished field ${key}`).toBe(true);
      }
    }
  });

  it('gives every card at least one cost as well as one benefit', () => {
    // The deck's design rule (see draftCards.ts): a draft of straight
    // upgrades is a slower "win" button. Every card must move at least two
    // knobs, so there is something to weigh.
    for (const card of DRAFT_DECK) {
      expect(Object.keys(card.delta).length, `${card.id} is a pure gift`).toBeGreaterThanOrEqual(2);
    }
  });

  it('has unique ids', () => {
    expect(new Set(DRAFT_DECK.map((c) => c.id)).size).toBe(DRAFT_DECK.length);
  });
});

describe('applyDraftCard', () => {
  it('applies deltas additively without mutating the input', () => {
    const card = { id: 't', title: 't', description: 't', delta: { plants: 10 } };
    const next = applyDraftCard(DEFAULT_TUNING, card);
    expect(next.plants).toBe(DEFAULT_TUNING.plants + 10);
    expect(DEFAULT_TUNING.plants).not.toBe(next.plants);
  });

  it('clamps to the knob range, so drafting the same card repeatedly settles at the edge', () => {
    const field = TUNING_FIELDS.find((f) => f.key === 'plants')!;
    const card = { id: 't', title: 't', description: 't', delta: { plants: 1000 } };
    let tuning = DEFAULT_TUNING;
    for (let i = 0; i < 5; i++) tuning = applyDraftCard(tuning, card);
    expect(tuning.plants).toBe(field.max);
  });

  it('keeps every deck card inside every knob range even when drafted repeatedly', () => {
    const ranges = new Map(TUNING_FIELDS.map((f) => [f.key, f] as const));
    for (const card of DRAFT_DECK) {
      let tuning = DEFAULT_TUNING;
      for (let i = 0; i < 10; i++) tuning = applyDraftCard(tuning, card);
      for (const key of Object.keys(card.delta) as Array<keyof Tuning>) {
        const range = ranges.get(key)!;
        expect(tuning[key], `${card.id} drove ${key} to ${tuning[key]}`).toBeGreaterThanOrEqual(range.min);
        expect(tuning[key], `${card.id} drove ${key} to ${tuning[key]}`).toBeLessThanOrEqual(range.max);
      }
    }
  });
});

describe('drawDraftHand', () => {
  it('draws distinct cards', () => {
    const hand = drawDraftHand(createRng(7));
    expect(hand).toHaveLength(3);
    expect(new Set(hand.map((c) => c.id)).size).toBe(3);
  });

  it('is deterministic for a given seed', () => {
    expect(drawDraftHand(createRng(99)).map((c) => c.id)).toEqual(drawDraftHand(createRng(99)).map((c) => c.id));
  });

  it('never returns more cards than the deck holds', () => {
    const deck = DRAFT_DECK.slice(0, 2);
    expect(drawDraftHand(createRng(1), 5, deck)).toHaveLength(2);
  });
});
