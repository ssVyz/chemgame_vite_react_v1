import { useMemo, useState } from 'react';
import { gameClient } from '../api/gameClient';
import { useGame } from '../context/GameContext';
import type { PlayerBuilding, PlayerStorageExtension } from '../types';
import { Card, Badge } from '../components/ui';
import { BuildingCard } from '../components/game/BuildingCard';
import { BuildingPicker } from '../components/game/BuildingPicker';
import { ProcessPicker } from '../components/game/ProcessPicker';
import { StorageExtensionPicker } from '../components/game/StorageExtensionPicker';
import { formatNumber, formatSeconds } from '../lib/format';
import type { ActionStatus } from '../lib/status';

type Picker = null | { kind: 'building' } | { kind: 'storage' } | { kind: 'process'; building: PlayerBuilding };

export function FactoryPage() {
  const {
    buildingsInventory, storageExtensionsInventory, storageExtensionsCatalogue,
    playerLoaded, refreshPlayer,
  } = useGame();

  const [status, setStatus] = useState<ActionStatus | null>(null);
  const [picker, setPicker] = useState<Picker>(null);
  const [busy, setBusy] = useState(false);
  // Which building cards have their recipe (input/output) expanded. Collapsed by default.
  const [expandedRecipes, setExpandedRecipes] = useState<Set<number>>(new Set());

  const notify = (s: ActionStatus) => setStatus(s);

  // Stable order: by build order (this_building_id ascending), so buildings
  // built earlier always stay higher up in the list.
  const sortedBuildings = useMemo(
    () => [...buildingsInventory].sort((a, b) => a.this_building_id - b.this_building_id),
    [buildingsInventory],
  );

  const toggleRecipe = (id: number) =>
    setExpandedRecipes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const expandAllRecipes = () =>
    setExpandedRecipes(new Set(buildingsInventory.filter((b) => b.b_proc_installed).map((b) => b.this_building_id)));
  const collapseAllRecipes = () => setExpandedRecipes(new Set());

  const withProcess = useMemo(
    () => buildingsInventory.filter((b) => b.b_proc_installed),
    [buildingsInventory],
  );

  const runBulk = async (
    targets: PlayerBuilding[],
    fn: (b: PlayerBuilding) => Promise<{ success: boolean; error?: string }>,
    label: string,
  ) => {
    if (targets.length === 0) { notify({ type: 'error', message: 'Nothing to do' }); return; }
    setBusy(true);
    let ok = 0, fail = 0;
    for (const t of targets) { const r = await fn(t); if (r.success) ok++; else fail++; }
    setBusy(false);
    notify({ type: ok > 0 ? 'success' : 'error', message: `${label}: ${ok} ok${fail ? `, ${fail} failed` : ''}` });
    await refreshPlayer();
  };

  const demolishAll = () => {
    if (!window.confirm('Demolish ALL eligible (empty, unconfigured) buildings? Cannot be undone.')) return;
    runBulk(buildingsInventory, (b) => gameClient.demolish_building(b.this_building_id), 'Demolished');
  };
  const autorunAll = () => runBulk(withProcess, (b) => gameClient.activate_autorun(b.this_building_id), 'Autorun on');
  const autorunNone = () => runBulk(withProcess, (b) => gameClient.deactivate_autorun(b.this_building_id), 'Autorun off');
  const uninstallAll = () => {
    if (!window.confirm('Uninstall processes on ALL buildings? This can be costly.')) return;
    runBulk(withProcess, (b) => gameClient.uninstall_process(b.this_building_id), 'Uninstalled');
  };

  const handleDemolishExt = async (ext: PlayerStorageExtension, name: string) => {
    if (ext.s_ext_current_status !== 'completed') { notify({ type: 'error', message: 'Only completed extensions can be demolished' }); return; }
    if (!window.confirm(`Demolish '${name}'? This cannot be undone.`)) return;
    setBusy(true);
    const r = await gameClient.demolish_storage_extension(ext.this_s_extension_id);
    setBusy(false);
    if (r.success) { notify({ type: 'success', message: `Demolished ${name}` }); await refreshPlayer(); }
    else notify({ type: 'error', message: `Failed: ${r.error}` });
  };

  if (!playerLoaded && buildingsInventory.length === 0) {
    return <div className="loading">Loading factory…</div>;
  }

  return (
    <div className="ui-page">
      <div className="ui-page-head">
        <h2>🏭 Factory</h2>
      </div>

      {/* Toolbar */}
      <div className="factory-toolbar">
        <button className="ui-btn ui-btn--primary" onClick={() => setPicker({ kind: 'building' })}>＋ Build building</button>
        <button className="ui-btn" onClick={() => setPicker({ kind: 'storage' })}>＋ Storage extension</button>
        <span className="spacer" />
        <button className="ui-btn ui-btn--sm" onClick={expandAllRecipes}>⊞ Expand recipes</button>
        <button className="ui-btn ui-btn--sm" onClick={collapseAllRecipes}>⊟ Collapse recipes</button>
        <button className="ui-btn ui-btn--sm" onClick={autorunAll} disabled={busy}>🔄 Autorun all</button>
        <button className="ui-btn ui-btn--sm" onClick={autorunNone} disabled={busy}>⏹ Autorun none</button>
        <button className="ui-btn ui-btn--sm" onClick={uninstallAll} disabled={busy}>🗑 Uninstall all</button>
        <button className="ui-btn ui-btn--sm ui-btn--danger" onClick={demolishAll} disabled={busy}>🔨 Demolish all</button>
      </div>

      {status && (
        <div className={`status-message ${status.type}`} style={{ marginBottom: 'var(--sp-4)' }}>{status.message}</div>
      )}

      {/* Buildings */}
      <section className="ui-section">
        <div className="ui-section-title">
          Buildings <span className="ui-count">{sortedBuildings.length}</span>
        </div>
        {sortedBuildings.length === 0 ? (
          <Card pad><div className="ui-empty">No buildings yet — click “＋ Build building” to start.</div></Card>
        ) : (
          <div className="ui-grid ui-grid--wide">
            {sortedBuildings.map((b) => (
              <BuildingCard key={b.this_building_id} building={b}
                expanded={expandedRecipes.has(b.this_building_id)}
                onToggleRecipe={() => toggleRecipe(b.this_building_id)}
                onInstall={(bld) => setPicker({ kind: 'process', building: bld })}
                notify={notify} refresh={refreshPlayer} />
            ))}
          </div>
        )}
      </section>

      {/* Storage extensions */}
      <section className="ui-section">
        <div className="ui-section-title">
          Storage extensions <span className="ui-count">{storageExtensionsInventory.length}</span>
        </div>
        {storageExtensionsInventory.length === 0 ? (
          <Card pad><div className="ui-empty">No storage extensions — add one to grow your capacity.</div></Card>
        ) : (
          <div className="ui-grid ui-grid--cards">
            {storageExtensionsInventory.map((ext) => {
              const cat = storageExtensionsCatalogue.get(ext.s_extension_id);
              const name = cat?.s_extension_name || `Extension ${ext.s_extension_id}`;
              const completed = ext.s_ext_current_status === 'completed' || ext.s_ext_finished_building;
              let timer: string | null = null;
              if (!completed && cat) {
                const secs = Math.max(0, Math.round((new Date(ext.created_at).getTime() + cat.s_extension_build_time * 60_000 - Date.now()) / 1000));
                timer = secs <= 0 ? 'ready' : formatSeconds(secs);
              }
              return (
                <Card key={ext.this_s_extension_id} pad hover>
                  <div className="ui-row-between" style={{ marginBottom: 'var(--sp-2)' }}>
                    <span className="ui-cluster"><span className="ui-icon ui-icon--md">📦</span><strong>{name}</strong></span>
                    <Badge tone={completed ? 'success' : 'warning'} dot>{completed ? 'Completed' : 'Building'}</Badge>
                  </div>
                  {timer && <div className="bcard__timer" style={{ marginBottom: 'var(--sp-2)' }}>⏳ {timer}</div>}
                  {cat && (
                    <div className="type-card__meta" style={{ marginBottom: 'var(--sp-2)' }}>
                      {cat.s_extension_add_dry_storage > 0 && <Badge>🧱 +{formatNumber(cat.s_extension_add_dry_storage)}</Badge>}
                      {cat.s_extension_add_fluid_storage > 0 && <Badge>💧 +{formatNumber(cat.s_extension_add_fluid_storage)}</Badge>}
                      {cat.s_extension_add_gas_storage > 0 && <Badge>💨 +{formatNumber(cat.s_extension_add_gas_storage)}</Badge>}
                    </div>
                  )}
                  <button className="ui-btn ui-btn--danger ui-btn--sm" disabled={!completed || busy}
                    onClick={() => handleDemolishExt(ext, name)}>🔨 Demolish</button>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {picker?.kind === 'building' && <BuildingPicker onClose={() => setPicker(null)} notify={notify} refresh={refreshPlayer} />}
      {picker?.kind === 'storage' && <StorageExtensionPicker onClose={() => setPicker(null)} notify={notify} refresh={refreshPlayer} />}
      {picker?.kind === 'process' && <ProcessPicker building={picker.building} onClose={() => setPicker(null)} notify={notify} refresh={refreshPlayer} />}
    </div>
  );
}
