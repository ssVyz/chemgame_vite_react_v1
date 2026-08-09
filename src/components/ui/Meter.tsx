import type { ReactNode } from 'react';
import { formatNumber } from '../../lib/format';

interface MeterProps {
  label: string;
  pool: 'dry' | 'fluid' | 'gas';
  capacity: number;
  occupied: number;
  reserved: number;
  icon?: ReactNode;
}

/**
 * Storage meter: shows occupied (solid) + reserved (hatched) against capacity,
 * plus a numeric legend. Handles the over-capacity edge case gracefully.
 */
export function Meter({ label, pool, capacity, occupied, reserved, icon }: MeterProps) {
  const cap = Math.max(0, capacity);
  const used = occupied + reserved;
  const free = cap - used;
  const over = used > cap;

  const pct = (n: number) => (cap <= 0 ? 0 : Math.min(100, Math.max(0, (n / cap) * 100)));

  return (
    <div className={`meter meter--${pool}${over ? ' meter--over' : ''}`}>
      <div className="meter__head">
        <span className="meter__name">{icon != null && <span>{icon}</span>}{label}</span>
        <span className="meter__nums">{formatNumber(used)} / {formatNumber(cap)}</span>
      </div>
      <div className="meter__track" role="img" aria-label={`${label}: ${used} of ${cap} used`}>
        <div className="meter__occupied" style={{ width: `${pct(occupied)}%` }} />
        <div className="meter__reserved" style={{ width: `${pct(reserved)}%` }} />
      </div>
      <div className="meter__legend">
        occupied {formatNumber(occupied)} · reserved {formatNumber(reserved)} ·{' '}
        {over ? <span style={{ color: 'var(--color-danger)' }}>over by {formatNumber(-free)}</span>
              : <>free {formatNumber(free)}</>}
      </div>
    </div>
  );
}
