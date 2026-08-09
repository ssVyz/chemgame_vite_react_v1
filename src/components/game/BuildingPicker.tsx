import { useMemo, useState } from 'react';
import { gameClient } from '../../api/gameClient';
import { useGame } from '../../context/GameContext';
import { Modal, Card, Badge } from '../ui';
import { buildingIcon } from '../../lib/icons';
import { formatNumber, formatMinutes } from '../../lib/format';
import type { ActionStatus } from '../../lib/status';

interface Props {
  onClose: () => void;
  notify: (s: ActionStatus) => void;
  refresh: () => Promise<void>;
}

export function BuildingPicker({ onClose, notify, refresh }: Props) {
  const { buildingsCatalogue, isBuildingUnlocked, player } = useGame();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [showLocked, setShowLocked] = useState(false);
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => {
    const all = Array.from(buildingsCatalogue.values()).sort((a, b) => a.building_cost - b.building_cost);
    return showLocked ? all : all.filter((b) => isBuildingUnlocked(b.building_id));
  }, [buildingsCatalogue, isBuildingUnlocked, showLocked]);

  const selected = selectedId != null ? buildingsCatalogue.get(selectedId) : undefined;
  const freeSpace = player ? player.building_space - player.build_space_occupied : 0;
  const totalCost = selected ? selected.building_cost * qty : 0;
  const totalSpace = selected ? selected.building_space_req * qty : 0;
  const affordCash = player ? player.player_cash >= totalCost : false;
  const affordSpace = freeSpace >= totalSpace;
  const canBuild = !!selected && isBuildingUnlocked(selected.building_id) && qty >= 1 && affordCash && affordSpace && !busy;

  const build = async () => {
    if (!selected) return;
    setBusy(true);
    let ok = 0, fail = 0;
    for (let i = 0; i < qty; i++) {
      const r = await gameClient.build_new_building(selected.building_id);
      if (r.success) ok++; else fail++;
    }
    setBusy(false);
    notify({ type: ok > 0 ? 'success' : 'error', message: `Started ${ok}× ${selected.building_name}${fail ? `, ${fail} failed` : ''}` });
    await refresh();
    onClose();
  };

  const footer = (
    <div className="picker-controls">
      <label className="ui-cluster" style={{ gap: 4 }}>
        <input type="checkbox" checked={showLocked} onChange={(e) => setShowLocked(e.target.checked)} /> show locked
      </label>
      <span className="spacer" />
      {selected && (
        <span className="ui-muted" style={{ fontSize: 'var(--fs-sm)' }}>
          {formatNumber(totalCost)} cash · {totalSpace} space
          {!affordCash && <span className="picker-warn"> · not enough cash</span>}
          {affordCash && !affordSpace && <span className="picker-warn"> · not enough space</span>}
        </span>
      )}
      <span className="runbox">
        ×<input className="factory-input" type="number" min="1" value={qty}
          onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))} />
      </span>
      <button className="ui-btn ui-btn--primary" onClick={build} disabled={!canBuild}>
        {busy ? 'Building…' : `Build ×${qty}`}
      </button>
    </div>
  );

  return (
    <Modal title="Build a building" onClose={onClose} footer={footer} maxWidth={860}>
      <div className="picker-grid">
        {list.map((bld) => {
          const unlocked = isBuildingUnlocked(bld.building_id);
          return (
            <Card key={bld.building_id} pad hover interactive
              selected={selectedId === bld.building_id}
              disabled={!unlocked}
              onClick={() => setSelectedId(bld.building_id)}>
              <div className="ui-row-between">
                <span className="ui-cluster">
                  <span className="ui-icon ui-icon--md">{buildingIcon(bld.building_code)}</span>
                  <strong>{bld.building_name}</strong>
                </span>
                {!unlocked && <Badge tone="warning">🔒</Badge>}
              </div>
              <div className="type-card__meta">
                <Badge>💰 {formatNumber(bld.building_cost)}</Badge>
                <Badge>▦ {bld.building_space_req} space</Badge>
                <Badge>⏱️ {formatMinutes(bld.building_build_time)}</Badge>
              </div>
            </Card>
          );
        })}
      </div>
    </Modal>
  );
}
