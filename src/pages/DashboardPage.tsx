import { useEffect, useState, useCallback } from 'react';
import { gameClient } from '../api/gameClient';
import { useGame } from '../context/GameContext';
import type { Player, PlayerMaterial } from '../types';

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
                <span className="stat-value">{formatNumber(player.building_space)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Space Occupied:</span>
                <span className="stat-value">{formatNumber(player.build_space_occupied)}</span>
              </div>
            </div>
            <div className="stat-row">
              <div className="stat-item">
                <span className="stat-label">Dry Storage:</span>
                <span className="stat-value">{formatNumber(player.player_dry_storage)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Dry Reserved:</span>
                <span className="stat-value">{formatNumber(player.player_dry_storage_reserved)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Dry Occupied:</span>
                <span className="stat-value">{formatNumber(player.player_dry_storage_occupied)}</span>
              </div>
            </div>
            <div className="stat-row">
              <div className="stat-item">
                <span className="stat-label">Fluid Storage:</span>
                <span className="stat-value">{formatNumber(player.player_fluid_storage)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Fluid Reserved:</span>
                <span className="stat-value">{formatNumber(player.player_fluid_storage_reserved)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Fluid Occupied:</span>
                <span className="stat-value">{formatNumber(player.player_fluid_storage_occupied)}</span>
              </div>
            </div>
            <div className="stat-row">
              <div className="stat-item">
                <span className="stat-label">Gas Storage:</span>
                <span className="stat-value">{formatNumber(player.player_gas_storage)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Gas Reserved:</span>
                <span className="stat-value">{formatNumber(player.player_gas_storage_reserved)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Gas Occupied:</span>
                <span className="stat-value">{formatNumber(player.player_gas_storage_occupied)}</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Resources Inventory */}
      <section className="resources-section">
        <h3>Resources Inventory</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Code</th>
              <th>Name</th>
              <th>Phase</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {materials.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-row">No materials in inventory</td>
              </tr>
            ) : (
              materials.map((mat) => {
                const info = materialsCatalogue.get(mat.res_id);
                return (
                  <tr
                    key={mat.res_id}
                    onClick={() => setSelectedMaterial(mat)}
                    className={selectedMaterial?.res_id === mat.res_id ? 'selected' : ''}
                  >
                    <td>{mat.res_id}</td>
                    <td>{mat.res_code}</td>
                    <td>{info?.res_name || mat.res_code}</td>
                    <td>{info?.res_phase || '-'}</td>
                    <td className="number">{formatNumber(mat.amount)}</td>
                  </tr>
                );
              })
            )}
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
