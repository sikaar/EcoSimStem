import { useState } from 'react';
import { liveTuning } from '../store/liveTuning';
import type { SaveV1 } from '../store/persistence';
import type { GameMode } from '../store/gameStore';
import { StartMenu } from './screens/StartMenu';
import { GameView } from './screens/GameView';

type Screen = { kind: 'start' } | { kind: 'playing'; seed: number; mode: GameMode; resumeDay?: number };

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'start' });

  if (screen.kind === 'start') {
    return (
      <StartMenu
        onNewRun={(mode: GameMode) => setScreen({ kind: 'playing', seed: Math.floor(Math.random() * 1e9), mode })}
        onResume={(save: SaveV1) => {
          // tuningDelta is deltas-from-defaults only (§12) — liveTuning
          // already starts at defaults, so layering the delta on top
          // reconstructs the exact tuning the saved run was using.
          Object.assign(liveTuning, save.tuningDelta);
          setScreen({ kind: 'playing', seed: save.seed, mode: save.mode ?? 'free', resumeDay: save.day });
        }}
      />
    );
  }

  return <GameView seed={screen.seed} mode={screen.mode} resumeDay={screen.resumeDay} onMainMenu={() => setScreen({ kind: 'start' })} />;
}
