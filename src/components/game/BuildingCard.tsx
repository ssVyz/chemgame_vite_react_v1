import { useState } from 'react';
import { gameClient } from '../../api/gameClient';
import { useGame } from '../../context/GameContext';
import type { PlayerBuilding } from '../../types';
import { Card, Badge } from '../ui';
import type { BadgeTone } from '../ui';
import { RecipeCard } from './RecipeCard';
import { buildingIcon } from '../../lib/icons';
import { formatSeconds } from '../../lib/format';
import type { ActionStatus } from '../../lib/status';

interface Props {
  building: PlayerBuilding;
  onInstall: (b: PlayerBuilding) => void;
  notify: (s: ActionStatus) => void;
  refresh: () => Promise<void>;
}

function remainingLabel(endMs: number | null): string | null {
  if (endMs == null) return null;
  const secs = Math.max(0, Math.round((endMs - Date.now()) / 1000));
  return secs <= 0 ? 'ready' : formatSeconds(secs);
}

export function BuildingCard({ building: b, onInstall, notify, refresh }: Props) {
  const { buildingsCatalogue, processCatalogue, processSchedule } = useGame();
  const [runCount, setRunCount] = useState('1');
  const [busy, setBusy] = useState(false);

  const cat = buildingsCatalogue.get(b.building_id);
  const proc = b.b_proc_installed ? processCatalogue.get(b.b_proc_installed) : undefined;
  const schedule = processSchedule.find((s) => s.runs_in_this_building_id === b.this_building_id);

  const underConstruction = b.b_current_status === 'under_construction' || !b.b_finished_building;
  const isIdle = b.b_proc_status === 'idle';
  const hasProc = !!b.b_proc_installed;

  // Status badge
  let status: { label: string; tone: BadgeTone };
  if (underConstruction) status = { label: 'Under construction', tone: 'warning' };
  else if (b.b_current_status === 'being_demolished') status = { label: 'Demolishing', tone: 'danger' };
  else if (!hasProc) status = { label: 'Empty', tone: 'neutral' };
  else if (b.b_proc_status === 'being_installed') status = { label: 'Installing', tone: 'warning' };
  else if (b.b_proc_status === 'running') status = { label: 'Running', tone: 'info' };
  else if (b.b_proc_status === 'clearing_out') status = { label: 'Uninstalling', tone: 'warning' };
  else if (isIdle) status = b.b_proc_autorun ? { label: 'Autorun', tone: 'primary' } : { label: 'Ready', tone: 'success' };
  else status = { label: b.b_proc_status || 'Idle', tone: 'neutral' };

  // Timer
  let timer: string | null = null;
  if (underConstruction && cat) {
    timer = remainingLabel(new Date(b.created_at).getTime() + cat.building_build_time * 60_000);
  } else if ((b.b_proc_status === 'being_installed' || b.b_proc_status === 'clearing_out') && b.b_proc_timestamp && proc) {
    timer = remainingLabel(new Date(b.b_proc_timestamp).getTime() + proc.proc_install_time * 60_000);
  } else if (b.b_proc_status === 'running' && schedule?.ends_at) {
    timer = remainingLabel(new Date(schedule.ends_at).getTime());
  }

  const act = async (fn: () => Promise<{ success: boolean; error?: string }>, ok: string, failPrefix: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (r.success) { notify({ type: 'success', message: ok }); await refresh(); }
    else notify({ type: 'error', message: `${failPrefix}: ${r.error}` });
  };

  const bName = cat?.building_name || b.building_code;

  const handleRun = () => {
    const runs = parseInt(runCount, 10);
    if (isNaN(runs) || runs <= 0) { notify({ type: 'error', message: 'Enter a valid number of runs' }); return; }
    act(() => gameClient.run_process(b.this_building_id, runs), `Started ${runs} run(s) of ${proc?.proc_name ?? 'process'}`, 'Run failed');
  };
  const handleUninstall = () => {
    if (!window.confirm(`Uninstall '${proc?.proc_name}' from '${bName}'?`)) return;
    act(() => gameClient.uninstall_process(b.this_building_id), `Uninstalling ${proc?.proc_name}`, 'Uninstall failed');
  };
  const handleAutorun = () => {
    if (b.b_proc_autorun) act(() => gameClient.deactivate_autorun(b.this_building_id), 'Autorun disabled', 'Failed');
    else act(() => gameClient.activate_autorun(b.this_building_id), 'Autorun enabled', 'Failed');
  };
  const handleDemolish = () => {
    if (!window.confirm(`Demolish '${bName}'? Building space is recovered. This cannot be undone.`)) return;
    act(() => gameClient.demolish_building(b.this_building_id), `Demolished ${bName}`, 'Demolish failed');
  };

  return (
    <Card pad hover>
      <div className="bcard">
        <div className="bcard__head">
          <span className="bcard__title">
            <span className="ui-icon ui-icon--md">{buildingIcon(cat?.building_code)}</span>
            <strong>{bName}</strong>
            <span className="bcard__id">#{b.this_building_id}</span>
          </span>
          <Badge tone={status.tone} dot>{status.label}</Badge>
        </div>

        {timer && <div className="bcard__timer">⏳ {timer}</div>}

        {!underConstruction && (
          hasProc && b.b_proc_installed ? (
            <>
              <RecipeCard procId={b.b_proc_installed} />
              <div className="bcard__actions">
                <span className="runbox">
                  <input className="factory-input" type="number" min="1" value={runCount}
                    onChange={(e) => setRunCount(e.target.value)} disabled={!isIdle || busy} />
                  <button className="ui-btn ui-btn--primary ui-btn--sm" onClick={handleRun} disabled={!isIdle || busy}>▶ Run</button>
                </span>
                <button className="ui-btn ui-btn--sm" onClick={handleAutorun} disabled={busy}>
                  {b.b_proc_autorun ? '⏹ Autorun off' : '🔄 Autorun on'}
                </button>
                <button className="ui-btn ui-btn--sm" onClick={handleUninstall} disabled={!isIdle || busy}>🗑 Uninstall</button>
              </div>
            </>
          ) : (
            <>
              <div className="bcard__empty">No process installed</div>
              <div className="bcard__actions">
                <button className="ui-btn ui-btn--primary ui-btn--sm" onClick={() => onInstall(b)} disabled={busy}>⚙ Install process</button>
                <button className="ui-btn ui-btn--danger ui-btn--sm" onClick={handleDemolish} disabled={busy}>🔨 Demolish</button>
              </div>
            </>
          )
        )}
      </div>
    </Card>
  );
}
