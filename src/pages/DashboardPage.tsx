import { useMemo, useState } from 'react';
import { gameClient } from '../api/gameClient';
import { useGame } from '../context/GameContext';
import type { PlayerMaterial, PlayerBuilding, ProcessSchedule } from '../types';
import { Card, StatTile, Meter, Badge, MaterialChip } from '../components/ui';
import type { BadgeTone } from '../components/ui';
import { formatNumber, timeRemaining } from '../lib/format';
import { buildingIcon, phaseStoragePool, phaseLabel, phaseIcon } from '../lib/icons';

type Status = { type: 'success' | 'error'; message: string };
type Pool = 'dry' | 'fluid' | 'gas';
const POOLS: { pool: Pool; label: string; icon: string }[] = [
  { pool: 'dry', label: 'Dry storage', icon: '🧱' },
  { pool: 'fluid', label: 'Fluid storage', icon: '💧' },
  { pool: 'gas', label: 'Gas storage', icon: '💨' },
];
const COLLAPSED_PER_GROUP = 12;

function deriveBuildingStatus(
  b: PlayerBuilding,
  schedule: ProcessSchedule | undefined,
): { label: string; tone: BadgeTone; timer?: string } {
  if (!b.b_finished_building || b.b_current_status === 'under_construction') {
    return { label: 'Building', tone: 'warning' };
  }
  if (schedule) {
    const t = timeRemaining(schedule.ends_at);
    if (!t.done) return { label: 'Running', tone: 'info', timer: t.label };
  }
  if (b.b_proc_installed) {
    return b.b_proc_autorun
      ? { label: 'Autorun', tone: 'primary' }
      : { label: 'Ready', tone: 'success' };
  }
  return { label: 'Empty', tone: 'neutral' };
}

