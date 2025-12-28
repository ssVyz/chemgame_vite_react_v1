import { useEffect, useState, useCallback, useMemo } from 'react';
import { gameClient } from '../api/gameClient';
import { useGame } from '../context/GameContext';
import type { PlayerBuilding, BuildingCatalogue, StorageExtensionCatalogue, PlayerStorageExtension, Player, PlayerTechnologyInventory } from '../types';

export function BuildingsPage() {
  const { buildingsCatalogue, processCatalogue, lastRefresh } = useGame();
  const [buildings, setBuildings] = useState<PlayerBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Selection state
  const [selectedBuilding, setSelectedBuilding] = useState<PlayerBuilding | null>(null);
  const [selectedCatalogueBuilding, setSelectedCatalogueBuilding] = useState<BuildingCatalogue | null>(null);

  // Storage Extensions state
  const [player, setPlayer] = useState<Player | null>(null);
  const [storageExtensionsCatalogue, setStorageExtensionsCatalogue] = useState<StorageExtensionCatalogue[]>([]);
  const [playerStorageExtensions, setPlayerStorageExtensions] = useState<PlayerStorageExtension[]>([]);
  const [selectedCatalogueExtension, setSelectedCatalogueExtension] = useState<StorageExtensionCatalogue | null>(null);
  const [selectedPlayerExtension, setSelectedPlayerExtension] = useState<PlayerStorageExtension | null>(null);
  const [storageExtensionsStatus, setStorageExtensionsStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [playerTech, setPlayerTech] = useState<PlayerTechnologyInventory[]>([]);
  const [showUnavailableBuildings, setShowUnavailableBuildings] = useState(false);

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

    // Load player data for storage extensions
    const playerResult = await gameClient.get_player_data();
    if (playerResult.success && playerResult.data) {
      setPlayer(playerResult.data);
    }

    // Load storage extensions catalogue
    const catalogueResult = await gameClient.get_storage_extensions_catalogue();
    if (catalogueResult.success && catalogueResult.data) {
      setStorageExtensionsCatalogue(catalogueResult.data);
    }

    // Load player storage extensions
    const extensionsResult = await gameClient.get_player_storage_extensions();
    if (extensionsResult.success && extensionsResult.data) {
      setPlayerStorageExtensions(extensionsResult.data);
    }

    // Load player technology inventory
    const techResult = await gameClient.get_player_technology_inventory();
    if (techResult.success && techResult.data) {
      setPlayerTech(techResult.data);
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

  // Storage Extensions handlers
  const handleBuildStorageExtension = async () => {
    if (!selectedCatalogueExtension) {
      setStorageExtensionsStatus({ type: 'error', message: 'Please select a storage extension to build' });
      return;
    }

    if (!window.confirm(`Build '${selectedCatalogueExtension.s_extension_name}'?`)) {
      return;
    }

    const result = await gameClient.build_new_storage_extension(selectedCatalogueExtension.s_extension_id);
    if (result.success) {
      setStorageExtensionsStatus({ type: 'success', message: `Started construction of ${selectedCatalogueExtension.s_extension_name}` });
      loadData();
    } else {
      // Parse error message for user-friendly feedback
      let errorMsg = result.error || 'Failed to build storage extension';
      if (errorMsg.toLowerCase().includes('not enough cash')) {
        errorMsg = 'Not enough cash to build this storage extension';
      } else if (errorMsg.toLowerCase().includes('not enough building space')) {
        errorMsg = 'Not enough building space to build this storage extension';
      }
      setStorageExtensionsStatus({ type: 'error', message: errorMsg });
    }
  };

  const handleDemolishStorageExtension = async () => {
    if (!selectedPlayerExtension) {
      setStorageExtensionsStatus({ type: 'error', message: 'Please select a storage extension to demolish' });
      return;
    }

    if (selectedPlayerExtension.s_ext_current_status !== 'completed') {
      setStorageExtensionsStatus({
        type: 'error',
        message: 'Only completed storage extensions can be demolished',
      });
      return;
    }

    const extensionInfo = storageExtensionsCatalogue.find(ext => ext.s_extension_id === selectedPlayerExtension.s_extension_id);
    const extensionName = extensionInfo?.s_extension_name || `Extension ${selectedPlayerExtension.s_extension_id}`;

    if (!window.confirm(
      `Demolish '${extensionName}' (ID: ${selectedPlayerExtension.this_s_extension_id})?\n\nThis action cannot be undone.`
    )) {
      return;
    }

    const result = await gameClient.demolish_storage_extension(selectedPlayerExtension.this_s_extension_id);
    if (result.success) {
      setStorageExtensionsStatus({ type: 'success', message: `Demolished '${extensionName}'` });
      setSelectedPlayerExtension(null);
      loadData();
    } else {
      // Parse error message for user-friendly feedback
      let errorMsg = result.error || 'Failed to demolish storage extension';
      if (errorMsg.toLowerCase().includes('cannot remove')) {
        errorMsg = 'Cannot demolish: Storage is in use. Free up materials first.';
      }
      setStorageExtensionsStatus({ type: 'error', message: errorMsg });
    }
  };

  // Calculate remaining build time for storage extension
  const getRemainingBuildTime = (extension: PlayerStorageExtension, catalogue: StorageExtensionCatalogue | undefined): number | null => {
    if (extension.s_ext_current_status === 'completed' || extension.s_ext_finished_building) {
      return null;
    }
    if (!catalogue) return null;

    const startTime = new Date(extension.created_at).getTime();
    const buildTimeMs = catalogue.s_extension_build_time * 60 * 1000;
    const endTime = startTime + buildTimeMs;
    const now = Date.now();
    const remaining = endTime - now;

    return remaining > 0 ? Math.ceil(remaining / 1000 / 60) : 0;
  };

  // Filter buildings based on tech requirements
  const completedTechIds = useMemo(() => {
    return new Set(
      playerTech.filter((pt) => pt.tech_status === 'completed').map((pt) => pt.tech_id)
    );
  }, [playerTech]);

  const isBuildingAvailable = useCallback((building: BuildingCatalogue): boolean => {
    // If no tech requirement, building is available
    if (building.building_tech_req === null || building.building_tech_req === undefined) {
      return true;
    }
    // Check if player has completed the required tech
    return completedTechIds.has(building.building_tech_req);
  }, [completedTechIds]);

  const catalogueArray = useMemo(() => {
    const allBuildings = Array.from(buildingsCatalogue.values());
    if (showUnavailableBuildings) {
      return allBuildings;
    }
    return allBuildings.filter(isBuildingAvailable);
  }, [buildingsCatalogue, showUnavailableBuildings, isBuildingAvailable]);

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
          <div style={{ marginBottom: '10px' }}>
            <label>
              <input
                type="checkbox"
                checked={showUnavailableBuildings}
                onChange={(e) => setShowUnavailableBuildings(e.target.checked)}
              />
              {' '}Show also unavailable
            </label>
          </div>
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
              {catalogueArray.map((bld) => {
                const isAvailable = isBuildingAvailable(bld);
                return (
                  <option key={bld.building_id} value={bld.building_id}>
                    [{bld.building_id}] {bld.building_name} {!isAvailable ? '(Requires Tech)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {selectedCatalogueBuilding && (
            <div className="building-details">
              <p><strong>Name:</strong> {selectedCatalogueBuilding.building_name}</p>
              <p><strong>Code:</strong> {selectedCatalogueBuilding.building_code}</p>
              <p><strong>Cost:</strong> {formatNumber(selectedCatalogueBuilding.building_cost)} cash</p>
              <p><strong>Space Required:</strong> {selectedCatalogueBuilding.building_space_req}</p>
              <p><strong>Build Time:</strong> {selectedCatalogueBuilding.building_build_time} minutes</p>
              {selectedCatalogueBuilding.building_tech_req !== null && selectedCatalogueBuilding.building_tech_req !== undefined && (
                <p>
                  <strong>Tech Required:</strong> Tech ID {selectedCatalogueBuilding.building_tech_req}
                  {!isBuildingAvailable(selectedCatalogueBuilding) && (
                    <span style={{ color: '#d32f2f', marginLeft: '8px' }}>(Not Researched)</span>
                  )}
                </p>
              )}
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

      {/* Storage Extensions Section */}
      <section className="storage-extensions-section" style={{ marginTop: '40px' }}>
        <h3>📦 Storage Extensions</h3>

        <div className="buildings-layout">
          {/* Left: Player's Storage Extensions */}
          <section className="current-storage-extensions">
            <h4>Your Storage Extensions</h4>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Extension</th>
                  <th>Status</th>
                  <th>Remaining Time</th>
                </tr>
              </thead>
              <tbody>
                {playerStorageExtensions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty-row">No storage extensions yet</td>
                  </tr>
                ) : (
                  playerStorageExtensions.map((ext) => {
                    const extensionInfo = storageExtensionsCatalogue.find(cat => cat.s_extension_id === ext.s_extension_id);
                    const remainingTime = getRemainingBuildTime(ext, extensionInfo);
                    const isCompleted = ext.s_ext_current_status === 'completed' || ext.s_ext_finished_building;

                    return (
                      <tr
                        key={ext.this_s_extension_id}
                        onClick={() => setSelectedPlayerExtension(ext)}
                        className={selectedPlayerExtension?.this_s_extension_id === ext.this_s_extension_id ? 'selected' : ''}
                      >
                        <td>{ext.this_s_extension_id}</td>
                        <td>{extensionInfo?.s_extension_name || `Extension ${ext.s_extension_id}`}</td>
                        <td>{isCompleted ? 'Completed' : 'Under Construction'}</td>
                        <td>
                          {isCompleted ? '-' : remainingTime !== null ? `${remainingTime} min` : 'Ready'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            <div className="demolish-controls">
              <button onClick={handleDemolishStorageExtension} className="btn-danger" disabled={!selectedPlayerExtension}>
                🔨 Demolish Selected Extension
              </button>
              <span className="hint">(Only completed extensions can be demolished)</span>
            </div>
          </section>

          {/* Right: Build New Storage Extension */}
          <section className="build-new-storage-extension">
            <h4>Build New Storage Extension</h4>
            <div className="catalogue-list">
              <label>Available Extensions:</label>
              <select
                size={8}
                value={selectedCatalogueExtension?.s_extension_id || ''}
                onChange={(e) => {
                  const id = parseInt(e.target.value);
                  setSelectedCatalogueExtension(storageExtensionsCatalogue.find(ext => ext.s_extension_id === id) || null);
                }}
              >
                {storageExtensionsCatalogue.map((ext) => (
                  <option key={ext.s_extension_id} value={ext.s_extension_id}>
                    [{ext.s_extension_id}] {ext.s_extension_name}
                  </option>
                ))}
              </select>
            </div>

            {selectedCatalogueExtension && (
              <div className="building-details">
                <p><strong>Name:</strong> {selectedCatalogueExtension.s_extension_name}</p>
                <p><strong>Code:</strong> {selectedCatalogueExtension.s_extension_code}</p>
                <p><strong>Cost:</strong> {formatNumber(selectedCatalogueExtension.s_extension_cost)} cash</p>
                <p><strong>Space Required:</strong> {selectedCatalogueExtension.s_extension_space_req}</p>
                <p><strong>Build Time:</strong> {selectedCatalogueExtension.s_extension_build_time} minutes</p>
                <p><strong>Adds Storage:</strong></p>
                <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
                  <li>Dry: {formatNumber(selectedCatalogueExtension.s_extension_add_dry_storage)}</li>
                  <li>Fluid: {formatNumber(selectedCatalogueExtension.s_extension_add_fluid_storage)}</li>
                  <li>Gas: {formatNumber(selectedCatalogueExtension.s_extension_add_gas_storage)}</li>
                </ul>
              </div>
            )}

            <button
              onClick={handleBuildStorageExtension}
              className="btn-primary"
              disabled={
                !selectedCatalogueExtension ||
                !player ||
                (player.player_cash < (selectedCatalogueExtension?.s_extension_cost || 0)) ||
                ((player.building_space - player.build_space_occupied) < (selectedCatalogueExtension?.s_extension_space_req || 0))
              }
            >
              Build Selected
            </button>
            {selectedCatalogueExtension && player && (
              <div style={{ marginTop: '10px', fontSize: '0.9em', color: '#666' }}>
                {player.player_cash < selectedCatalogueExtension.s_extension_cost && (
                  <div style={{ color: '#d32f2f' }}>Insufficient cash</div>
                )}
                {(player.building_space - player.build_space_occupied) < selectedCatalogueExtension.s_extension_space_req && (
                  <div style={{ color: '#d32f2f' }}>Insufficient building space</div>
                )}
              </div>
            )}
          </section>
        </div>

        {storageExtensionsStatus && (
          <div className={`status-message ${storageExtensionsStatus.type}`} style={{ marginTop: '15px' }}>
            {storageExtensionsStatus.message}
          </div>
        )}
      </section>
    </div>
  );
}
