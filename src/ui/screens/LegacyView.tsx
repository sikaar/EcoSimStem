import { BackToMenuButton } from '../components/BackToMenuButton';

/**
 * Hosts the original V1 prototype — a single self-contained HTML file,
 * `public/legacy.html` — inside an iframe rather than mounting its markup
 * into this document.
 *
 * The iframe boundary is deliberate, not a shortcut. V1 owns its own
 * global animation loop, its own three.js import, and its own DOM/canvas —
 * exactly the same kind of state this app's GameView already owns for the
 * rebuild. Loading V1's script into the same document would race both
 * loops against each other and risk global-scope collisions (both are
 * plausibly named things like `scene`, `camera`, `step`). An iframe gives
 * V1 its own window, its own globals, and its own render loop, so the two
 * genuinely cannot interfere — which matters here specifically because the
 * whole point of this screen is a faithful, unmodified baseline to
 * compare the rebuild against.
 *
 * Vite serves everything under `public/` verbatim at the site root and
 * copies it into `dist/` unchanged on build, so `public/legacy.html` needs
 * no build step of its own — dropping a new file at that path is the
 * entire "install" step for a new V1 build.
 */
export interface LegacyViewProps {
  onMainMenu: () => void;
}

export function LegacyView({ onMainMenu }: LegacyViewProps) {
  return (
    <main style={{ position: 'relative', height: '100%' }}>
      <iframe
        src="/legacy.html"
        title="Ecosystem — V1 (legacy)"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
      />
      <BackToMenuButton onClick={onMainMenu} />
    </main>
  );
}
