import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../api/supabase';
import type {
  ProcessCatalogue,
  ProcessInput,
  ProcessOutput,
  MaterialCatalogue,
  BuildingCatalogue,
  AllowedProcess,
} from '../types';

interface ProcessWithDetails extends ProcessCatalogue {
  inputs: Array<ProcessInput & { material: MaterialCatalogue }>;
  outputs: Array<ProcessOutput & { material: MaterialCatalogue }>;
  compatibleBuildings: BuildingCatalogue[];
}

export function ProcessEncyclopediaPage() {
  const [processes, setProcesses] = useState<ProcessCatalogue[]>([]);
  const [inputs, setInputs] = useState<ProcessInput[]>([]);
  const [outputs, setOutputs] = useState<ProcessOutput[]>([]);
  const [materials, setMaterials] = useState<MaterialCatalogue[]>([]);
  const [buildings, setBuildings] = useState<BuildingCatalogue[]>([]);
  const [allowedProcs, setAllowedProcs] = useState<AllowedProcess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter state
  const [filterInputMaterial, setFilterInputMaterial] = useState<number | null>(null);
  const [filterOutputMaterial, setFilterOutputMaterial] = useState<number | null>(null);
  const [filterName, setFilterName] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterBuilding, setFilterBuilding] = useState<number | null>(null);

  // Fetch all data upfront
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      setError('');

      try {
        const [processesResult, inputsResult, outputsResult, materialsResult, buildingsResult, allowedProcsResult] =
          await Promise.all([
            supabase.from('process_catalogue').select('*'),
            supabase.from('process_inputs').select('*'),
            supabase.from('process_outputs').select('*'),
            supabase.from('materials_catalogue').select('*'),
            supabase.from('buildings_catalogue').select('*'),
            supabase.from('buildings_allowed_processes').select('*'),
          ]);

        if (processesResult.error) throw processesResult.error;
        if (inputsResult.error) throw inputsResult.error;
        if (outputsResult.error) throw outputsResult.error;
        if (materialsResult.error) throw materialsResult.error;
        if (buildingsResult.error) throw buildingsResult.error;
        if (allowedProcsResult.error) throw allowedProcsResult.error;

        setProcesses((processesResult.data as ProcessCatalogue[]) || []);
        setInputs((inputsResult.data as ProcessInput[]) || []);
        setOutputs((outputsResult.data as ProcessOutput[]) || []);
        setMaterials((materialsResult.data as MaterialCatalogue[]) || []);
        setBuildings((buildingsResult.data as BuildingCatalogue[]) || []);
        setAllowedProcs((allowedProcsResult.data as AllowedProcess[]) || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  // Create lookup maps
  const materialsMap = useMemo(() => {
    const map = new Map<number, MaterialCatalogue>();
    materials.forEach((mat) => map.set(mat.res_id, mat));
    return map;
  }, [materials]);

  const buildingsMap = useMemo(() => {
    const map = new Map<number, BuildingCatalogue>();
    buildings.forEach((bld) => map.set(bld.building_id, bld));
    return map;
  }, [buildings]);

  // Build process details with inputs/outputs and compatible buildings
  const processesWithDetails = useMemo((): ProcessWithDetails[] => {
    return processes.map((proc) => {
      // Get inputs with material info
      const processInputs = inputs
        .filter((inp) => inp.proc_id === proc.proc_id)
        .map((inp) => ({
          ...inp,
          material: materialsMap.get(inp.res_id)!,
        }))
        .filter((inp) => inp.material); // Filter out any missing materials

      // Get outputs with material info
      const processOutputs = outputs
        .filter((out) => out.proc_id === proc.proc_id)
        .map((out) => ({
          ...out,
          material: materialsMap.get(out.res_id)!,
        }))
        .filter((out) => out.material); // Filter out any missing materials

      // Get compatible buildings
      const compatibleBuildingIds = allowedProcs
        .filter((ap) => ap.allow_proc === proc.proc_id)
        .map((ap) => ap.building_id);
      const compatibleBuildings = compatibleBuildingIds
        .map((id) => buildingsMap.get(id))
        .filter((bld) => bld !== undefined) as BuildingCatalogue[];

      return {
        ...proc,
        inputs: processInputs,
        outputs: processOutputs,
        compatibleBuildings,
      };
    });
  }, [processes, inputs, outputs, allowedProcs, materialsMap, buildingsMap]);

  // Filter processes
  const filteredProcesses = useMemo(() => {
    return processesWithDetails.filter((proc) => {
      // Filter by input material
      if (filterInputMaterial !== null) {
        const hasInput = proc.inputs.some((inp) => inp.res_id === filterInputMaterial);
        if (!hasInput) return false;
      }

      // Filter by output material
      if (filterOutputMaterial !== null) {
        const hasOutput = proc.outputs.some((out) => out.res_id === filterOutputMaterial);
        if (!hasOutput) return false;
      }

      // Filter by name
      if (filterName.trim()) {
        const nameMatch = proc.proc_name.toLowerCase().includes(filterName.toLowerCase());
        if (!nameMatch) return false;
      }

      // Filter by category
      if (filterCategory) {
        if (proc.proc_category !== filterCategory) return false;
      }

      // Filter by building
      if (filterBuilding !== null) {
        const compatible = proc.compatibleBuildings.some((bld) => bld.building_id === filterBuilding);
        if (!compatible) return false;
      }

      return true;
    });
  }, [processesWithDetails, filterInputMaterial, filterOutputMaterial, filterName, filterCategory, filterBuilding]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    processes.forEach((proc) => cats.add(proc.proc_category));
    return Array.from(cats).sort();
  }, [processes]);

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString();
  };

  const getPhaseBadgeColor = (phase: string) => {
    switch (phase?.toLowerCase()) {
      case 'solid':
        return '#8B4513'; // Brown
      case 'fluid':
        return '#4169E1'; // Royal Blue
      case 'gas':
        return '#87CEEB'; // Sky Blue
      default:
        return '#999';
    }
  };

  if (loading) {
    return <div className="loading">Loading Process Encyclopedia...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="process-encyclopedia-page">
      <h2>📚 Process Encyclopedia</h2>

      {/* Filters Section */}
      <section className="encyclopedia-filters">
        <h3>Filters</h3>
        <div className="filters-grid">
          <div className="filter-group">
            <label>
              Search by Name:
              <input
                type="text"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="Process name..."
                style={{ width: '100%', marginTop: '5px' }}
              />
            </label>
          </div>

          <div className="filter-group">
            <label>
              Category:
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                style={{ width: '100%', marginTop: '5px' }}
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="filter-group">
            <label>
              Filter by Input Material:
              <select
                value={filterInputMaterial || ''}
                onChange={(e) => setFilterInputMaterial(e.target.value ? parseInt(e.target.value) : null)}
                style={{ width: '100%', marginTop: '5px' }}
              >
                <option value="">All Materials</option>
                {materials.map((mat) => (
                  <option key={mat.res_id} value={mat.res_id}>
                    {mat.res_name} ({mat.res_phase})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="filter-group">
            <label>
              Filter by Output Material:
              <select
                value={filterOutputMaterial || ''}
                onChange={(e) => setFilterOutputMaterial(e.target.value ? parseInt(e.target.value) : null)}
                style={{ width: '100%', marginTop: '5px' }}
              >
                <option value="">All Materials</option>
                {materials.map((mat) => (
                  <option key={mat.res_id} value={mat.res_id}>
                    {mat.res_name} ({mat.res_phase})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="filter-group">
            <label>
              Filter by Building:
              <select
                value={filterBuilding || ''}
                onChange={(e) => setFilterBuilding(e.target.value ? parseInt(e.target.value) : null)}
                style={{ width: '100%', marginTop: '5px' }}
              >
                <option value="">All Buildings</option>
                {buildings.map((bld) => (
                  <option key={bld.building_id} value={bld.building_id}>
                    {bld.building_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="filter-group">
            <button
              onClick={() => {
                setFilterInputMaterial(null);
                setFilterOutputMaterial(null);
                setFilterName('');
                setFilterCategory('');
                setFilterBuilding(null);
              }}
              className="btn-secondary"
              style={{ width: '100%', marginTop: '25px' }}
            >
              Clear All Filters
            </button>
          </div>
        </div>

        <div className="filter-results-count" style={{ marginTop: '15px', color: '#666', fontSize: '14px' }}>
          Showing {filteredProcesses.length} of {processes.length} processes
        </div>
      </section>

      {/* Processes List */}
      <section className="processes-list">
        <h3>Processes ({filteredProcesses.length})</h3>
        {filteredProcesses.length === 0 ? (
          <div className="empty-state">No processes match the current filters.</div>
        ) : (
          <div className="process-cards">
            {filteredProcesses.map((proc) => (
              <div key={proc.proc_id} className="process-card">
                <div className="process-card-header">
                  <h4>{proc.proc_name}</h4>
                  <span className="process-id">ID: {proc.proc_id}</span>
                </div>

                <div className="process-badges">
                  <span className="category-badge" style={{ backgroundColor: '#e3e9f7' }}>
                    {proc.proc_category}
                  </span>
                </div>

                <div className="process-details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Install Cost:</span>
                    <span className="detail-value">{formatNumber(proc.proc_install_cost)} cash</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Install Time:</span>
                    <span className="detail-value">{proc.proc_install_time} min</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Run Cost:</span>
                    <span className="detail-value">{formatNumber(proc.proc_run_cost)} cash</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Run Time:</span>
                    <span className="detail-value">{proc.proc_run_time} min</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Pollution:</span>
                    <span className="detail-value" style={{ color: '#d32f2f' }}>
                      {formatNumber(proc.proc_run_pollut)}
                    </span>
                  </div>
                </div>

                {/* Inputs */}
                <div className="process-io-section">
                  <h5>Inputs:</h5>
                  {proc.inputs.length === 0 ? (
                    <div className="io-empty">No inputs</div>
                  ) : (
                    <div className="io-list">
                      {proc.inputs.map((inp) => (
                        <div key={inp.res_id} className="io-item">
                          <span className="material-name">{inp.material.res_name}</span>
                          <span className="material-amount">×{formatNumber(inp.amount)}</span>
                          <span
                            className="phase-badge"
                            style={{
                              backgroundColor: getPhaseBadgeColor(inp.material.res_phase),
                              color: 'white',
                            }}
                          >
                            {inp.material.res_phase}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Outputs */}
                <div className="process-io-section">
                  <h5>Outputs:</h5>
                  {proc.outputs.length === 0 ? (
                    <div className="io-empty">No outputs</div>
                  ) : (
                    <div className="io-list">
                      {proc.outputs.map((out) => (
                        <div key={out.res_id} className="io-item">
                          <span className="material-name">{out.material.res_name}</span>
                          <span className="material-amount">×{formatNumber(out.amount)}</span>
                          <span
                            className="phase-badge"
                            style={{
                              backgroundColor: getPhaseBadgeColor(out.material.res_phase),
                              color: 'white',
                            }}
                          >
                            {out.material.res_phase}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Compatible Buildings */}
                <div className="process-buildings-section">
                  <h5>Compatible Buildings:</h5>
                  {proc.compatibleBuildings.length === 0 ? (
                    <div className="io-empty">No compatible buildings</div>
                  ) : (
                    <div className="buildings-list">
                      {proc.compatibleBuildings.map((bld) => (
                        <span key={bld.building_id} className="building-badge">
                          {bld.building_name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
