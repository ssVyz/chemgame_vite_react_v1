import { useMemo, useState } from 'react';
import { gameClient } from '../../api/gameClient';
import { useGame } from '../../context/GameContext';
import type { PlayerBuilding } from '../../types';
import { Modal, Card, Badge } from '../ui';
import { RecipeCard } from './RecipeCard';
import { formatNumber } from '../../lib/format';
import type { ActionStatus } from '../../lib/status';

interface Props {
  building: PlayerBuilding;
  onClose: () => void;
  notify: (s: ActionStatus) => void;
  refresh: () => Promise<void>;
}

/** Install a process onto an empty building — with optional batch install into
 *  other empty buildings of the same type. */
export function ProcessPicker({ building, onClose, notify, refresh }: Props) {
  const {
    allowedProcesses, processCatalogue, isProcessUnlocked,
    buildingsInventory, buildingsCatalogue, player,
  } = useGame();

  const [selectedProc, setSelectedProc] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [showLocked, setShowLocked] = useState(false);
  const [busy, setBusy] = useState(false);

  const cat = buildingsCatalogue.get(building.building_id);

  // Empty, finished siblings of the same building type (target this one first).
  const eligible = useMemo(() => {
    const others = buildingsInventory.filter((b) =>
      b.building_id === building.building_id &&
      b.this_building_id !== building.this_building_id &&
      b.b_finished_building && b.b_current_status === 'unconfigured' && !b.b_proc_installed,
    );
    return [building, ...others];
  }, [buildingsInventory, building]);

  const procList = useMemo(() => {
    const ids = allowedProcesses.get(building.building_id) ?? [];
    const procs = ids.map((id) => processCatalogue.get(id)).filter((p): p is NonNullable<typeof p> => !!p);
    procs.sort((a, b) => a.proc_install_cost - b.proc_install_cost);
    return showLocked ? procs : procs.filter((p) => isProcessUnlocked(p.proc_id));
  }, [allowedProcesses, processCatalogue, isProcessUnlocked, building.building_id, showLocked]);

  const maxQty = eligible.length;
  const proc = selectedProc != null ? processCatalogue.get(selectedProc) : undefined;
  const totalCost = proc ? proc.proc_install_cost * qty : 0;
  const affordCash = player ? player.player_cash >= totalCost : false;
  const canInstall = !!proc && isProcessUnlocked(proc.proc_id) && qty >= 1 && qty <= maxQty && affordCash && !busy;

  const install = async () => {
    if (!proc) return;
    setBusy(true);
    let ok = 0, fail = 0;
    for (const target of eligible.slice(0, qty)) {
      const r = await gameClient.install_process(target.this_building_id, proc.proc_id);
      if (r.success) ok++; else fail++;
    }
    setBusy(false);
    notify({ type: ok > 0 ? 'success' : 'error', message: `Installing ${proc.proc_name} on ${ok} building(s)${fail ? `, ${fail} failed` : ''}` });
    await refresh();
    onClose();
  };

  const footer = (
    <div className="picker-controls">
      <label className="ui-cluster" style={{ gap: 4 }}>
        <input type="checkbox" checked={showLocked} onChange={(e) => setShowLocked(e.target.checked)} /> show locked
      </label>
      <span className="spacer" />
      {proc && (
        <span className="ui-muted" style={{ fontSize: 'var(--fs-sm)' }}>
          {formatNumber(totalCost)} cash{!affordCash && <span className="picker-warn"> · not enough cash</span>}
        </span>
      )}
      {maxQty > 1 && (
        <span className="runbox" title={`${maxQty} empty ${cat?.building_name ?? 'building'}(s) available`}>
          into ×<input className="factory-input" type="number" min="1" max={maxQty} value={qty}
            onChange={(e) => setQty(Math.min(maxQty, Math.max(1, parseInt(e.target.value, 10) || 1)))} />
          <span className="ui-faint" style={{ fontSize: 'var(--fs-xs)' }}>/ {maxQty}</span>
        </span>
      )}
      <button className="ui-btn ui-btn--primary" onClick={install} disabled={!canInstall}>
        {busy ? 'Installing…' : `Install${qty > 1 ? ` ×${qty}` : ''}`}
      </button>
    </div>
  );

  return (
    <Modal title={`Install process — ${cat?.building_name ?? 'building'}`} onClose={onClose} footer={footer} maxWidth={860}>
      {procList.length === 0 ? (
        <div className="ui-empty">No processes available for this building type.</div>
      ) : (
        <div className="picker-grid">
          {procList.map((p) => {
            const unlocked = isProcessUnlocked(p.proc_id);
            return (
              <Card key={p.proc_id} pad hover interactive
                selected={selectedProc === p.proc_id}
                disabled={!unlocked}
                onClick={() => setSelectedProc(p.proc_id)}>
                <div className="ui-row-between" style={{ marginBottom: 'var(--sp-2)' }}>
                  <strong>{p.proc_name}</strong>
                  {!unlocked && <Badge tone="warning">🔒</Badge>}
                </div>
                <RecipeCard procId={p.proc_id} hideHeader showInstallMeta />
              </Card>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
