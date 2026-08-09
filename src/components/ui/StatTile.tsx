import type { ReactNode } from 'react';

interface StatTileProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  sub?: ReactNode;
  tone?: 'default' | 'danger' | 'success' | 'warning';
}

export function StatTile({ label, value, icon, sub, tone = 'default' }: StatTileProps) {
  return (
    <div className={`stat-tile stat-tile--${tone}`}>
      {icon != null && <span className="stat-tile__icon">{icon}</span>}
      <span className="stat-tile__body">
        <span className="stat-tile__label">{label}</span>
        <span className="stat-tile__value">{value}</span>
        {sub != null && <span className="stat-tile__sub">{sub}</span>}
      </span>
    </div>
  );
}
