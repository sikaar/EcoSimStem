import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TUNING } from '../src/config/tuning';
import { clearSave, loadSave, saveRun } from '../src/store/persistence';

// Node's test environment has no localStorage — a minimal in-memory stand-in
// is enough to exercise the real save/load code paths.
function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    get length() {
      return data.size;
    },
  } as Storage;
}

describe('persistence (§12)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when nothing has been saved', () => {
    expect(loadSave()).toBeNull();
  });

  it('round-trips seed, day, and savedAt', () => {
    saveRun(12345, DEFAULT_TUNING, 7, 'free');
    const save = loadSave();
    expect(save).not.toBeNull();
    expect(save!.version).toBe(1);
    expect(save!.seed).toBe(12345);
    expect(save!.day).toBe(7);
    expect(save!.savedAt).toBeGreaterThan(0);
  });

  it('stores only the tuning delta from defaults, not the full tuning object', () => {
    saveRun(1, DEFAULT_TUNING, 1, 'free');
    const unchanged = loadSave();
    expect(unchanged!.tuningDelta).toEqual({});

    const modified = { ...DEFAULT_TUNING, predatorSpeed: 4.2, energyMax: 350 };
    saveRun(1, modified, 3, 'free');
    const changed = loadSave();
    expect(changed!.tuningDelta).toEqual({ predatorSpeed: 4.2, energyMax: 350 });
  });

  it('clearSave removes the entry', () => {
    saveRun(1, DEFAULT_TUNING, 1, 'free');
    expect(loadSave()).not.toBeNull();
    clearSave();
    expect(loadSave()).toBeNull();
  });

  it('a later save overwrites an earlier one', () => {
    saveRun(1, DEFAULT_TUNING, 1, 'free');
    saveRun(2, DEFAULT_TUNING, 5, 'free');
    const save = loadSave();
    expect(save!.seed).toBe(2);
    expect(save!.day).toBe(5);
  });

  it('round-trips the game mode', () => {
    saveRun(1, DEFAULT_TUNING, 1, 'game');
    expect(loadSave()!.mode).toBe('game');
  });

  it('accepts a save written before Game Mode existed (mode absent)', () => {
    localStorage.setItem('ecosystem_save_v1', JSON.stringify({ version: 1, seed: 1, day: 1, tuningDelta: {}, savedAt: 1 }));
    const save = loadSave();
    expect(save).not.toBeNull();
    expect(save!.mode).toBeUndefined();
  });

  it('rejects malformed data instead of returning it as-is', () => {
    localStorage.setItem('ecosystem_save_v1', JSON.stringify({ version: 1, seed: 'not-a-number' }));
    expect(loadSave()).toBeNull();

    localStorage.setItem('ecosystem_save_v1', 'not even json');
    expect(loadSave()).toBeNull();

    localStorage.setItem('ecosystem_save_v1', JSON.stringify({ version: 2, seed: 1, day: 1, tuningDelta: {}, savedAt: 1 }));
    expect(loadSave()).toBeNull();
  });
});
