import { useGame } from '../../context/GameContext';
import { MaterialChip, Badge } from '../ui';
import { processIcon } from '../../lib/icons';
import { formatNumber, formatMinutes } from '../../lib/format';

interface RecipeCardProps {
  procId: number;
  /** Show install cost/time (used in the process picker). */
  showInstallMeta?: boolean;
  /** Hide the process name/header row (when the card already names it). */
  hideHeader?: boolean;
  className?: string;
}

/**
 * Reusable recipe view: inputs → outputs as color material chips, plus
 * cost/time/pollution badges. Pulls everything from the central store.
 */
export function RecipeCard({ procId, showInstallMeta = false, hideHeader = false, className = '' }: RecipeCardProps) {
  const { processCatalogue, materialsCatalogue, getRecipe, isProcessUnlocked } = useGame();
  const proc = processCatalogue.get(procId);
  if (!proc) return null;

  const { inputs, outputs } = getRecipe(procId);
  const locked = !isProcessUnlocked(procId);

  const chip = (resId: number, amount: number, key: string) => {
    const m = materialsCatalogue.get(resId);
    return (
      <MaterialChip
        key={key}
        name={m?.res_name || `#${resId}`}
        color1={m?.res_color1}
        color2={m?.res_color2}
        amount={amount}
      />
    );
  };

  return (
    <div className={`recipe ${className}`}>
      {!hideHeader && (
        <div className="recipe__head">
          <span className="ui-icon ui-icon--sm">{processIcon(proc.proc_category)}</span>
          <strong>{proc.proc_name}</strong>
          <Badge>{proc.proc_category}</Badge>
          {locked && <Badge tone="warning">🔒 needs tech</Badge>}
        </div>
      )}
      <div className="recipe__flow">
        <div className="recipe__io">
          {inputs.length ? inputs.map((i) => chip(i.res_id, i.amount, `i${i.res_id}`))
                         : <span className="ui-faint" style={{ fontSize: 'var(--fs-sm)' }}>no inputs</span>}
        </div>
        <span className="recipe__arrow">→</span>
        <div className="recipe__io">
          {outputs.length ? outputs.map((o) => chip(o.res_id, o.amount, `o${o.res_id}`))
                          : <span className="ui-faint" style={{ fontSize: 'var(--fs-sm)' }}>no outputs</span>}
        </div>
      </div>
      <div className="recipe__badges">
        <Badge>💰 {formatNumber(proc.proc_run_cost)}/run</Badge>
        <Badge>⏱️ {formatMinutes(proc.proc_run_time)}</Badge>
        {(proc.proc_run_pollut ?? 0) > 0 && <Badge tone="warning">☁️ {formatNumber(proc.proc_run_pollut)}</Badge>}
        {showInstallMeta && (
          <Badge tone="info">install {formatNumber(proc.proc_install_cost)} · {formatMinutes(proc.proc_install_time)}</Badge>
        )}
      </div>
    </div>
  );
}
