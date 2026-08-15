/**
 * Ported from V1's "about" overlay — the one piece of narrative framing
 * that isn't gameplay: a tribute, not an original idea. Pure UI, no store
 * or engine dependency, so it's just an open/onClose pair rather than
 * global state — both StartMenu and TuningPanel mount their own instance.
 *
 * `position: fixed` rather than `absolute` deliberately — TuningPanel's
 * instance renders nested inside its own small `position: absolute` debug
 * panel, where `absolute; inset: 0` would only cover that 260px-wide
 * panel, not the viewport. `fixed` covers the viewport regardless of which
 * positioned ancestor it happens to be nested under.
 */
export interface AboutScreenProps {
  open: boolean;
  onClose: () => void;
}

export function AboutScreen({ open, onClose }: AboutScreenProps) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5,10,12,.92)',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        cursor: 'pointer',
        zIndex: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(580px, 94vw)',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '28px 30px',
          background: 'var(--panel2)',
          border: '1px solid var(--line2)',
          borderRadius: 6,
          fontFamily: 'var(--sans)',
          color: 'var(--text)',
          cursor: 'default',
        }}
      >
        <p style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--dim)', margin: '0 0 14px' }}>
          About this artifact
        </p>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: '0 0 16px', letterSpacing: '-0.01em' }}>A tribute, not an original idea.</h1>
        <p style={{ fontSize: 13, lineHeight: 1.65, margin: '0 0 12px' }}>
          This whole thing exists because of one video: Sebastian Lague&rsquo;s{' '}
          <a href="https://www.youtube.com/watch?v=r_It_X7v-1E" target="_blank" rel="noopener" style={{ color: 'var(--teal)' }}>
            Coding Adventure: Simulating an Ecosystem
          </a>
          . Watching a population of cube rabbits stumble through hunger, thirst, and reproduction &mdash; and watching
          their genes actually drift in response to what killed them and what didn&rsquo;t &mdash; is what made evolution
          by natural selection feel less like a textbook diagram and more like something you could <em>watch happen</em>.
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.65, margin: '0 0 12px' }}>
          What stayed with me wasn&rsquo;t the polish, it was the mechanism: a handful of numbers with no instructions
          attached, filtered generation after generation by nothing more than who managed to eat, drink, and breed
          before their timer ran out. Change one setting &mdash; how far a rabbit can see, how long a plant takes to
          regrow, how fast a predator runs &mdash; and the entire population&rsquo;s genetic future bends around it.
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.65, margin: '0 0 12px' }}>
          This build rebuilds that idea around a day-phase cycle (dawn, forage, dusk, resolve, night) instead of a
          continuous clock, dressed with Polyfork&rsquo;s low-poly nature kit and animated with its distance-driven walk
          IK. None of the core concept is mine. The rabbits, the predators, the hunger and thirst and gestation
          trade-offs, the whole shape of the simulation &mdash; that&rsquo;s Lague&rsquo;s, watched closely and rebuilt
          as a way of understanding it properly. If you haven&rsquo;t seen the original, it&rsquo;s fifteen minutes and
          it&rsquo;s worth every one of them.
        </p>
        <p style={{ fontSize: 12, color: 'var(--dim)', margin: '0 0 20px' }}>
          Built with three.js &middot; environment assets from Polyfork &middot; not affiliated with Sebastian Lague
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              minWidth: 120,
              padding: 10,
              fontFamily: 'var(--mono)',
              fontSize: 11,
              letterSpacing: '0.08em',
              color: 'var(--ink)',
              background: 'var(--teal)',
              border: '1px solid var(--teal)',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            CLOSE
          </button>
          <a href="https://www.youtube.com/watch?v=r_It_X7v-1E" target="_blank" rel="noopener" style={{ flex: 1, minWidth: 120 }}>
            <button
              style={{
                width: '100%',
                padding: 10,
                fontFamily: 'var(--mono)',
                fontSize: 11,
                letterSpacing: '0.08em',
                color: 'var(--text)',
                background: 'transparent',
                border: '1px solid var(--line)',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              WATCH THE VIDEO
            </button>
          </a>
        </div>
      </div>
    </div>
  );
}
