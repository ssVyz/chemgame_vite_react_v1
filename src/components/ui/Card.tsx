import type { ReactNode, CSSProperties } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  pad?: boolean;
  hover?: boolean;
  interactive?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  title?: string;
}

export function Card({
  children, className = '', pad = false, hover = false, interactive = false,
  selected = false, disabled = false, onClick, style, title,
}: CardProps) {
  const classes = [
    'ui-card',
    pad ? 'ui-card--pad' : '',
    hover ? 'ui-card--hover' : '',
    interactive ? 'ui-card--interactive' : '',
    selected ? 'ui-card--selected' : '',
    disabled ? 'ui-card--disabled' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} onClick={disabled ? undefined : onClick} style={style} title={title}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`ui-card-header ${className}`}>{children}</div>;
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`ui-card-body ${className}`}>{children}</div>;
}
