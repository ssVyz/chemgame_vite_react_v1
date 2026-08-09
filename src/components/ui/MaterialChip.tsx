import { formatNumber } from '../../lib/format';

interface MaterialChipProps {
  name: string;
  color1?: string | null;
  color2?: string | null;
  amount?: number | null;
  onClick?: () => void;
  selected?: boolean;
  title?: string;
}

function swatchBackground(color1?: string | null, color2?: string | null): string {
  if (color1 && color2) return `linear-gradient(135deg, ${color1} 0 50%, ${color2} 50% 100%)`;
  if (color1) return color1;
  if (color2) return color2;
  return 'var(--color-surface-3)';
}

/** Colored material token — the identity system for the 77 materials. */
export function MaterialChip({ name, color1, color2, amount, onClick, selected, title }: MaterialChipProps) {
  const classes = [
    'material-chip',
    onClick ? 'material-chip--button' : '',
    selected ? 'material-chip--selected' : '',
  ].filter(Boolean).join(' ');

  const body = (
    <>
      <span className="material-chip__swatch" style={{ background: swatchBackground(color1, color2) }} />
      <span className="material-chip__name">{name}</span>
      {amount != null && <span className="material-chip__amount">{formatNumber(amount)}</span>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} title={title ?? name}>
        {body}
      </button>
    );
  }
  return <span className={classes} title={title ?? name}>{body}</span>;
}
