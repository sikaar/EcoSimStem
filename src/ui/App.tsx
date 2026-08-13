import { DEFAULT_TUNING } from '../config/tuning';

/**
 * Scaffold placeholder. The real shell (canvas + panels reading from
 * simStore/gameStore/uiStore) lands once the engine and render layers exist
 * (handover §4.1, §10.1).
 */
export function App() {
  return (
    <main style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
      <div style={{ fontFamily: 'var(--mono)', color: 'var(--dim)', textAlign: 'center' }}>
        <p style={{ color: 'var(--text)', fontSize: 18 }}>Ecosystem — scaffold</p>
        <p>day length: {DEFAULT_TUNING.dayLengthSec}s · engine not yet wired up</p>
      </div>
    </main>
  );
}
