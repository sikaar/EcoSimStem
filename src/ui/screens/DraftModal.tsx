import { useSimStore } from '../../store/simStore';

/**
 * Placeholder for §8.3's card draft, which isn't built yet (Phase 2).
 * The day-phase machine still correctly pauses at `draft` every
 * draftIntervalDays (§4.2) — this just gives the player a way out of it
 * so a run doesn't stall forever with nothing to dismiss the phase.
 */
export function DraftModal() {
  const draftPending = useSimStore((s) => s.draftPending);
  const requestDraftDismiss = useSimStore((s) => s.requestDraftDismiss);
  if (!draftPending) return null;

  return (
    <div
      onClick={requestDraftDismiss}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(13,20,22,0.82)',
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        zIndex: 10,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          fontFamily: 'var(--mono)',
          color: 'var(--text)',
          background: 'var(--panel2)',
          border: '1px solid var(--line2)',
          borderRadius: 6,
          padding: '24px 32px',
          width: 'min(320px, 92vw)',
          textAlign: 'center',
          cursor: 'default',
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--teal)', marginBottom: 10 }}>DRAFT</div>
        <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 16, lineHeight: 1.5 }}>
          Card draft isn't built yet — it lands in Phase 2 (§8.3). This is a placeholder so a run
          doesn't stall forever on a draft day with nothing to pick.
        </div>
        <button
          onClick={requestDraftDismiss}
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '0.1em',
            color: 'var(--text)',
            background: 'transparent',
            border: '1px solid var(--line)',
            borderRadius: 4,
            padding: '6px 16px',
            cursor: 'pointer',
          }}
        >
          CONTINUE
        </button>
      </div>
    </div>
  );
}
