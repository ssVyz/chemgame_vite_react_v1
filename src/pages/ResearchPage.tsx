import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { gameClient } from '../api/gameClient';
import { useGame } from '../context/GameContext';
import type { BuildingCatalogue, ProcessCatalogue } from '../types';
import { Card, Badge, MaterialChip } from '../components/ui';
import type { BadgeTone } from '../components/ui';
import { buildingIcon, processIcon } from '../lib/icons';
import { formatNumber, formatMinutes } from '../lib/format';
import { useHashFocus } from '../lib/useHashFocus';
import type { ActionStatus } from '../lib/status';

type TechStatus = 'completed' | 'in_progress' | 'available' | 'locked';

const STATUS_META: Record<TechStatus, { tone: BadgeTone; label: string }> = {
  completed: { tone: 'success', label: '✓ Researched' },
  in_progress: { tone: 'info', label: '⏳ In progress' },
  available: { tone: 'primary', label: '🔓 Available' },
  locked: { tone: 'neutral', label: '🔒 Locked' },
};

export function ResearchPage() {
  const {
    technologyCatalogue, technologyInventory, techRequired, techResearchMaterials,
    completedTechIds, materialsCatalogue, buildingsCatalogue, processCatalogue,
    cataloguesLoaded, refreshPlayer,
  } = useGame();

  const [status, setStatus] = useState<ActionStatus | null>(null);
  const [onlyResearchable, setOnlyResearchable] = useState(false);
  const [now, setNow] = useState(Date.now());

  useHashFocus(cataloguesLoaded);

  // What each tech unlocks
  const unlocks = useMemo(() => {
    const b = new Map<number, BuildingCatalogue[]>();
    const p = new Map<number, ProcessCatalogue[]>();
    buildingsCatalogue.forEach((bld) => {
      if (bld.building_tech_req != null) {
        const arr = b.get(bld.building_tech_req); if (arr) arr.push(bld); else b.set(bld.building_tech_req, [bld]);
      }
    });
    processCatalogue.forEach((proc) => {
      if (proc.proc_tech_req != null) {
        const arr = p.get(proc.proc_tech_req); if (arr) arr.push(proc); else p.set(proc.proc_tech_req, [proc]);
      }
    });
    return { buildings: b, processes: p };
  }, [buildingsCatalogue, processCatalogue]);

  const inv = useMemo(() => {
    const m = new Map<number, (typeof technologyInventory)[number]>();
    technologyInventory.forEach((t) => m.set(t.tech_id, t));
    return m;
  }, [technologyInventory]);

  const techs = useMemo(() => {
    const list = Array.from(technologyCatalogue.values()).map((tech) => {
      const item = inv.get(tech.tech_id);
      const prereqIds = techRequired.get(tech.tech_id) ?? [];
      let st: TechStatus;
      let remaining: number | undefined;
      if (item) {
        if (item.tech_status === 'completed') st = 'completed';
        else {
          st = 'in_progress';
          const elapsedMin = Math.floor((now - new Date(item.created_at).getTime()) / 60000);
          remaining = Math.max(0, tech.tech_time - elapsedMin);
        }
      } else {
        st = prereqIds.length === 0 || prereqIds.some((id) => completedTechIds.has(id)) ? 'available' : 'locked';
      }
      return { tech, status: st, prereqIds, remaining };
    });
    return list.sort((a, b) => a.tech.tech_id - b.tech.tech_id);
  }, [technologyCatalogue, inv, techRequired, completedTechIds, now]);

  const visible = onlyResearchable ? techs.filter((t) => t.status === 'available') : techs;
  const anyInProgress = techs.some((t) => t.status === 'in_progress');

  // Tick remaining time while research is running
  useEffect(() => {
    if (!anyInProgress) return;
    const iv = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(iv);
  }, [anyInProgress]);

  const startResearch = async (techId: number) => {
    const tech = technologyCatalogue.get(techId);
    if (!tech) return;
    if (!window.confirm(`Start research on "${tech.tech_name}"?\n\nCost: ${formatNumber(tech.tech_cost)} cash\nTime: ${formatMinutes(tech.tech_time)}`)) return;
    const r = await gameClient.start_research(techId);
    if (r.success) { setStatus({ type: 'success', message: `Started research: ${tech.tech_name}` }); await refreshPlayer(); }
    else setStatus({ type: 'error', message: `Failed: ${r.error}` });
  };

  if (!cataloguesLoaded) return <div className="loading">Loading research…</div>;

  const counts = {
    done: techs.filter((t) => t.status === 'completed').length,
    prog: techs.filter((t) => t.status === 'in_progress').length,
    avail: techs.filter((t) => t.status === 'available').length,
  };

  return (
    <div className="ui-page">
      <div className="ui-page-head"><h2>🔬 Research</h2></div>

      <div className="factory-toolbar">
        <Badge tone="success">{counts.done} researched</Badge>
        <Badge tone="info">{counts.prog} in progress</Badge>
        <Badge tone="primary">{counts.avail} available</Badge>
        <span className="spacer" />
        <label className="ui-cluster" style={{ gap: 4, fontSize: 'var(--fs-sm)' }}>
          <input type="checkbox" checked={onlyResearchable} onChange={(e) => setOnlyResearchable(e.target.checked)} />
          only researchable
        </label>
      </div>

      {status && <div className={`status-message ${status.type}`} style={{ marginBottom: 'var(--sp-4)' }}>{status.message}</div>}

      {visible.length === 0 ? (
        <Card pad><div className="ui-empty">No technologies match the filter.</div></Card>
      ) : (
        <div className="ui-grid ui-grid--wide">
          {visible.map(({ tech, status: st, prereqIds, remaining }) => {
            const meta = STATUS_META[st];
            const mats = techResearchMaterials.get(tech.tech_id) ?? [];
            const uBuildings = unlocks.buildings.get(tech.tech_id) ?? [];
            const uProcesses = unlocks.processes.get(tech.tech_id) ?? [];
            return (
              <Card key={tech.tech_id} pad hover>
                <div id={`tech-${tech.tech_id}`} className="ui-stack">
                  <div className="ui-row-between">
                    <strong>{tech.tech_name}</strong>
                    <Badge tone={meta.tone} dot>{meta.label}</Badge>
                  </div>
                  <div className="ui-cluster">
                    <Badge>💰 {formatNumber(tech.tech_cost)}</Badge>
                    <Badge>⏱️ {formatMinutes(tech.tech_time)}</Badge>
                    {st === 'in_progress' && remaining != null && <Badge tone="info">⏳ {formatMinutes(remaining)} left</Badge>}
                  </div>

                  {prereqIds.length > 0 && (
                    <div className="unlocks__row">
                      <span className="unlocks__label">Needs any</span>
                      {prereqIds.map((id) => {
                        const done = completedTechIds.has(id);
                        return (
                          <Link key={id} className="xchip" to={`/research#tech-${id}`}>
                            {done ? '✓' : '✗'} {technologyCatalogue.get(id)?.tech_name ?? `Tech ${id}`}
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {mats.length > 0 && (
                    <div className="unlocks__row">
                      <span className="unlocks__label">Materials</span>
                      {mats.map((m) => {
                        const info = materialsCatalogue.get(m.res_id);
                        return <MaterialChip key={m.res_id} name={info?.res_name || `#${m.res_id}`} color1={info?.res_color1} color2={info?.res_color2} amount={m.res_amount} />;
                      })}
                    </div>
                  )}

                  {(uBuildings.length > 0 || uProcesses.length > 0) && (
                    <div className="unlocks">
                      {uBuildings.length > 0 && (
                        <div className="unlocks__row">
                          <span className="unlocks__label">Unlocks 🏭</span>
                          {uBuildings.map((b) => (
                            <span key={b.building_id} className="xchip" style={{ cursor: 'default' }}>
                              {buildingIcon(b.building_code)} {b.building_name}
                            </span>
                          ))}
                        </div>
                      )}
                      {uProcesses.length > 0 && (
                        <div className="unlocks__row">
                          <span className="unlocks__label">Unlocks ⚙️</span>
                          {uProcesses.map((p) => (
                            <Link key={p.proc_id} className="xchip" to={`/process-encyclopedia#proc-${p.proc_id}`}>
                              {processIcon(p.proc_category)} {p.proc_name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {st === 'available' && (
                    <button className="ui-btn ui-btn--primary ui-btn--sm" onClick={() => startResearch(tech.tech_id)}>🔬 Start research</button>
                  )}
                  {st === 'locked' && <div className="ui-faint" style={{ fontSize: 'var(--fs-sm)' }}>Complete a prerequisite to unlock.</div>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
