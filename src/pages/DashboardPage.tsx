import { useEffect, useState, useCallback } from 'react';
import { gameClient } from '../api/gameClient';
import { useGame } from '../context/GameContext';
import type { Player, PlayerMaterial, PlayerExpansion, MaterialCatalogue } from '../types';

export function DashboardPage() {
  const { materialsCatalogue, lastRefresh } = useGame();
  const [player, setPlayer] = useState<Player | null>(null);
  const [materials, setMaterials] = useState<PlayerMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dispose state
  const [selectedMaterial, setSelectedMaterial] = useState<PlayerMaterial | null>(null);
  const [disposeAmount, setDisposeAmount] = useState('1');
  const [disposeStatus, setDisposeStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Building Space Upgrade state
  const [playerExpansion, setPlayerExpansion] = useState<PlayerExpansion | null>(null);
  const [upgradeStatus, setUpgradeStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    const playerResult = await gameClient.get_player_data();
    if (playerResult.success && playerResult.data) {
      setPlayer(playerResult.data);
    } else {
      setError(playerResult.error || 'Failed to load player data');
    }

    const materialsResult = await gameClient.get_player_materials();
    if (materialsResult.success && materialsResult.data) {
      setMaterials(materialsResult.data);
    }

    // Load player expansions
    const expansionResult = await gameClient.get_player_expansions();
    if (expansionResult.success && expansionResult.data) {
      setPlayerExpansion(expansionResult.data);
    } else if (expansionResult.success && !expansionResult.data) {
      // No expansion row exists yet, assume level 1
      setPlayerExpansion(null);
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

  const handleDispose = async () => {
    if (!selectedMaterial) {
      setDisposeStatus({ type: 'error', message: 'Please select a material to dispose' });
      return;
    }

    const amount = parseInt(disposeAmount);
    if (isNaN(amount) || amount <= 0) {
      setDisposeStatus({ type: 'error', message: 'Please enter a valid positive amount' });
      return;
    }

    if (amount > selectedMaterial.amount) {
      setDisposeStatus({ type: 'error', message: `Cannot dispose more than you have (${selectedMaterial.amount})` });
      return;
    }

    const matInfo = materialsCatalogue.get(selectedMaterial.res_id);
    const matName = matInfo?.res_name || `Material ${selectedMaterial.res_id}`;
    const disposeCost = (matInfo?.res_dispose_cost || 0) * amount;
    const disposePollut = (matInfo?.res_dispose_pollut || 0) * amount;

    if (!window.confirm(
      `Dispose ${amount.toLocaleString()}x '${matName}'?\n\nCost: ${disposeCost.toLocaleString()} cash\nPollution: ${disposePollut.toLocaleString()}`
    )) {
      return;
    }

    const result = await gameClient.dispose_resources(selectedMaterial.res_id, amount);
    if (result.success) {
      setDisposeStatus({ type: 'success', message: `Disposed ${amount.toLocaleString()}x '${matName}'` });
      setSelectedMaterial(null);
      loadData();
    } else {
      setDisposeStatus({ type: 'error', message: `Failed to dispose: ${result.error}` });
    }
  };

  const getDisposeInfo = () => {
    if (!selectedMaterial) return null;
    const matInfo = materialsCatalogue.get(selectedMaterial.res_id);
    return {
      name: matInfo?.res_name || `Material ${selectedMaterial.res_id}`,
      cost: matInfo?.res_dispose_cost || 0,
      pollut: matInfo?.res_dispose_pollut || 0,
    };
  };

  const disposeInfo = getDisposeInfo();

  // Building Space Upgrade handlers
  const handleUpgradeBuildingSpace = async () => {
    if (!player) {
      setUpgradeStatus({ type: 'error', message: 'Player data not loaded' });
      return;
    }

    const expansionLevel = playerExpansion?.expansion_level || 1;
    const baseCost = playerExpansion?.base_cost || 500;
    const cost = baseCost * Math.pow(10, expansionLevel);

    if (player.player_cash < cost) {
      setUpgradeStatus({ type: 'error', message: 'Not enough cash to upgrade building space' });
      return;
    }

    if (!window.confirm(
      `Upgrade building space?\n\nCurrent level: ${expansionLevel}\nCost: ${formatNumber(cost)} cash\nGrants: +5 building space`
    )) {
      return;
    }

    const result = await gameClient.upgrade_building_space();
    if (result.success) {
      setUpgradeStatus({ type: 'success', message: `Building space upgraded to level ${result.data?.expansion_level || expansionLevel + 1}` });
      loadData();
    } else {
      // Parse error message for user-friendly feedback
      let errorMsg = result.error || 'Failed to upgrade building space';
      if (errorMsg.toLowerCase().includes('not enough cash')) {
        errorMsg = 'Not enough cash to upgrade building space';
      }
      setUpgradeStatus({ type: 'error', message: errorMsg });
    }
  };

  // Calculate next upgrade cost
  const getNextUpgradeCost = (): number => {
    const expansionLevel = playerExpansion?.expansion_level || 1;
    const baseCost = playerExpansion?.base_cost || 500;
    return baseCost * Math.pow(10, expansionLevel);
  };

  // Filter and sort materials by phase
  const getMaterialsByPhase = (phases: string[]) => {
    return materials
      .filter((mat) => {
        const info = materialsCatalogue.get(mat.res_id);
        const phase = info?.res_phase?.toLowerCase();
        return phase && phases.some(p => p.toLowerCase() === phase);
      })
      .sort((a, b) => a.res_id - b.res_id);
  };

  const dryMaterials = getMaterialsByPhase(['solid', 'dry']);
  const fluidMaterials = getMaterialsByPhase(['fluid']);
  const gasMaterials = getMaterialsByPhase(['gas']);

  // Helper to render color indicators
  const renderColorIndicators = (info: MaterialCatalogue | undefined) => {
    if (!info) return null;
    
    const colors: string[] = [];
    if (info.res_color1) colors.push(info.res_color1);
    if (info.res_color2) colors.push(info.res_color2);
    
    if (colors.length === 0) return <span style={{ color: '#999', fontStyle: 'italic' }}>-</span>;
    
    return (
      <div className="color-indicators">
        {colors.map((color, index) => (
          <span
            key={index}
            className="color-dot"
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    );
  };

  // Helper to render material table rows
  const renderMaterialRows = (mats: PlayerMaterial[]) => {
    if (mats.length === 0) {
      return (
        <tr>
          <td colSpan={5} className="empty-row">No materials in this storage</td>
        </tr>
      );
    }
    return mats.map((mat) => {
      const info = materialsCatalogue.get(mat.res_id);
      return (
        <tr
          key={mat.res_id}
          onClick={() => setSelectedMaterial(mat)}
          className={selectedMaterial?.res_id === mat.res_id ? 'selected' : ''}
        >
          <td>{mat.res_id}</td>
          <td className="color-cell">{renderColorIndicators(info)}</td>
          <td>{info?.res_name || mat.res_code}</td>
          <td>{info?.res_phase || '-'}</td>
          <td className="number">{formatNumber(mat.amount)}</td>
        </tr>
      );
    });
  };

  if (loading && !player) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="dashboard-page">
      <h2>📊 Dashboard</h2>

      {/* Player Statistics */}
      <section className="stats-section">
        <h3>Player Statistics</h3>
        {player && (
          <div className="stats-grid">
            <div className="stat-row">
              <div className="stat-item">
                <span className="stat-label">Name:</span>
                <span className="stat-value">{player.player_name}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Factory:</span>
                <span className="stat-value">{player.player_factory}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Cash:</span>
                <span className="stat-value">{formatNumber(player.player_cash)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Pollution:</span>
                <span className="stat-value">{formatNumber(player.player_pollution)}</span>
              </div>
            </div>
            <div className="stat-row">
              <div className="stat-item">
                <span className="stat-label">Building Space:</span>
                <span className="stat-value">
                  {formatNumber(player.build_space_occupied)} / {formatNumber(player.building_space)}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Expansion Level:</span>
                <span className="stat-value">{playerExpansion?.expansion_level || 1}</span>
              </div>
            </div>
          </div>
        )}

        {/* Building Space Upgrade */}
        <div className="building-space-upgrade" style={{ marginTop: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '4px' }}>
          <h4>🏗️ Building Space Upgrade</h4>
          {player && (
            <>
              <div style={{ marginBottom: '10px' }}>
                <p><strong>Current Space:</strong> {formatNumber(player.build_space_occupied)} / {formatNumber(player.building_space)}</p>
                <p><strong>Next Upgrade Cost:</strong> {formatNumber(getNextUpgradeCost())} cash</p>
                <p><strong>Grants:</strong> +5 building space</p>
              </div>
              <button
                onClick={handleUpgradeBuildingSpace}
                className="btn-primary"
                disabled={player.player_cash < getNextUpgradeCost()}
              >
                Upgrade Building Space
              </button>
              {player.player_cash < getNextUpgradeCost() && (
                <div style={{ marginTop: '10px', color: '#d32f2f', fontSize: '0.9em' }}>
                  Insufficient cash
                </div>
              )}
              {upgradeStatus && (
                <div className={`status-message ${upgradeStatus.type}`} style={{ marginTop: '10px' }}>
                  {upgradeStatus.message}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Dry Storage */}
      <section className="dry-storage-section">
        <h3>Dry Storage</h3>
        {player && (
          <div className="stats-grid" style={{ marginBottom: '15px' }}>
            <div className="stat-row">
              <div className="stat-item">
                <span className="stat-label">Capacity:</span>
                <span className="stat-value">{formatNumber(player.player_dry_storage)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Reserved:</span>
                <span className="stat-value">{formatNumber(player.player_dry_storage_reserved)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Occupied:</span>
                <span className="stat-value">{formatNumber(player.player_dry_storage_occupied)}</span>
              </div>
            </div>
          </div>
        )}
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Colors</th>
              <th>Name</th>
              <th>Phase</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {renderMaterialRows(dryMaterials)}
          </tbody>
        </table>
      </section>

      {/* Fluid Storage */}
      <section className="fluid-storage-section">
        <h3>Fluid Storage</h3>
        {player && (
          <div className="stats-grid" style={{ marginBottom: '15px' }}>
            <div className="stat-row">
              <div className="stat-item">
                <span className="stat-label">Capacity:</span>
                <span className="stat-value">{formatNumber(player.player_fluid_storage)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Reserved:</span>
                <span className="stat-value">{formatNumber(player.player_fluid_storage_reserved)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Occupied:</span>
                <span className="stat-value">{formatNumber(player.player_fluid_storage_occupied)}</span>
              </div>
            </div>
          </div>
        )}
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Colors</th>
              <th>Name</th>
              <th>Phase</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {renderMaterialRows(fluidMaterials)}
          </tbody>
        </table>
      </section>

      {/* Gas Storage */}
      <section className="gas-storage-section">
        <h3>Gas Storage</h3>
        {player && (
          <div className="stats-grid" style={{ marginBottom: '15px' }}>
            <div className="stat-row">
              <div className="stat-item">
                <span className="stat-label">Capacity:</span>
                <span className="stat-value">{formatNumber(player.player_gas_storage)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Reserved:</span>
                <span className="stat-value">{formatNumber(player.player_gas_storage_reserved)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Occupied:</span>
                <span className="stat-value">{formatNumber(player.player_gas_storage_occupied)}</span>
              </div>
            </div>
          </div>
        )}
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Colors</th>
              <th>Name</th>
              <th>Phase</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {renderMaterialRows(gasMaterials)}
          </tbody>
        </table>
      </section>

      {/* Dispose Materials */}
      <section className="dispose-section">
        <h3>🗑️ Dispose Materials</h3>
        <div className="dispose-controls">
          <div className="dispose-info">
            <span className="label">Selected:</span>
            <span className="value">
              {selectedMaterial && disposeInfo
                ? `${disposeInfo.name} (ID: ${selectedMaterial.res_id}, Have: ${formatNumber(selectedMaterial.amount)})`
                : '(Select a material above)'}
            </span>
          </div>
          {disposeInfo && (
            <div className="dispose-info">
              <span className="label">Cost per unit:</span>
              <span className="value">{disposeInfo.cost} cash, {disposeInfo.pollut} pollution</span>
            </div>
          )}
          <div className="dispose-actions">
            <label>
              Amount:
              <input
                type="number"
                value={disposeAmount}
                onChange={(e) => setDisposeAmount(e.target.value)}
                min="1"
                style={{ width: '100px', marginLeft: '8px' }}
              />
            </label>
            <button onClick={handleDispose} className="btn-danger" disabled={!selectedMaterial}>
              🗑️ Dispose
            </button>
          </div>
          {disposeStatus && (
            <div className={`status-message ${disposeStatus.type}`}>
              {disposeStatus.message}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
