import { useEffect, useState, useCallback } from 'react';
import { gameClient } from '../api/gameClient';
import { useGame } from '../context/GameContext';
import type { MarketSellOrder, PlayerMaterial, Player } from '../types';

export function MarketPage() {
  const { materialsCatalogue, lastRefresh } = useGame();
  const [player, setPlayer] = useState<Player | null>(null);
  const [orders, setOrders] = useState<MarketSellOrder[]>([]);
  const [materials, setMaterials] = useState<PlayerMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filter and sort state
  const [filterMaterial, setFilterMaterial] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'price' | 'amount' | 'created'>('price');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Buy state
  const [selectedOrder, setSelectedOrder] = useState<MarketSellOrder | null>(null);
  const [buyAmount, setBuyAmount] = useState('1');
  const [showBuyModal, setShowBuyModal] = useState(false);

  // Sell state
  const [selectedSellMaterial, setSelectedSellMaterial] = useState<PlayerMaterial | null>(null);
  const [sellAmount, setSellAmount] = useState('1');
  const [sellPrice, setSellPrice] = useState('1');
  const [showSellModal, setShowSellModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    const [playerResult, ordersResult, materialsResult] = await Promise.all([
      gameClient.get_player_data(),
      gameClient.get_market_sell_orders(),
      gameClient.get_player_materials(),
    ]);

    if (playerResult.success && playerResult.data) {
      setPlayer(playerResult.data);
    } else {
      setError(playerResult.error || 'Failed to load player data');
    }

    if (ordersResult.success && ordersResult.data) {
      setOrders(ordersResult.data);
    } else {
      setError(ordersResult.error || 'Failed to load market orders');
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

  const getMaterialName = (res_id: number) => {
    const mat = materialsCatalogue.get(res_id);
    return mat?.res_name || `Material ${res_id}`;
  };

  const getPlayerFactory = () => {
    return player?.player_factory || '';
  };

  // Filter and sort orders
  const getFilteredAndSortedOrders = () => {
    let filtered = [...orders];

    // Filter by material
    if (filterMaterial !== null) {
      filtered = filtered.filter((o) => o.res_id === filterMaterial);
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'price') {
        comparison = a.res_price - b.res_price;
      } else if (sortBy === 'amount') {
        comparison = a.res_amount - b.res_amount;
      } else if (sortBy === 'created') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  };

  const filteredOrders = getFilteredAndSortedOrders();
  const myOrders = filteredOrders.filter((o) => o.creator_factory === getPlayerFactory());

  // Buy handlers
  const handleBuyClick = (order: MarketSellOrder) => {
    if (order.creator_factory === getPlayerFactory()) {
      setStatus({ type: 'error', message: 'Cannot buy from your own order' });
      return;
    }
    setSelectedOrder(order);
    setBuyAmount('1');
    setShowBuyModal(true);
  };

  const handleBuyMax = () => {
    if (!selectedOrder) return;
    setBuyAmount(String(selectedOrder.res_amount));
  };

  const handleBuy = async () => {
    if (!selectedOrder) {
      setStatus({ type: 'error', message: 'No order selected' });
      return;
    }

    const amount = parseInt(buyAmount);
    if (isNaN(amount) || amount <= 0) {
      setStatus({ type: 'error', message: 'Please enter a valid positive amount' });
      return;
    }

    if (amount > selectedOrder.res_amount) {
      setStatus({
        type: 'error',
        message: `Amount (${formatNumber(amount)}) exceeds available (${formatNumber(selectedOrder.res_amount)})`,
      });
      return;
    }

    if (!player) {
      setStatus({ type: 'error', message: 'Player data not loaded' });
      return;
    }

    const totalCost = selectedOrder.res_price * amount;
    if (player.player_cash < totalCost) {
      setStatus({
        type: 'error',
        message: `Insufficient cash. Need ${formatNumber(totalCost)}, have ${formatNumber(player.player_cash)}`,
      });
      return;
    }

    const materialInfo = materialsCatalogue.get(selectedOrder.res_id);
    const materialName = materialInfo?.res_name || `Material ${selectedOrder.res_id}`;

    if (!window.confirm(
      `Buy ${formatNumber(amount)}x '${materialName}' from '${selectedOrder.creator_factory}'?\n\nPrice per unit: ${formatNumber(selectedOrder.res_price)} cash\nTotal cost: ${formatNumber(totalCost)} cash`
    )) {
      return;
    }

    const result = await gameClient.buy_from_sell_order(selectedOrder.sell_order_id, amount);
    if (result.success) {
      setStatus({
        type: 'success',
        message: `Purchased ${formatNumber(amount)}x '${materialName}' for ${formatNumber(totalCost)} cash`,
      });
      setShowBuyModal(false);
      setSelectedOrder(null);
      loadData();
    } else {
      setStatus({ type: 'error', message: `Failed to buy: ${result.error}` });
    }
  };

  // Sell handlers
  const handleSellClick = () => {
    if (materials.length === 0) {
      setStatus({ type: 'error', message: 'You have no materials to sell' });
      return;
    }
    setSelectedSellMaterial(materials[0]);
    setSellAmount('1');
    setSellPrice('1');
    setShowSellModal(true);
  };

  const handleSellMax = () => {
    if (!selectedSellMaterial) return;
    setSellAmount(String(selectedSellMaterial.amount));
  };

  const handleCreateSellOrder = async () => {
    if (!selectedSellMaterial) {
      setStatus({ type: 'error', message: 'Please select a material to sell' });
      return;
    }

    const amount = parseInt(sellAmount);
    const price = parseInt(sellPrice);

    if (isNaN(amount) || amount <= 0) {
      setStatus({ type: 'error', message: 'Please enter a valid positive amount' });
      return;
    }

    if (isNaN(price) || price <= 0) {
      setStatus({ type: 'error', message: 'Please enter a valid positive price' });
      return;
    }

    if (amount > selectedSellMaterial.amount) {
      setStatus({
        type: 'error',
        message: `Amount (${formatNumber(amount)}) exceeds inventory (${formatNumber(selectedSellMaterial.amount)})`,
      });
      return;
    }

    const materialInfo = materialsCatalogue.get(selectedSellMaterial.res_id);
    const materialName = materialInfo?.res_name || `Material ${selectedSellMaterial.res_id}`;
    const totalValue = price * amount;

    if (!window.confirm(
      `List ${formatNumber(amount)}x '${materialName}' for sale?\n\nPrice per unit: ${formatNumber(price)} cash\nTotal value: ${formatNumber(totalValue)} cash`
    )) {
      return;
    }

    const result = await gameClient.create_sell_order(selectedSellMaterial.res_id, amount, price);
    if (result.success) {
      setStatus({
        type: 'success',
        message: `Listed ${formatNumber(amount)}x '${materialName}' for ${formatNumber(price)} cash per unit`,
      });
      setShowSellModal(false);
      setSelectedSellMaterial(null);
      loadData();
    } else {
      setStatus({ type: 'error', message: `Failed to create sell order: ${result.error}` });
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    const order = orders.find((o) => o.sell_order_id === orderId);
    if (!order) return;

    const materialInfo = materialsCatalogue.get(order.res_id);
    const materialName = materialInfo?.res_name || `Material ${order.res_id}`;

    if (!window.confirm(
      `Cancel sell order for ${formatNumber(order.res_amount)}x '${materialName}'?\n\nMaterials will be returned to your inventory.`
    )) {
      return;
    }

    const result = await gameClient.cancel_sell_order(orderId);
    if (result.success) {
      setStatus({
        type: 'success',
        message: `Cancelled sell order. Materials returned to inventory.`,
      });
      loadData();
    } else {
      setStatus({ type: 'error', message: `Failed to cancel order: ${result.error}` });
    }
  };

  if (loading && orders.length === 0) {
    return <div className="loading">Loading market...</div>;
  }

  if (error && !player) {
    return <div className="error">Error: {error}</div>;
  }

  const getTotalCost = () => {
    if (!selectedOrder) return 0;
    const amount = parseInt(buyAmount);
    if (isNaN(amount) || amount <= 0) return 0;
    return selectedOrder.res_price * amount;
  };

  const availableMaterials = materials.filter((m) => m.amount > 0);
  const uniqueMaterials = Array.from(new Set(orders.map((o) => o.res_id)));

  return (
    <div className="market-page">
      <h2>🏪 Market</h2>

      {/* Market Controls */}
      <section className="market-controls-section">
        <div className="market-controls">
          <div className="control-group">
            <label>
              Filter by Material:
              <select
                value={filterMaterial === null ? '' : filterMaterial}
                onChange={(e) => setFilterMaterial(e.target.value ? parseInt(e.target.value) : null)}
                style={{ marginLeft: '8px', padding: '5px' }}
              >
                <option value="">All Materials</option>
                {uniqueMaterials.map((resId) => (
                  <option key={resId} value={resId}>
                    {getMaterialName(resId)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="control-group">
            <label>
              Sort by:
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'price' | 'amount' | 'created')}
                style={{ marginLeft: '8px', padding: '5px' }}
              >
                <option value="price">Price</option>
                <option value="amount">Amount</option>
                <option value="created">Created Date</option>
              </select>
            </label>
          </div>

          <div className="control-group">
            <label>
              Order:
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                style={{ marginLeft: '8px', padding: '5px' }}
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </label>
          </div>

          <button onClick={handleSellClick} className="btn-primary">
            📤 Create Sell Order
          </button>
        </div>
      </section>

      {/* My Orders Section */}
      {myOrders.length > 0 && (
        <section className="my-orders-section">
          <h3>📋 My Sell Orders</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Material</th>
                <th>Amount</th>
                <th>Price/Unit</th>
                <th>Total Value</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {myOrders.map((order) => {
                const materialInfo = materialsCatalogue.get(order.res_id);
                return (
                  <tr key={order.sell_order_id}>
                    <td>{order.sell_order_id}</td>
                    <td>{materialInfo?.res_name || `Material ${order.res_id}`}</td>
                    <td className="number">{formatNumber(order.res_amount)}</td>
                    <td className="number">{formatNumber(order.res_price)}</td>
                    <td className="number">{formatNumber(order.res_price * order.res_amount)}</td>
                    <td>{new Date(order.created_at).toLocaleString()}</td>
                    <td>
                      <button
                        onClick={() => handleCancelOrder(order.sell_order_id)}
                        className="btn-danger btn-small"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* All Market Orders */}
      <section className="market-orders-section">
        <h3>🛒 Available Orders ({filteredOrders.length})</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Seller</th>
              <th>Material</th>
              <th>Amount</th>
              <th>Price/Unit</th>
              <th>Total Cost</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-row">
                  No orders available{filterMaterial !== null ? ' for selected material' : ''}
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => {
                const materialInfo = materialsCatalogue.get(order.res_id);
                const isMyOrder = order.creator_factory === getPlayerFactory();
                return (
                  <tr
                    key={order.sell_order_id}
                    className={isMyOrder ? 'my-order' : ''}
                  >
                    <td>{order.sell_order_id}</td>
                    <td>{order.creator_factory}</td>
                    <td>{materialInfo?.res_name || `Material ${order.res_id}`}</td>
                    <td className="number">{formatNumber(order.res_amount)}</td>
                    <td className="number">{formatNumber(order.res_price)}</td>
                    <td className="number">{formatNumber(order.res_price * order.res_amount)}</td>
                    <td>{new Date(order.created_at).toLocaleString()}</td>
                    <td>
                      {isMyOrder ? (
                        <span style={{ color: '#999', fontStyle: 'italic' }}>Your order</span>
                      ) : (
                        <button
                          onClick={() => handleBuyClick(order)}
                          className="btn-primary btn-small"
                        >
                          Buy
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {/* Buy Modal */}
      {showBuyModal && selectedOrder && (
        <div className="modal-overlay" onClick={() => setShowBuyModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>🛒 Buy from Market</h3>
            <div className="modal-info">
              <div className="info-row">
                <span className="label">Seller:</span>
                <span className="value">{selectedOrder.creator_factory}</span>
              </div>
              <div className="info-row">
                <span className="label">Material:</span>
                <span className="value">{getMaterialName(selectedOrder.res_id)}</span>
              </div>
              <div className="info-row">
                <span className="label">Available:</span>
                <span className="value">{formatNumber(selectedOrder.res_amount)} units</span>
              </div>
              <div className="info-row">
                <span className="label">Price per unit:</span>
                <span className="value">{formatNumber(selectedOrder.res_price)} cash</span>
              </div>
              {player && (
                <div className="info-row">
                  <span className="label">Your cash:</span>
                  <span className="value">{formatNumber(player.player_cash)} cash</span>
                </div>
              )}
            </div>
            <div className="modal-controls">
              <label>
                Amount to buy:
                <input
                  type="number"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  min="1"
                  max={selectedOrder.res_amount}
                  style={{ width: '120px', marginLeft: '8px' }}
                />
              </label>
              <button onClick={handleBuyMax} className="btn-secondary">
                Buy Max
              </button>
            </div>
            <div className="modal-total">
              <strong>Total cost: {formatNumber(getTotalCost())} cash</strong>
            </div>
            <div className="modal-actions">
              <button onClick={handleBuy} className="btn-primary">
                💰 Confirm Purchase
              </button>
              <button onClick={() => setShowBuyModal(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sell Modal */}
      {showSellModal && (
        <div className="modal-overlay" onClick={() => setShowSellModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>📤 Create Sell Order</h3>
            <div className="modal-info">
              <div className="info-row">
                <span className="label">Select Material:</span>
                <select
                  value={selectedSellMaterial?.res_id || ''}
                  onChange={(e) => {
                    const mat = materials.find((m) => m.res_id === parseInt(e.target.value));
                    setSelectedSellMaterial(mat || null);
                    if (mat) {
                      setSellAmount('1');
                    }
                  }}
                  style={{ padding: '5px', width: '100%' }}
                >
                  <option value="">-- Select Material --</option>
                  {availableMaterials.map((mat) => {
                    const matInfo = materialsCatalogue.get(mat.res_id);
                    return (
                      <option key={mat.res_id} value={mat.res_id}>
                        {matInfo?.res_name || `Material ${mat.res_id}`} (Have: {formatNumber(mat.amount)})
                      </option>
                    );
                  })}
                </select>
              </div>
              {selectedSellMaterial && (
                <>
                  <div className="info-row">
                    <span className="label">Available in inventory:</span>
                    <span className="value">{formatNumber(selectedSellMaterial.amount)} units</span>
                  </div>
                </>
              )}
            </div>
            <div className="modal-controls">
              <label>
                Amount to sell:
                <input
                  type="number"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  min="1"
                  max={selectedSellMaterial?.amount || 0}
                  style={{ width: '120px', marginLeft: '8px' }}
                  disabled={!selectedSellMaterial}
                />
              </label>
              <button onClick={handleSellMax} className="btn-secondary" disabled={!selectedSellMaterial}>
                Sell Max
              </button>
            </div>
            <div className="modal-controls">
              <label>
                Price per unit:
                <input
                  type="number"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  min="1"
                  style={{ width: '120px', marginLeft: '8px' }}
                />
              </label>
            </div>
            {selectedSellMaterial && (
              <div className="modal-total">
                <strong>
                  Total value: {formatNumber(parseInt(sellPrice) * parseInt(sellAmount) || 0)} cash
                </strong>
              </div>
            )}
            <div className="modal-actions">
              <button
                onClick={handleCreateSellOrder}
                className="btn-primary"
                disabled={!selectedSellMaterial}
              >
                📤 Create Order
              </button>
              <button onClick={() => setShowSellModal(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {status && (
        <div className={`status-message ${status.type}`}>
          {status.message}
        </div>
      )}
    </div>
  );
}

