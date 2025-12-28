import { useEffect, useState, useCallback, useMemo } from 'react';
import { gameClient } from '../api/gameClient';
import { useGame } from '../context/GameContext';
import type { PlayerBuilding, ProcessCatalogue, ProcessInput, ProcessOutput, AllowedProcess, PlayerTechnologyInventory } from '../types';

// Helper function to format building status
const formatBuildingStatus = (status: string) => {
  const statusMap: Record<string, { label: string; color: string; bgColor: string }> = {
    'under_construction': { label: '🏗️ Under Construction', color: '#856404', bgColor: '#fff3cd' },
    'unconfigured': { label: '⚙️ Unconfigured', color: '#0c5460', bgColor: '#d1ecf1' },
    'configured_idle': { label: '✅ Ready (Idle)', color: '#155724', bgColor: '#d4edda' },
    'configured_working': { label: '⚡ Working', color: '#004085', bgColor: '#cce5ff' },
    'cleaning_up': { label: '🧹 Cleaning Up', color: '#856404', bgColor: '#fff3cd' },
    'being_demolished': { label: '🔨 Being Demolished', color: '#721c24', bgColor: '#f8d7da' },
  };
  
  const statusInfo = statusMap[status] || { label: status, color: '#666', bgColor: '#f0f0f0' };
  return statusInfo;
};

// Helper function to format process status
const formatProcessStatus = (status: string | null) => {
  if (!status) return null;
  
  const statusMap: Record<string, { label: string; color: string; bgColor: string }> = {
    'being_installed': { label: '🔧 Installing', color: '#856404', bgColor: '#fff3cd' },
    'idle': { label: '⏸️ Idle', color: '#0c5460', bgColor: '#d1ecf1' },
    'running': { label: '▶️ Running', color: '#155724', bgColor: '#d4edda' },
    'clearing_out': { label: '🧹 Clearing Out', color: '#856404', bgColor: '#fff3cd' },
  };
  
  const statusInfo = statusMap[status] || { label: status, color: '#666', bgColor: '#f0f0f0' };
  return statusInfo;
};

// Helper function to format autorun status
const formatAutorunStatus = (autorun: boolean | null, hasProcess: boolean) => {
  if (!hasProcess) {
    return { label: '-', color: '#999', bgColor: 'transparent' };
  }
  
  if (autorun) {
    return { label: '🔄 ON', color: '#155724', bgColor: '#d4edda' };
  } else {
    return { label: '⏹️ OFF', color: '#721c24', bgColor: '#f8d7da' };
  }
};

