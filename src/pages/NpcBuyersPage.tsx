import { useEffect, useState, useCallback } from 'react';
import { gameClient } from '../api/gameClient';
import { useGame } from '../context/GameContext';
import type { NpcBuyer, PlayerMaterial } from '../types';

export function NpcBuyersPage() {
  const { materialsCatalogue, lastRefresh } = useGame();
  const [buyers, setBuyers] = useState<NpcBuyer[]>([]);
  const [materials, setMaterials] = useState<PlayerMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Selection state
  const [selectedBuyer, setSelectedBuyer] = useState<NpcBuyer | null>(null);
  const [sellAmount, setSellAmount] = useState('1');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    const [buyersResult, materialsResult] = await Promise.all([
      gameClient.get_npc_buyers(),
      gameClient.get_player_materials(),
    ]);

    if (buyersResult.success && buyersResult.data) {
      // Sort by buyer name
      const sorted = [...buyersResult.data].sort((a, b) => 
        a.npc_buyer_name.localeCompare(b.npc_buyer_name)
      );
      setBuyers(sorted);
    } else {
      setError(buyersResult.error || 'Failed to load NPC buyers');
    }

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

  const getPlayerInventory = (res_id: number) => {
    const mat = materials.find((m) => m.res_id === res_id);
    return mat?.amount || 0;
  };

  const getExpectedEarnings = () => {
    if (!selectedBuyer) return 0;
    const amount = parseInt(sellAmount);
    if (isNaN(amount) || amount <= 0) return 0;
    return selectedBuyer.buy_price * amount;
  };

  const handleSellMax = () => {
    if (!selectedBuyer) {
      setStatus({ type: 'error', message: 'Please select a buyer first' });
      return;
    }

    const playerAmount = getPlayerInventory(selectedBuyer.buy_res_id);
    const maxSellable = Math.min(playerAmount, selectedBuyer.current_demand);
    setSellAmount(String(maxSellable));
  };

  const handleSell = async () => {
    if (!selectedBuyer) {
      setStatus({ type: 'error', message: 'Please select a buyer from the list above' });
      return;
    }

    const amount = parseInt(sellAmount);
    if (isNaN(amount) || amount <= 0) {
      setStatus({ type: 'error', message: 'Please enter a valid positive amount' });
      return;
    }

    if (amount > selectedBuyer.current_demand) {
      setStatus({
        type: 'error',
        message: `Amount (${formatNumber(amount)}) exceeds current demand (${formatNumber(selectedBuyer.current_demand)})`,
      });
      return;
    }

    const playerAmount = getPlayerInventory(selectedBuyer.buy_res_id);
    if (amount > playerAmount) {
      setStatus({
        type: 'error',
        message: `You don't have enough material (have: ${formatNumber(playerAmount)})`,
      });
      return;
    }

    const matInfo = materialsCatalogue.get(selectedBuyer.buy_res_id);
    const materialName = matInfo?.res_name || `Material ${selectedBuyer.buy_res_id}`;
    const expectedEarnings = selectedBuyer.buy_price * amount;

    if (!window.confirm(
      `Sell ${formatNumber(amount)}x '${materialName}' to '${selectedBuyer.npc_buyer_name}'?\n\nPrice per unit: ${formatNumber(selectedBuyer.buy_price)} cash\nTotal earnings: ${formatNumber(expectedEarnings)} cash`
    )) {
      return;
    }

    const result = await gameClient.sell_to_npc(selectedBuyer.npc_buyer_id, amount);
    if (result.success) {
      const cashEarned = result.data;
      setStatus({
        type: 'success',
        message: `Sold ${formatNumber(amount)}x '${materialName}'. Earned: ${formatNumber(cashEarned)} cash`,
      });
      loadData();
    } else {
      setStatus({ type: 'error', message: `Failed to sell: ${result.error}` });
    }
  };

  if (loading && buyers.length === 0) {
    return <div className="loading">Loading NPC buyers...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  const selectedMaterialInfo = selectedBuyer
    ? materialsCatalogue.get(selectedBuyer.buy_res_id)
    : null;
  const selectedMaterialName = selectedMaterialInfo?.res_name || (selectedBuyer ? `Material ${selectedBuyer.buy_res_id}` : '');
  const playerInventory = selectedBuyer ? getPlayerInventory(selectedBuyer.buy_res_id) : 0;

  return (
    <div className="npc-buyers-page">
      <h2>💰 NPC Buyers</h2>

      {/* Buyers Table */}
      <section className="buyers-section">
        <h3>Available NPC Buyers</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Buyer Name</th>
              <th>Buying Material</th>
              <th>Price/Unit</th>
              <th>Current Demand</th>
            </tr>
          </thead>
          <tbody>
            {buyers.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-row">No NPC buyers available</td>
              </tr>
            ) : (
              buyers.map((buyer) => {
                const matInfo = materialsCatalogue.get(buyer.buy_res_id);
                return (
                  <tr
                    key={buyer.npc_buyer_id}
                    onClick={() => {
                      setSelectedBuyer(buyer);
                      setSellAmount('1');
                    }}
                    className={selectedBuyer?.npc_buyer_id === buyer.npc_buyer_id ? 'selected' : ''}
                  >
                    <td>{buyer.npc_buyer_id}</td>
                    <td>{buyer.npc_buyer_name}</td>
                    <td>{matInfo?.res_name || `Material ${buyer.buy_res_id}`}</td>
                    <td className="number">{formatNumber(buyer.buy_price)}</td>
                    <td className="number">{formatNumber(buyer.current_demand)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {/* Sell Section */}
      <section className="sell-section">
        <h3>💵 Sell to NPC</h3>

        <div className="sell-info">
          <div className="info-row">
            <span className="label">Selected Buyer:</span>
            <span className="value">
              {selectedBuyer
                ? `${selectedBuyer.npc_buyer_name} - Buying: ${selectedMaterialName} @ ${formatNumber(selectedBuyer.buy_price)}/unit (Demand: ${formatNumber(selectedBuyer.current_demand)})`
                : '(Select a buyer above)'}
            </span>
          </div>

          <div className="info-row">
            <span className="label">Your Inventory:</span>
            <span className="value">
              {selectedBuyer
                ? `${formatNumber(playerInventory)} units of ${selectedMaterialName}`
                : '-'}
            </span>
          </div>
        </div>

        <div className="sell-controls">
          <label>
            Amount to Sell:
            <input
              type="number"
              value={sellAmount}
              onChange={(e) => setSellAmount(e.target.value)}
              min="1"
              style={{ width: '120px', marginLeft: '8px' }}
              disabled={!selectedBuyer}
            />
          </label>
          <button onClick={handleSellMax} className="btn-secondary" disabled={!selectedBuyer}>
            Sell Max
          </button>
        </div>

        <div className="sell-action">
          <button onClick={handleSell} className="btn-primary" disabled={!selectedBuyer}>
            💰 SELL TO NPC
          </button>
          {selectedBuyer && (
            <span className="expected-earnings">
              Expected earnings: {formatNumber(getExpectedEarnings())} cash
            </span>
          )}
        </div>
      </section>

      {status && (
        <div className={`status-message ${status.type}`}>
          {status.message}
        </div>
      )}
    </div>
  );
}
