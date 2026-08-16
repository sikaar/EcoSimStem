import type { CSSProperties } from 'react';
import { useSimStore } from '../../store/simStore';
import { TUNING_FIELDS } from '../../config/tuningFields';
import type { DraftCard } from '../../config/draftCards';
import type { Tuning } from '../../engine/types';

/**
 * The card draft (§8.3). Three cards, pick one, the run continues under the
 * new pressure.
 *
 * Every card is a trade-off rather than an upgrade, so the deltas are shown
 * in full and colour-coded by direction — the pick is only interesting if
 * you can see what it costs. Direction is not the same as sign: a smaller
 * `regrow delay` or `hunger / day` is a gift, a bigger one is a bill, so
 * each field carries which way is "good" rather than colouring by the sign
 * of the number.
 */
const FIELD_LABEL = new Map(TUNING_FIELDS.map((f) => [f.key, f.label] as const));

/** Tuning fields where a *decrease* is the favourable direction. Everything
 * not listed reads better when it goes up. */
const LOWER_IS_BETTER = new Set<keyof Tuning>([
  'regrowDays',
  'hungerPerDay',
  'thirstPerDay',
  'moveCostK',
  'senseCostK',
  'idleCost',
  'predatorSpeed',
  'predatorSense',
  'gestMinDays',
  'gestMaxDays',
]);

function formatDelta(key: keyof Tuning, delta: number): string {
  const label = FIELD_LABEL.get(key) ?? key;
  const rounded = Math.abs(delta) < 1 ? delta.toFixed(2).replace(/0$/, '') : String(delta);
  return `${delta > 0 ? '+' : ''}${rounded} ${label}`;
}

const overlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(13,20,22,0.86)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 10,
  padding: 16,
};

const cardStyle: CSSProperties = {
  fontFamily: 'var(--mono)',
  color: 'var(--text)',
  background: 'var(--panel2)',
  border: '1px solid var(--line2)',
  borderRadius: 6,
  padding: '16px 18px',
  width: 210,
  textAlign: 'left',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

export function DraftModal() {
  const draftPending = useSimStore((s) => s.draftPending);
  const draftHand = useSimStore((s) => s.draftHand);
  const chooseDraftCard = useSimStore((s) => s.chooseDraftCard);
  const requestDraftDismiss = useSimStore((s) => s.requestDraftDismiss);
  if (!draftPending || !draftHand || draftHand.length === 0) return null;

  return (
    <div style={overlayStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, maxWidth: '100%' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em', color: 'var(--teal)' }}>
          DRAFT — TAKE ONE
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {draftHand.map((card: DraftCard) => (
            <button key={card.id} style={cardStyle} onClick={() => chooseDraftCard(card)}>
              <div style={{ fontSize: 13, color: 'var(--teal)' }}>{card.title}</div>
              <div style={{ fontSize: 10.5, lineHeight: 1.5, color: 'var(--dim)' }}>{card.description}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                {(Object.entries(card.delta) as Array<[keyof Tuning, number]>).map(([key, delta]) => {
                  const good = LOWER_IS_BETTER.has(key) ? delta < 0 : delta > 0;
                  return (
                    <div key={key} style={{ fontSize: 10, color: good ? 'var(--leaf)' : 'var(--rust, #c94f3d)' }}>
                      {formatDelta(key, delta)}
                    </div>
                  );
                })}
              </div>
            </button>
          ))}
        </div>
        <button
          onClick={requestDraftDismiss}
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '0.1em',
            color: 'var(--dim)',
            background: 'transparent',
            border: '1px solid var(--line)',
            borderRadius: 4,
            padding: '6px 16px',
            cursor: 'pointer',
          }}
        >
          SKIP
        </button>
      </div>
    </div>
  );
}