export function ProcessesPage() {
  const { buildingsCatalogue, processCatalogue, materialsCatalogue, lastRefresh } = useGame();
  const [buildings, setBuildings] = useState<PlayerBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Selection state
  const [selectedBuilding, setSelectedBuilding] = useState<PlayerBuilding | null>(null);
  const [allowedProcesses, setAllowedProcesses] = useState<ProcessCatalogue[]>([]);
  const [selectedProcess, setSelectedProcess] = useState<ProcessCatalogue | null>(null);
  const [processDetails, setProcessDetails] = useState<{
    inputs: ProcessInput[];
    outputs: ProcessOutput[];
  } | null>(null);

  // Run controls
  const [runCount, setRunCount] = useState('1');
  const [playerTech, setPlayerTech] = useState<PlayerTechnologyInventory[]>([]);
  const [showUnavailableProcesses, setShowUnavailableProcesses] = useState(false);

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

  // Load process details (inputs/outputs)
  const loadProcessDetails = useCallback(async (proc_id: number) => {
    const [inputsResult, outputsResult] = await Promise.all([
      gameClient.get_process_inputs(proc_id),
      gameClient.get_process_outputs(proc_id),
    ]);

    setProcessDetails({
      inputs: inputsResult.success ? inputsResult.data || [] : [],
      outputs: outputsResult.success ? outputsResult.data || [] : [],
    });
  }, []);

  // Filter processes based on tech requirements
  const completedTechIds = useMemo(() => {
    return new Set(
      playerTech.filter((pt) => pt.tech_status === 'completed').map((pt) => pt.tech_id)
    );
  }, [playerTech]);

  const isProcessAvailable = useCallback((process: ProcessCatalogue): boolean => {
    // If no tech requirement, process is available
    if (process.proc_tech_req === null || process.proc_tech_req === undefined) {
      return true;
    }
    // Check if player has completed the required tech
    return completedTechIds.has(process.proc_tech_req);
  }, [completedTechIds]);

  // Get filtered available processes based on tech requirements and checkbox state
  const availableProcesses = useMemo(() => {
    if (showUnavailableProcesses) {
      return allowedProcesses;
    }
    return allowedProcesses.filter(isProcessAvailable);
  }, [allowedProcesses, showUnavailableProcesses, isProcessAvailable]);

  // Auto-select the first available process when processes are available and no process is installed/selected
  // This ensures the Install button is enabled even when there's only one process option
  // This acts as a safety net in case handleBuildingSelect doesn't properly set the process
  useEffect(() => {
    // Only run if we have a building, no installed process, and available processes exist
    if (
      selectedBuilding &&
      selectedBuilding.b_proc_installed === null &&
      availableProcesses.length > 0
    ) {
      // Always select the first available process if none is selected, or if the selected process is not available
      const firstAvailableProcess = availableProcesses[0];
      const shouldSelectFirst = !selectedProcess || 
        !availableProcesses.some(p => p.proc_id === selectedProcess.proc_id);
      
      if (shouldSelectFirst && isProcessAvailable(firstAvailableProcess)) {
        setSelectedProcess(firstAvailableProcess);
        loadProcessDetails(firstAvailableProcess.proc_id);
      }
    }
  }, [selectedBuilding, availableProcesses, selectedProcess, loadProcessDetails, isProcessAvailable]);

  // Additional effect to ensure single available process is always selected
  useEffect(() => {
    if (
      selectedBuilding &&
      selectedBuilding.b_proc_installed === null &&
      availableProcesses.length === 1 &&
      (!selectedProcess || selectedProcess.proc_id !== availableProcesses[0].proc_id)
    ) {
      const firstProcess = availableProcesses[0];
      if (isProcessAvailable(firstProcess)) {
        setSelectedProcess(firstProcess);
        loadProcessDetails(firstProcess.proc_id);
      }
    }
  }, [selectedBuilding, availableProcesses, selectedProcess, loadProcessDetails, isProcessAvailable]);

  const handleBuildingSelect = async (building: PlayerBuilding) => {
    setSelectedBuilding(building);
    setSelectedProcess(null);
    setProcessDetails(null);
    setAllowedProcesses([]); // Clear allowed processes first

    // If building has process installed, load its details
    if (building.b_proc_installed) {
      await loadProcessDetails(building.b_proc_installed);
    }

    // Load allowed processes and auto-select the first one
    const result = await gameClient.get_allowed_processes(building.building_id);
    if (result.success && result.data) {
      const allowedIds = new Set(result.data.map((a: AllowedProcess) => a.allow_proc));
      const allowed = Array.from(processCatalogue.values()).filter((p) => allowedIds.has(p.proc_id));
      
      // Set allowed processes first
      setAllowedProcesses(allowed);

      // Auto-select the first available allowed process so the Install button works immediately
      // This works for buildings with no process installed, regardless of how many processes are available
      // The useEffect will also handle this as a safety net
      if (allowed.length > 0 && building.b_proc_installed === null) {
        // Find first available process (with completed tech requirement)
        const firstAvailableProcess = allowed.find(isProcessAvailable) || allowed[0];
        setSelectedProcess(firstAvailableProcess);
        await loadProcessDetails(firstAvailableProcess.proc_id);
      }
    } else {
      setAllowedProcesses([]);
    }
  };

  const handleProcessSelect = async (process: ProcessCatalogue) => {
    setSelectedProcess(process);
    await loadProcessDetails(process.proc_id);
  };

  const handleInstall = async () => {
    if (!selectedBuilding) {
      setStatus({ type: 'error', message: 'Please select a building' });
      return;
    }

    // Auto-select the single process if there's only one available and none is selected
    let processToInstall = selectedProcess;
    if (!processToInstall && allowedProcesses.length === 1) {
      processToInstall = allowedProcesses[0];
      setSelectedProcess(processToInstall);
      await loadProcessDetails(processToInstall.proc_id);
    }

    if (!processToInstall) {
      setStatus({ type: 'error', message: 'Please select a process' });
      return;
    }

    const buildingInfo = buildingsCatalogue.get(selectedBuilding.building_id);
    const buildingName = buildingInfo?.building_name || selectedBuilding.building_code;

    if (!window.confirm(`Install '${processToInstall.proc_name}' on '${buildingName}'?`)) {
      return;
    }

    const result = await gameClient.install_process(selectedBuilding.this_building_id, processToInstall.proc_id);
    if (result.success) {
      setStatus({ type: 'success', message: `Started installing ${processToInstall.proc_name}` });
      loadData();
    } else {
      setStatus({ type: 'error', message: `Failed to install: ${result.error}` });
    }
  };

  const handleUninstall = async () => {
    if (!selectedBuilding) {
      setStatus({ type: 'error', message: 'Please select a building' });
      return;
    }

    if (!selectedBuilding.b_proc_installed) {
      setStatus({ type: 'error', message: 'This building has no process installed' });
      return;
    }

    if (selectedBuilding.b_proc_status !== 'idle') {
      setStatus({
        type: 'error',
        message: `Process must be idle to uninstall. Current status: ${selectedBuilding.b_proc_status}. Use Refresh to update.`,
      });
      return;
    }

    const procInfo = processCatalogue.get(selectedBuilding.b_proc_installed);
    const procName = procInfo?.proc_name || `Process ${selectedBuilding.b_proc_installed}`;
    const buildingInfo = buildingsCatalogue.get(selectedBuilding.building_id);
    const buildingName = buildingInfo?.building_name || selectedBuilding.building_code;

    if (!window.confirm(`Uninstall '${procName}' from '${buildingName}'?\n\nThe building will enter 'cleaning_up' status.`)) {
      return;
    }

    const result = await gameClient.uninstall_process(selectedBuilding.this_building_id);
    if (result.success) {
      setStatus({ type: 'success', message: `Started uninstalling '${procName}'` });
      loadData();
    } else {
      setStatus({ type: 'error', message: `Failed to uninstall: ${result.error}` });
    }
  };

  const handleRun = async () => {
    if (!selectedBuilding) {
      setStatus({ type: 'error', message: 'Please select a building' });
      return;
    }

    if (!selectedBuilding.b_proc_installed) {
      setStatus({ type: 'error', message: 'This building has no process installed' });
      return;
    }

    if (selectedBuilding.b_proc_status !== 'idle') {
      setStatus({
        type: 'error',
        message: `Process must be idle to run. Current status: ${selectedBuilding.b_proc_status}. Use Refresh to update.`,
      });
      return;
    }

    const runs = parseInt(runCount);
    if (isNaN(runs) || runs <= 0) {
      setStatus({ type: 'error', message: 'Please enter a valid positive number of runs' });
      return;
    }

    const procInfo = processCatalogue.get(selectedBuilding.b_proc_installed);
    const procName = procInfo?.proc_name || `Process ${selectedBuilding.b_proc_installed}`;
    const buildingInfo = buildingsCatalogue.get(selectedBuilding.building_id);
    const buildingName = buildingInfo?.building_name || selectedBuilding.building_code;

    if (!window.confirm(`Run '${procName}' on '${buildingName}'?\n\nNumber of runs: ${runs}`)) {
      return;
    }

    const result = await gameClient.run_process(selectedBuilding.this_building_id, runs);
    if (result.success) {
      setStatus({ type: 'success', message: `Started ${runs} run(s) of '${procName}'` });
      loadData();
    } else {
      setStatus({ type: 'error', message: `Failed to run process: ${result.error}` });
    }
  };

  const handleEnableAutorun = async () => {
    if (!selectedBuilding) {
      setStatus({ type: 'error', message: 'Please select a building' });
      return;
    }

    if (!selectedBuilding.b_proc_installed) {
      setStatus({ type: 'error', message: 'This building has no process installed' });
      return;
    }

    if (selectedBuilding.b_proc_autorun) {
      setStatus({ type: 'error', message: 'Autorun is already enabled for this building' });
      return;
    }

    const procInfo = processCatalogue.get(selectedBuilding.b_proc_installed);
    const procName = procInfo?.proc_name || `Process ${selectedBuilding.b_proc_installed}`;
    const buildingInfo = buildingsCatalogue.get(selectedBuilding.building_id);
    const buildingName = buildingInfo?.building_name || selectedBuilding.building_code;

    if (!window.confirm(
      `Enable autorun for '${procName}' on '${buildingName}'?\n\nThe process will automatically restart when it becomes idle.`
    )) {
      return;
    }

    const result = await gameClient.activate_autorun(selectedBuilding.this_building_id);
    if (result.success) {
      setStatus({ type: 'success', message: `Autorun enabled for '${procName}'` });
      loadData();
    } else {
      setStatus({ type: 'error', message: `Failed to enable autorun: ${result.error}` });
    }
  };

  const handleDisableAutorun = async () => {
    if (!selectedBuilding) {
      setStatus({ type: 'error', message: 'Please select a building' });
      return;
    }

    if (!selectedBuilding.b_proc_installed) {
      setStatus({ type: 'error', message: 'This building has no process installed' });
      return;
    }

    if (!selectedBuilding.b_proc_autorun) {
      setStatus({ type: 'error', message: 'Autorun is already disabled for this building' });
      return;
    }

    const procInfo = processCatalogue.get(selectedBuilding.b_proc_installed);
    const procName = procInfo?.proc_name || `Process ${selectedBuilding.b_proc_installed}`;
    const buildingInfo = buildingsCatalogue.get(selectedBuilding.building_id);
    const buildingName = buildingInfo?.building_name || selectedBuilding.building_code;

    if (!window.confirm(`Disable autorun for '${procName}' on '${buildingName}'?`)) {
      return;
    }

    const result = await gameClient.deactivate_autorun(selectedBuilding.this_building_id);
    if (result.success) {
      setStatus({ type: 'success', message: `Autorun disabled for '${procName}'` });
      loadData();
    } else {
      setStatus({ type: 'error', message: `Failed to disable autorun: ${result.error}` });
    }
  };

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString();
  };

  const getInstalledProcessInfo = () => {
    if (!selectedBuilding?.b_proc_installed) return null;
    const proc = processCatalogue.get(selectedBuilding.b_proc_installed);
    return proc;
  };

  const installedProc = getInstalledProcessInfo();

  if (loading && buildings.length === 0) {
    return <div className="loading">Loading processes...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="processes-page">
      <h2>⚙️ Processes</h2>

      {/* Buildings Table */}
      <section className="buildings-processes">
        <h3>Buildings & Installed Processes</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Building</th>
              <th>Build Status</th>
              <th>Process</th>
              <th>Proc Status</th>
              <th>Autorun</th>
            </tr>
          </thead>
          <tbody>
            {buildings.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-row">No buildings</td>
              </tr>
            ) : (
              buildings.map((bld) => {
                const buildingInfo = buildingsCatalogue.get(bld.building_id);
                const procId = bld.b_proc_installed;
                const procInfo = procId ? processCatalogue.get(procId) : null;
                const hasProcess = procId !== null && procId !== 0;
                
                const buildingStatus = formatBuildingStatus(bld.b_current_status);
                const processStatus = formatProcessStatus(bld.b_proc_status);
                const autorunStatus = formatAutorunStatus(bld.b_proc_autorun, hasProcess);

                return (
                  <tr
                    key={bld.this_building_id}
                    onClick={() => handleBuildingSelect(bld)}
                    className={selectedBuilding?.this_building_id === bld.this_building_id ? 'selected' : ''}
                  >
                    <td>{bld.this_building_id}</td>
                    <td>{buildingInfo?.building_name || bld.building_code}</td>
                    <td>
                      <span 
                        className="status-badge"
                        style={{ 
                          color: buildingStatus.color, 
                          backgroundColor: buildingStatus.bgColor
                        }}
                      >
                        {buildingStatus.label}
                      </span>
                    </td>
                    <td>{procInfo?.proc_name || (procId ? `Process ${procId}` : 'No Process')}</td>
                    <td>
                      {processStatus ? (
                        <span 
                          className="status-badge"
                          style={{ 
                            color: processStatus.color, 
                            backgroundColor: processStatus.bgColor
                          }}
                        >
                          {processStatus.label}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <span 
                        className="status-badge"
                        style={{ 
                          color: autorunStatus.color, 
                          backgroundColor: autorunStatus.bgColor
                        }}
                      >
                        {autorunStatus.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      <div className="processes-layout">
        {/* Left: Run Process Panel */}
        <section className="run-process-panel">
          <h3>▶ Run Process</h3>

          <div className="selected-info">
            <strong>Selected Building:</strong>
            <p>
              {selectedBuilding
                ? `Building #${selectedBuilding.this_building_id}: ${buildingsCatalogue.get(selectedBuilding.building_id)?.building_name || selectedBuilding.building_code}`
                : '(Select a building above)'}
            </p>
            {selectedBuilding && installedProc && (() => {
              const processStatus = formatProcessStatus(selectedBuilding.b_proc_status);
              const hasProcess = selectedBuilding.b_proc_installed && selectedBuilding.b_proc_installed !== 0;
              const autorunStatus = formatAutorunStatus(selectedBuilding.b_proc_autorun, hasProcess);
              
              return (
                <>
                  <p>Process: {installedProc.proc_name}</p>
                  <p>
                    Status:{' '}
                    {processStatus ? (
                      <span 
                        className="status-badge"
                        style={{ 
                          color: processStatus.color, 
                          backgroundColor: processStatus.bgColor
                        }}
                      >
                        {processStatus.label}
                      </span>
                    ) : (
                      '-'
                    )}
                  </p>
                  <p>
                    Autorun:{' '}
                    <span 
                      className="status-badge"
                      style={{ 
                        color: autorunStatus.color, 
                        backgroundColor: autorunStatus.bgColor
                      }}
                    >
                      {autorunStatus.label}
                    </span>
                  </p>
                </>
              );
            })()}
          </div>

          <div className="run-controls">
            <label>
              Number of Runs:
              <input
                type="number"
                value={runCount}
                onChange={(e) => setRunCount(e.target.value)}
                min="1"
                max="9999"
                style={{ width: '80px', marginLeft: '8px' }}
              />
            </label>
          </div>

          <div className="action-buttons">
            <button onClick={handleRun} className="btn-primary" disabled={!selectedBuilding?.b_proc_installed}>
              ▶ RUN PROCESS
            </button>
            <button onClick={handleUninstall} className="btn-secondary" disabled={!selectedBuilding?.b_proc_installed}>
              🗑️ Uninstall
            </button>
          </div>

          <div className="autorun-controls">
            <span>Autorun:</span>
            <button onClick={handleEnableAutorun} className="btn-small" disabled={!selectedBuilding?.b_proc_installed}>
              🔄 Enable
            </button>
            <button onClick={handleDisableAutorun} className="btn-small" disabled={!selectedBuilding?.b_proc_installed}>
              ⏹ Disable
            </button>
            {selectedBuilding?.b_proc_installed && (
              <span className={selectedBuilding.b_proc_autorun ? 'autorun-on' : 'autorun-off'}>
                {selectedBuilding.b_proc_autorun ? 'Autorun is ENABLED' : 'Autorun is DISABLED'}
              </span>
            )}
          </div>

          {/* Process Details */}
          {installedProc && processDetails && (
            <div className="process-details">
              <h4>Process Details:</h4>
              <p>Run Cost: {formatNumber(installedProc.proc_run_cost)} cash per run</p>
              <p>Run Time: {installedProc.proc_run_time} min per run</p>
              <p>Pollution: {installedProc.proc_run_pollut} per run</p>

              {processDetails.inputs.length > 0 && (
                <>
                  <p><strong>Inputs per run:</strong></p>
                  <ul>
                    {processDetails.inputs.map((inp) => {
                      const mat = materialsCatalogue.get(inp.res_id);
                      return (
                        <li key={inp.res_id}>
                          {mat?.res_name || `Material ${inp.res_id}`}: {inp.amount}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              {processDetails.outputs.length > 0 && (
                <>
                  <p><strong>Outputs per run:</strong></p>
                  <ul>
                    {processDetails.outputs.map((out) => {
                      const mat = materialsCatalogue.get(out.res_id);
                      return (
                        <li key={out.res_id}>
                          {mat?.res_name || `Material ${out.res_id}`}: {out.amount}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          )}
        </section>

        {/* Right: Install Process Panel */}
        <section className="install-process-panel">
          <h3>⚙ Install New Process</h3>

          <div style={{ marginBottom: '10px' }}>
            <label>
              <input
                type="checkbox"
                checked={showUnavailableProcesses}
                onChange={(e) => setShowUnavailableProcesses(e.target.checked)}
                disabled={!selectedBuilding}
              />
              {' '}Show also unavailable
            </label>
          </div>

          <div className="process-list">
            <label>Available Processes for Selected Building:</label>
            <select
              size={6}
              value={selectedProcess?.proc_id ? String(selectedProcess.proc_id) : (availableProcesses.length === 1 ? String(availableProcesses[0].proc_id) : '')}
              onChange={(e) => {
                const id = parseInt(e.target.value);
                if (!isNaN(id)) {
                  const proc = allowedProcesses.find((p) => p.proc_id === id);
                  if (proc) handleProcessSelect(proc);
                }
              }}
              onFocus={() => {
                // When select gets focus and there's only one available process, ensure it's selected
                if (availableProcesses.length === 1 && !selectedProcess) {
                  handleProcessSelect(availableProcesses[0]);
                }
              }}
              disabled={!selectedBuilding}
            >
              {availableProcesses.length === 0 ? (
                <option value="">No processes available</option>
              ) : (
                availableProcesses.map((proc) => {
                  const isAvailable = isProcessAvailable(proc);
                  return (
                    <option key={proc.proc_id} value={String(proc.proc_id)}>
                      [{proc.proc_id}] {proc.proc_name} {!isAvailable ? '(Requires Tech)' : ''}
                    </option>
                  );
                })
              )}
            </select>
          </div>

          {selectedProcess && (
            <div className="process-info">
              <p><strong>Name:</strong> {selectedProcess.proc_name}</p>
              <p><strong>Category:</strong> {selectedProcess.proc_category}</p>
              <p><strong>Install Cost:</strong> {formatNumber(selectedProcess.proc_install_cost)} cash</p>
              <p><strong>Install Time:</strong> {selectedProcess.proc_install_time} min</p>
              <p><strong>Run Cost:</strong> {formatNumber(selectedProcess.proc_run_cost)} cash</p>
              <p><strong>Run Time:</strong> {selectedProcess.proc_run_time} min</p>
              <p><strong>Pollution/Run:</strong> {selectedProcess.proc_run_pollut}</p>
              {selectedProcess.proc_tech_req !== null && selectedProcess.proc_tech_req !== undefined && (
                <p>
                  <strong>Tech Required:</strong> Tech ID {selectedProcess.proc_tech_req}
                  {!isProcessAvailable(selectedProcess) && (
                    <span style={{ color: '#d32f2f', marginLeft: '8px' }}>(Not Researched)</span>
                  )}
                </p>
              )}

              {processDetails && (
                <>
                  {processDetails.inputs.length > 0 && (
                    <>
                      <p><strong>Inputs:</strong></p>
                      <ul>
                        {processDetails.inputs.map((inp) => {
                          const mat = materialsCatalogue.get(inp.res_id);
                          return (
                            <li key={inp.res_id}>
                              {mat?.res_name || `Material ${inp.res_id}`}: {inp.amount}
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}

                  {processDetails.outputs.length > 0 && (
                    <>
                      <p><strong>Outputs:</strong></p>
                      <ul>
                        {processDetails.outputs.map((out) => {
                          const mat = materialsCatalogue.get(out.res_id);
                          return (
                            <li key={out.res_id}>
                              {mat?.res_name || `Material ${out.res_id}`}: {out.amount}
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          <button
            onClick={handleInstall}
            className="btn-primary"
          >
            ⚙ Install on Selected Building
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