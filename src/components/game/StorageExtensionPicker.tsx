import { useMemo, useState } from 'react';
import { gameClient } from '../../api/gameClient';
import { useGame } from '../../context/GameContext';
import { Modal, Card, Badge } from '../ui';
import { formatNumber, formatMinutes } from '../../lib/format';
import type { ActionStatus } from '../../lib/status';

interface Props {
  onClose: () => void;
  notify: (s: ActionStatus) => void;
  refresh: () => Promise<void>;
}

export function StorageExtensionPicker({ onClose, notify, refresh }: Props) {
  const { storageExtensionsCatalogue, player } = useGame();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);

  const list = useMemo(
    () => Array.from(storageExtensionsCatalogue.values()).sort((a, b) => a.s_extension_cost - b.s_extension_cost),
    [storageExtensionsCatalogue],
  );

  const selected = selectedId != null ? storageExtensionsCatalogue.get(selectedId) : undefined;
  const freeSpace = player ? player.building_space - player.build_space_occupied : 0;
  const totalCost = selected ? selected.s_extension_cost * qty : 0;
  const totalSpace = selected ? selected.s_extension_space_req * qty : 0;
  const affordCash = player ? player.player_cash >= totalCost : false;
  const affordSpace = freeSpace >= totalSpace;
  const canBuild = !!selected && qty >= 1 && affordCash && affordSpace && !busy;

  const build = async () => {
    if (!selected) return;
    setBusy(true);
    let ok = 0, fail = 0;
    for (let i = 0; i < qty; i++) {
      const r = await gameClient.build_new_storage_extension(selected.s_extension_id);
      if (r.success) ok++; else fail++;
    }
    setBusy(false);
    notify({ type: ok > 0 ? 'success' : 'error', message: `Started ${ok}× ${selected.s_extension_name}${fail ? `, ${fail} failed` : ''}` });
    await refresh();
    onClose();
  };

  const footer = (
    <div className="picker-controls">
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
    <Modal title="Build a storage extension" onClose={onClose} footer={footer} maxWidth={860}>
      <div className="picker-grid">
        {list.map((ext) => (
          <Card key={ext.s_extension_id} pad hover interactive
            selected={selectedId === ext.s_extension_id}
            onClick={() => setSelectedId(ext.s_extension_id)}>
            <div className="ui-row-between">
              <span className="ui-cluster"><span className="ui-icon ui-icon--md">📦</span><strong>{ext.s_extension_name}</strong></span>
            </div>
            <div className="type-card__meta">
              <Badge>💰 {formatNumber(ext.s_extension_cost)}</Badge>
              <Badge>▦ {ext.s_extension_space_req} space</Badge>
              <Badge>⏱️ {formatMinutes(ext.s_extension_build_time)}</Badge>
            </div>
            <div className="type-card__meta">
              {ext.s_extension_add_dry_storage > 0 && <Badge tone="info">🧱 +{formatNumber(ext.s_extension_add_dry_storage)}</Badge>}
              {ext.s_extension_add_fluid_storage > 0 && <Badge tone="info">💧 +{formatNumber(ext.s_extension_add_fluid_storage)}</Badge>}
              {ext.s_extension_add_gas_storage > 0 && <Badge tone="info">💨 +{formatNumber(ext.s_extension_add_gas_storage)}</Badge>}
            </div>
          </Card>
        ))}
      </div>
    </Modal>
  );
}
