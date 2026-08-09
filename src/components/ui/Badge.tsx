import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'danger' | 'warning' | 'info';

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
}

export function Badge({ children, tone = 'neutral', dot = false }: BadgeProps) {
  const cls = tone === 'neutral' ? 'badge' : `badge badge--${tone}`;
  return (
    <span className={cls}>
      {dot && <span className="badge__dot" />}
      {children}
    </span>
  );
}
