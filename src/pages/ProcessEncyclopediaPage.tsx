import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { Card } from '../components/ui';
import { RecipeCard } from '../components/game/RecipeCard';
import { buildingIcon } from '../lib/icons';
import { useHashFocus } from '../lib/useHashFocus';

export function ProcessEncyclopediaPage() {
  const {
    processCatalogue, materialsCatalogue, buildingsCatalogue,
    allowedProcesses, technologyCatalogue, getRecipe, cataloguesLoaded,
  } = useGame();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [inputMat, setInputMat] = useState('');
  const [outputMat, setOutputMat] = useState('');
  const [building, setBuilding] = useState('');

  useHashFocus(cataloguesLoaded);

  // proc_id -> building_id[] (reverse of allowedProcesses)
  const procToBuildings = useMemo(() => {
    const m = new Map<number, number[]>();
    allowedProcesses.forEach((procIds, bId) => {
      procIds.forEach((pId) => {
        const arr = m.get(pId);
        if (arr) arr.push(bId); else m.set(pId, [bId]);
      });
    });
    return m;
  }, [allowedProcesses]);

  const processes = useMemo(
    () => Array.from(processCatalogue.values()).sort((a, b) => a.proc_name.localeCompare(b.proc_name)),
    [processCatalogue],
  );
  const categories = useMemo(
    () => Array.from(new Set(processes.map((p) => p.proc_category))).sort(),
    [processes],
  );
  const materials = useMemo(
    () => Array.from(materialsCatalogue.values()).sort((a, b) => a.res_name.localeCompare(b.res_name)),
    [materialsCatalogue],
  );

  const filtered = useMemo(() => {
    const q = name.trim().toLowerCase();
    const inId = inputMat ? parseInt(inputMat, 10) : null;
    const outId = outputMat ? parseInt(outputMat, 10) : null;
    const bId = building ? parseInt(building, 10) : null;
    return processes.filter((p) => {
      if (q && !p.proc_name.toLowerCase().includes(q)) return false;
      if (category && p.proc_category !== category) return false;
      const { inputs, outputs } = getRecipe(p.proc_id);
      if (inId != null && !inputs.some((i) => i.res_id === inId)) return false;
      if (outId != null && !outputs.some((o) => o.res_id === outId)) return false;
      if (bId != null && !(procToBuildings.get(p.proc_id) ?? []).includes(bId)) return false;
      return true;
    });
  }, [processes, name, category, inputMat, outputMat, building, getRecipe, procToBuildings]);

  const clear = () => { setName(''); setCategory(''); setInputMat(''); setOutputMat(''); setBuilding(''); };

  if (!cataloguesLoaded) return <div className="loading">Loading encyclopedia…</div>;

  return (
    <div className="ui-page">
      <div className="ui-page-head"><h2>📚 Process Encyclopedia</h2></div>

      <section className="ui-section">
        <Card pad>
          <div className="filters">
            <label>Search
              <input className="filter-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Process name…" />
            </label>
            <label>Category
              <select className="filter-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>Input material
              <select className="filter-select" value={inputMat} onChange={(e) => setInputMat(e.target.value)}>
                <option value="">Any</option>
                {materials.map((m) => <option key={m.res_id} value={m.res_id}>{m.res_name}</option>)}
              </select>
            </label>
            <label>Output material
              <select className="filter-select" value={outputMat} onChange={(e) => setOutputMat(e.target.value)}>
                <option value="">Any</option>
                {materials.map((m) => <option key={m.res_id} value={m.res_id}>{m.res_name}</option>)}
              </select>
            </label>
            <label>Building
              <select className="filter-select" value={building} onChange={(e) => setBuilding(e.target.value)}>
                <option value="">Any</option>
                {Array.from(buildingsCatalogue.values()).map((b) => <option key={b.building_id} value={b.building_id}>{b.building_name}</option>)}
              </select>
            </label>
            <button className="ui-btn" onClick={clear}>Clear filters</button>
          </div>
          <div className="ui-faint" style={{ marginTop: 'var(--sp-2)', fontSize: 'var(--fs-sm)' }}>
            Showing {filtered.length} of {processes.length} processes
          </div>
        </Card>
      </section>

      <section className="ui-section">
        {filtered.length === 0 ? (
          <Card pad><div className="ui-empty">No processes match the current filters.</div></Card>
        ) : (
          <div className="ui-grid ui-grid--wide">
            {filtered.map((p) => {
              const tech = p.proc_tech_req != null ? technologyCatalogue.get(p.proc_tech_req) : undefined;
              const buildings = (procToBuildings.get(p.proc_id) ?? [])
                .map((id) => buildingsCatalogue.get(id))
                .filter((b): b is NonNullable<typeof b> => !!b);
              return (
                <Card key={p.proc_id} pad hover>
                  <div id={`proc-${p.proc_id}`}>
                    <RecipeCard procId={p.proc_id} showInstallMeta />
                    <div className="unlocks" style={{ marginTop: 'var(--sp-3)' }}>
                      {p.proc_tech_req != null && (
                        <div className="unlocks__row">
                          <span className="unlocks__label">Requires</span>
                          <Link className="xchip" to={`/research#tech-${p.proc_tech_req}`}>
                            🔬 {tech?.tech_name ?? `Tech ${p.proc_tech_req}`}
                          </Link>
                        </div>
                      )}
                      <div className="unlocks__row">
                        <span className="unlocks__label">Runs in</span>
                        {buildings.length === 0 ? <span className="ui-faint" style={{ fontSize: 'var(--fs-xs)' }}>—</span>
                          : buildings.map((b) => (
                            <span key={b.building_id} className="xchip xchip--locked" style={{ cursor: 'default' }}>
                              {buildingIcon(b.building_code)} {b.building_name}
                            </span>
                          ))}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
