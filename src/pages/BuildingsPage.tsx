import { useEffect, useState, useCallback } from 'react';
import { gameClient } from '../api/gameClient';
import { useGame } from '../context/GameContext';
import type { PlayerBuilding, BuildingCatalogue } from '../types';

export function BuildingsPage() {
  const { buildingsCatalogue, processCatalogue, lastRefresh } = useGame();
  const [buildings, setBuildings] = useState<PlayerBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Selection state
  const [selectedBuilding, setSelectedBuilding] = useState<PlayerBuilding | null>(null);
  const [selectedCatalogueBuilding, setSelectedCatalogueBuilding] = useState<BuildingCatalogue | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    const result = await gameClient.get_player_buildings();
    if (result.success && result.data) {
      // Sort by building_id first, then this_building_id
      const sorted = [...result.data].sort((a, b) => {
        if (a.building_id !== b.building_id) {
          return a.building_id - b.building_id;
        }
        return a.this_building_id - b.this_building_id;
      });
      setBuildings(sorted);
    } else {
      setError(result.error || 'Failed to load buildings');
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, lastRefresh]);

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString();
  };

  const handleBuild = async () => {
    if (!selectedCatalogueBuilding) {
      setStatus({ type: 'error', message: 'Please select a building type to build' });
      return;
    }

    if (!window.confirm(`Build '${selectedCatalogueBuilding.building_name}'?`)) {
      return;
    }

    const result = await gameClient.build_new_building(selectedCatalogueBuilding.building_id);
    if (result.success) {
      setStatus({ type: 'success', message: `Started construction of ${selectedCatalogueBuilding.building_name}` });
      loadData();
    } else {
      setStatus({ type: 'error', message: `Failed to build: ${result.error}` });
    }
  };

  const handleDemolish = async () => {
    if (!selectedBuilding) {
      setStatus({ type: 'error', message: 'Please select a building to demolish' });
      return;
    }

    const buildingInfo = buildingsCatalogue.get(selectedBuilding.building_id);
    const buildingName = buildingInfo?.building_name || selectedBuilding.building_code;

    // Check status
    if (selectedBuilding.b_current_status !== 'unconfigured') {
      setStatus({
        type: 'error',
        message: `Building must be 'unconfigured' to demolish. Current status: ${selectedBuilding.b_current_status}`,
      });
      return;
    }

    // Check no process installed
    if (selectedBuilding.b_proc_installed && selectedBuilding.b_proc_installed !== 0) {
      const procInfo = processCatalogue.get(selectedBuilding.b_proc_installed);
      setStatus({
        type: 'error',
        message: `Building has process '${procInfo?.proc_name || selectedBuilding.b_proc_installed}' installed. Uninstall it first.`,
      });
      return;
    }

    if (!window.confirm(
      `Demolish '${buildingName}' (ID: ${selectedBuilding.this_building_id})?\n\nThis action cannot be undone.\nBuilding space will be recovered.`
    )) {
      return;
    }

    const result = await gameClient.demolish_building(selectedBuilding.this_building_id);
    if (result.success) {
      setStatus({ type: 'success', message: `Demolished '${buildingName}'` });
      setSelectedBuilding(null);
      loadData();
    } else {
      setStatus({ type: 'error', message: `Failed to demolish: ${result.error}` });
    }
  };

  const catalogueArray = Array.from(buildingsCatalogue.values());

  if (loading && buildings.length === 0) {
    return <div className="loading">Loading buildings...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="buildings-page">
      <h2>🏭 Buildings</h2>

      <div className="buildings-layout">
        {/* Left: Current Buildings */}
        <section className="current-buildings">
          <h3>Your Buildings</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Building</th>
                <th>Status</th>
                <th>Installed Process</th>
                <th>Process Status</th>
                <th>Autorun</th>
              </tr>
            </thead>
            <tbody>
              {buildings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-row">No buildings yet</td>
                </tr>
              ) : (
                buildings.map((bld) => {
                  const buildingInfo = buildingsCatalogue.get(bld.building_id);
                  const procId = bld.b_proc_installed;
                  const procInfo = procId ? processCatalogue.get(procId) : null;
                  const autorunStatus = !procId || procId === 0 ? '-' : (bld.b_proc_autorun ? 'ON' : 'OFF');

                  return (
                    <tr
                      key={bld.this_building_id}
                      onClick={() => setSelectedBuilding(bld)}
                      className={selectedBuilding?.this_building_id === bld.this_building_id ? 'selected' : ''}
                    >
                      <td>{bld.this_building_id}</td>
                      <td>{buildingInfo?.building_name || bld.building_code}</td>
                      <td>{bld.b_current_status}</td>
                      <td>{procInfo?.proc_name || (procId ? `Process ${procId}` : '-')}</td>
                      <td>{bld.b_proc_status || '-'}</td>
                      <td>{autorunStatus}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="demolish-controls">
            <button onClick={handleDemolish} className="btn-danger" disabled={!selectedBuilding}>
              🔨 Demolish Selected Building
            </button>
            <span className="hint">(Building must be 'unconfigured' with no process)</span>
          </div>
        </section>

        {/* Right: Build New Building */}
        <section className="build-new">
          <h3>Build New Building</h3>
          <div className="catalogue-list">
            <label>Available Buildings:</label>
            <select
              size={8}
              value={selectedCatalogueBuilding?.building_id || ''}
              onChange={(e) => {
                const id = parseInt(e.target.value);
                setSelectedCatalogueBuilding(buildingsCatalogue.get(id) || null);
              }}
            >
              {catalogueArray.map((bld) => (
                <option key={bld.building_id} value={bld.building_id}>
                  [{bld.building_id}] {bld.building_name}
                </option>
              ))}
            </select>
          </div>

          {selectedCatalogueBuilding && (
            <div className="building-details">
              <p><strong>Name:</strong> {selectedCatalogueBuilding.building_name}</p>
              <p><strong>Code:</strong> {selectedCatalogueBuilding.building_code}</p>
              <p><strong>Cost:</strong> {formatNumber(selectedCatalogueBuilding.building_cost)} cash</p>
              <p><strong>Space Required:</strong> {selectedCatalogueBuilding.building_space_req}</p>
              <p><strong>Build Time:</strong> {selectedCatalogueBuilding.building_build_time} minutes</p>
            </div>
          )}

          <button onClick={handleBuild} className="btn-primary" disabled={!selectedCatalogueBuilding}>
            Build Selected
          </button>
        </section>
      </div>

      {status && (
        <div className={`status-message ${status.type}`}>
          {status.message}
        </div>
      )}
    </div>
  );
}