export function DashboardPage() {
  const {
    player, materialsInventory, materialsCatalogue, buildingsInventory,
    buildingsCatalogue, processCatalogue, processSchedule, expansion,
    playerLoaded, refreshPlayer,
  } = useGame();

  // Dispose state
  const [selected, setSelected] = useState<PlayerMaterial | null>(null);
  const [disposeAmount, setDisposeAmount] = useState('1');
  const [disposeStatus, setDisposeStatus] = useState<Status | null>(null);

  // Upgrade + storage-contents UI state
  const [upgradeStatus, setUpgradeStatus] = useState<Status | null>(null);
  const [filter, setFilter] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<Pool, boolean>>({ dry: false, fluid: false, gas: false });

  // Map schedule by building for quick timer lookup.
  const scheduleByBuilding = useMemo(() => {
    const m = new Map<number, ProcessSchedule>();
    processSchedule.forEach((s) => m.set(s.runs_in_this_building_id, s));
    return m;
  }, [processSchedule]);

  // Group inventory by storage pool, sorted by amount desc, filtered.
  const grouped = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const groups: Record<Pool, PlayerMaterial[]> = { dry: [], fluid: [], gas: [] };
    for (const mat of materialsInventory) {
      const info = materialsCatalogue.get(mat.res_id);
      if (q) {
        const hay = `${info?.res_name ?? ''} ${mat.res_code ?? ''}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      groups[phaseStoragePool(info?.res_phase)].push(mat);
    }
    (Object.keys(groups) as Pool[]).forEach((p) => groups[p].sort((a, b) => b.amount - a.amount));
    return groups;
  }, [materialsInventory, materialsCatalogue, filter]);

  const nextUpgradeCost = useMemo(() => {
    const level = expansion?.expansion_level ?? 1;
    const base = expansion?.base_cost ?? 500;
    return base * Math.pow(10, level - 1);
  }, [expansion]);

  const disposeInfo = selected ? materialsCatalogue.get(selected.res_id) : undefined;

  const handleDispose = async () => {
    if (!selected) return;
    const amount = parseInt(disposeAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      setDisposeStatus({ type: 'error', message: 'Enter a valid positive amount' });
      return;
    }
    if (amount > selected.amount) {
      setDisposeStatus({ type: 'error', message: `You only have ${formatNumber(selected.amount)}` });
      return;
    }
    const name = disposeInfo?.res_name || selected.res_code;
    const cost = (disposeInfo?.res_dispose_cost || 0) * amount;
    const pollut = (disposeInfo?.res_dispose_pollut || 0) * amount;
    if (!window.confirm(`Dispose ${formatNumber(amount)}x '${name}'?\n\nCost: ${formatNumber(cost)} cash\nPollution: ${formatNumber(pollut)}`)) {
      return;
    }
    const result = await gameClient.dispose_resources(selected.res_id, amount);
    if (result.success) {
      setDisposeStatus({ type: 'success', message: `Disposed ${formatNumber(amount)}x '${name}'` });
      setSelected(null);
      await refreshPlayer();
    } else {
      setDisposeStatus({ type: 'error', message: `Failed: ${result.error}` });
    }
  };

  const handleUpgrade = async () => {
    if (!player) return;
    const level = expansion?.expansion_level ?? 1;
    if (player.player_cash < nextUpgradeCost) {
      setUpgradeStatus({ type: 'error', message: 'Not enough cash to upgrade building space' });
      return;
    }
    if (!window.confirm(`Upgrade building space?\n\nCurrent level: ${level}\nCost: ${formatNumber(nextUpgradeCost)} cash\nGrants: +5 building space`)) {
      return;
    }
    const result = await gameClient.upgrade_building_space();
    if (result.success) {
      setUpgradeStatus({ type: 'success', message: `Building space upgraded (level ${result.data?.expansion_level ?? level + 1})` });
      await refreshPlayer();
    } else {
      setUpgradeStatus({ type: 'error', message: result.error || 'Failed to upgrade' });
    }
  };

  if (!playerLoaded && !player) {
    return <div className="loading">Loading dashboard...</div>;
  }
  if (!player) {
    return <div className="error">No player data found. Try refreshing, or complete onboarding.</div>;
  }

  const spaceOver = player.build_space_occupied > player.building_space;

  return (
    <div className="ui-page">
      <div className="ui-page-head">
        <div>
          <h2>🏭 {player.player_factory}</h2>
          <div className="ui-sub">{player.player_name}</div>
        </div>
      </div>

      {/* Vital stats */}
      <section className="ui-section">
        <div className="ui-grid ui-grid--tiles">
          <StatTile label="Cash" value={formatNumber(player.player_cash)} icon="💰" />
          <StatTile label="Pollution" value={formatNumber(player.player_pollution)} icon="☁️"
            tone={player.player_pollution > 0 ? 'warning' : 'default'} />
          <StatTile
            label="Building space"
            value={`${formatNumber(player.build_space_occupied)} / ${formatNumber(player.building_space)}`}
            icon="🏗️"
            tone={spaceOver ? 'danger' : 'default'}
            sub={`Expansion level ${expansion?.expansion_level ?? 1}`}
          />
          <StatTile label="Buildings" value={formatNumber(buildingsInventory.length)} icon="🏭" />
        </div>
      </section>

      {/* Storage meters */}
      <section className="ui-section">
        <div className="ui-section-title">Storage</div>
        <div className="ui-grid ui-grid--wide">
          <Card pad>
            <Meter label="Dry" pool="dry" icon="🧱 "
              capacity={player.player_dry_storage}
              occupied={player.player_dry_storage_occupied}
              reserved={player.player_dry_storage_reserved} />
          </Card>
          <Card pad>
            <Meter label="Fluid" pool="fluid" icon="💧 "
              capacity={player.player_fluid_storage}
              occupied={player.player_fluid_storage_occupied}
              reserved={player.player_fluid_storage_reserved} />
          </Card>
          <Card pad>
            <Meter label="Gas" pool="gas" icon="💨 "
              capacity={player.player_gas_storage}
              occupied={player.player_gas_storage_occupied}
              reserved={player.player_gas_storage_reserved} />
          </Card>
        </div>
      </section>

      {/* Buildings at a glance */}
      <section className="ui-section">
        <div className="ui-section-title">
          Your factory <span className="ui-count">{buildingsInventory.length} building(s)</span>
        </div>
        {buildingsInventory.length === 0 ? (
          <Card pad><div className="ui-empty">No buildings yet — head to the Buildings tab to construct your first one.</div></Card>
        ) : (
          <div className="ui-grid ui-grid--cards">
            {buildingsInventory.map((b) => {
              const cat = buildingsCatalogue.get(b.building_id);
              const proc = b.b_proc_installed ? processCatalogue.get(b.b_proc_installed) : undefined;
              const status = deriveBuildingStatus(b, scheduleByBuilding.get(b.this_building_id));
              return (
                <Card key={b.this_building_id} pad hover>
                  <div className="ui-row-between" style={{ marginBottom: 'var(--sp-2)' }}>
                    <span className="ui-cluster">
                      <span className="ui-icon ui-icon--md">{buildingIcon(cat?.building_code)}</span>
                      <strong>{cat?.building_name ?? `Building ${b.building_id}`}</strong>
                    </span>
                    <Badge tone={status.tone} dot>{status.label}</Badge>
                  </div>
                  <div className="ui-muted" style={{ fontSize: 'var(--fs-sm)' }}>
                    {proc ? proc.proc_name : <span className="ui-faint">No process installed</span>}
                    {status.timer && <> · <span className="ui-mono">{status.timer}</span></>}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Storage contents (clutter-managed) */}
      <section className="ui-section">
        <div className="ui-row-between" style={{ marginBottom: 'var(--sp-3)' }}>
          <div className="ui-section-title" style={{ margin: 0 }}>
            In storage <span className="ui-count">{materialsInventory.length} material(s)</span>
          </div>
          <input
            className="ui-btn" style={{ cursor: 'text', minWidth: 180 }}
            placeholder="Filter materials…" value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="ui-stack">
          {POOLS.map(({ pool, label, icon }) => {
            const items = grouped[pool];
            const expanded = expandedGroups[pool];
            const shown = expanded ? items : items.slice(0, COLLAPSED_PER_GROUP);
            return (
              <Card key={pool} pad>
                <div className="ui-row-between" style={{ marginBottom: 'var(--sp-2)' }}>
                  <strong>{icon} {label} <span className="ui-faint">({items.length})</span></strong>
                  {items.length > COLLAPSED_PER_GROUP && (
                    <button className="ui-btn ui-btn--sm" onClick={() => setExpandedGroups((g) => ({ ...g, [pool]: !expanded }))}>
                      {expanded ? 'Show less' : `Show all ${items.length}`}
                    </button>
                  )}
                </div>
                {items.length === 0 ? (
                  <div className="ui-faint" style={{ fontSize: 'var(--fs-sm)' }}>Empty</div>
                ) : (
                  <div className="ui-cluster">
                    {shown.map((mat) => {
                      const info = materialsCatalogue.get(mat.res_id);
                      return (
                        <MaterialChip
                          key={mat.res_id}
                          name={info?.res_name || mat.res_code}
                          color1={info?.res_color1}
                          color2={info?.res_color2}
                          amount={mat.amount}
                          selected={selected?.res_id === mat.res_id}
                          onClick={() => setSelected(mat)}
                          title={`${info?.res_name || mat.res_code} — ${phaseLabel(info?.res_phase)}`}
                        />
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {/* Dispose + upgrade actions */}
      <section className="ui-section">
        <div className="ui-grid ui-grid--wide">
          <Card pad>
            <div className="ui-section-title" style={{ margin: '0 0 var(--sp-2)' }}>🗑️ Dispose material</div>
            {selected && disposeInfo ? (
              <div className="ui-stack">
                <div className="ui-cluster">
                  <MaterialChip name={disposeInfo.res_name} color1={disposeInfo.res_color1} color2={disposeInfo.res_color2} amount={selected.amount} />
                  <span className="ui-faint" style={{ fontSize: 'var(--fs-sm)' }}>{phaseIcon(disposeInfo.res_phase)} {phaseLabel(disposeInfo.res_phase)}</span>
                </div>
                <div className="ui-muted" style={{ fontSize: 'var(--fs-sm)' }}>
                  Cost/unit: {formatNumber(disposeInfo.res_dispose_cost)} cash · {formatNumber(disposeInfo.res_dispose_pollut)} pollution
                </div>
                <div className="ui-cluster">
                  <input className="ui-btn" style={{ cursor: 'text', width: 110 }} type="number" min="1"
                    value={disposeAmount} onChange={(e) => setDisposeAmount(e.target.value)} />
                  <button className="ui-btn ui-btn--danger" onClick={handleDispose}>Dispose</button>
                </div>
              </div>
            ) : (
              <div className="ui-faint" style={{ fontSize: 'var(--fs-sm)' }}>Select a material above to dispose of it.</div>
            )}
            {disposeStatus && <div className={`status-message ${disposeStatus.type}`} style={{ marginTop: 'var(--sp-3)' }}>{disposeStatus.message}</div>}
          </Card>

          <Card pad>
            <div className="ui-section-title" style={{ margin: '0 0 var(--sp-2)' }}>🏗️ Upgrade building space</div>
            <div className="ui-stack">
              <div className="ui-muted" style={{ fontSize: 'var(--fs-sm)' }}>
                Current: {formatNumber(player.build_space_occupied)} / {formatNumber(player.building_space)} · grants +5 space
              </div>
              <div><strong>Next cost:</strong> <span className="ui-mono">{formatNumber(nextUpgradeCost)}</span> cash</div>
              <div>
                <button className="ui-btn ui-btn--primary" onClick={handleUpgrade} disabled={player.player_cash < nextUpgradeCost}>
                  Upgrade (+5)
                </button>
                {player.player_cash < nextUpgradeCost && <span className="ui-faint" style={{ marginLeft: 8, fontSize: 'var(--fs-sm)' }}>Insufficient cash</span>}
              </div>
            </div>
            {upgradeStatus && <div className={`status-message ${upgradeStatus.type}`} style={{ marginTop: 'var(--sp-3)' }}>{upgradeStatus.message}</div>}
          </Card>
        </div>
      </section>
    </div>
  );
}
