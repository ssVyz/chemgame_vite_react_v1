import { useEffect, useState, useMemo } from 'react';
import { gameClient } from '../api/gameClient';
import { useGame } from '../context/GameContext';
import type { LeaderboardEntry, Player } from '../types';

type SortField = 'cash' | 'pollution' | 'build_space';
type SortOrder = 'asc' | 'desc';

export function LeaderboardPage() {
  const { lastRefresh } = useGame();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortField, setSortField] = useState<SortField>('cash');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const loadData = async () => {
    setLoading(true);
    setError('');

    const [leaderboardResult, playerResult] = await Promise.all([
      gameClient.fetch_prelim_leaderboard(),
      gameClient.get_player_data(),
    ]);

    if (leaderboardResult.success && leaderboardResult.data) {
      setLeaderboard(leaderboardResult.data);
    } else {
      setError(leaderboardResult.error || 'Failed to load leaderboard');
    }

    if (playerResult.success && playerResult.data) {
      setPlayer(playerResult.data);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [lastRefresh]);

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString();
  };

  // Calculate top players for the highlight section
  const topPlayers = useMemo(() => {
    if (leaderboard.length === 0) {
      return {
        richest: null,
        mostPollution: null,
        biggest: null,
      };
    }

    const richest = [...leaderboard].sort((a, b) => b.player_cash - a.player_cash)[0];
    const mostPollution = [...leaderboard].sort((a, b) => b.player_pollution - a.player_pollution)[0];
    const biggest = [...leaderboard].sort((a, b) => b.build_space_occupied - a.build_space_occupied)[0];

    return { richest, mostPollution, biggest };
  }, [leaderboard]);

  // Sort and filter leaderboard
  const sortedLeaderboard = useMemo(() => {
    const sorted = [...leaderboard].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'cash') {
        comparison = a.player_cash - b.player_cash;
      } else if (sortField === 'pollution') {
        comparison = a.player_pollution - b.player_pollution;
      } else if (sortField === 'build_space') {
        comparison = a.build_space_occupied - b.build_space_occupied;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [leaderboard, sortField, sortOrder]);

  const isCurrentPlayer = (factoryName: string) => {
    return player?.player_factory === factoryName;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc'); // Default to descending for new field
    }
  };

  if (loading && leaderboard.length === 0) {
    return <div className="loading">Loading leaderboard...</div>;
  }

  if (error && leaderboard.length === 0) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="leaderboard-page">
      <h2>🏆 Leaderboard</h2>

      {/* Top Players Highlight Section */}
      <section className="top-players-section">
        <div className="top-players-grid">
          <div className="top-player-card">
            <h3>💰 Richest Factory</h3>
            {topPlayers.richest ? (
              <div className="top-player-info">
                <div className="top-player-name">{topPlayers.richest.player_factory}</div>
                <div className="top-player-value">{formatNumber(topPlayers.richest.player_cash)} cash</div>
              </div>
            ) : (
              <div className="top-player-info">No data</div>
            )}
          </div>

          <div className="top-player-card">
            <h3>🌫️ Most Pollution</h3>
            {topPlayers.mostPollution ? (
              <div className="top-player-info">
                <div className="top-player-name">{topPlayers.mostPollution.player_factory}</div>
                <div className="top-player-value">{formatNumber(topPlayers.mostPollution.player_pollution)} pollution</div>
              </div>
            ) : (
              <div className="top-player-info">No data</div>
            )}
          </div>

          <div className="top-player-card">
            <h3>🏭 Biggest Factory</h3>
            {topPlayers.biggest ? (
              <div className="top-player-info">
                <div className="top-player-name">{topPlayers.biggest.player_factory}</div>
                <div className="top-player-value">{formatNumber(topPlayers.biggest.build_space_occupied)} space</div>
              </div>
            ) : (
              <div className="top-player-info">No data</div>
            )}
          </div>
        </div>
      </section>

      {/* Leaderboard Table */}
      <section className="leaderboard-table-section">
        <div className="leaderboard-controls">
          <label>
            Sort by:
            <select
              value={sortField}
              onChange={(e) => handleSort(e.target.value as SortField)}
              style={{ marginLeft: '8px', padding: '5px' }}
            >
              <option value="cash">Cash</option>
              <option value="pollution">Pollution</option>
              <option value="build_space">Build Space Occupied</option>
            </select>
          </label>

          <label style={{ marginLeft: '16px' }}>
            Order:
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              style={{ marginLeft: '8px', padding: '5px' }}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Factory Name</th>
              <th>
                <button
                  onClick={() => handleSort('cash')}
                  className="sortable-header"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0',
                    fontWeight: 'bold',
                    textDecoration: sortField === 'cash' ? 'underline' : 'none',
                  }}
                >
                  Cash {sortField === 'cash' && (sortOrder === 'desc' ? '↓' : '↑')}
                </button>
              </th>
              <th>
                <button
                  onClick={() => handleSort('pollution')}
                  className="sortable-header"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0',
                    fontWeight: 'bold',
                    textDecoration: sortField === 'pollution' ? 'underline' : 'none',
                  }}
                >
                  Pollution {sortField === 'pollution' && (sortOrder === 'desc' ? '↓' : '↑')}
                </button>
              </th>
              <th>
                <button
                  onClick={() => handleSort('build_space')}
                  className="sortable-header"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0',
                    fontWeight: 'bold',
                    textDecoration: sortField === 'build_space' ? 'underline' : 'none',
                  }}
                >
                  Build Space {sortField === 'build_space' && (sortOrder === 'desc' ? '↓' : '↑')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedLeaderboard.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-row">
                  No players found
                </td>
              </tr>
            ) : (
              sortedLeaderboard.map((entry, index) => {
                const isCurrent = isCurrentPlayer(entry.player_factory);
                return (
                  <tr
                    key={entry.player_factory}
                    className={isCurrent ? 'current-player-row' : ''}
                    style={isCurrent ? { backgroundColor: '#e8f4f8', fontWeight: 'bold' } : {}}
                  >
                    <td className="rank-cell">{index + 1}</td>
                    <td>
                      {entry.player_factory}
                      {isCurrent && <span style={{ marginLeft: '8px', color: '#0066cc' }}>(You)</span>}
                    </td>
                    <td className="number">{formatNumber(entry.player_cash)}</td>
                    <td className="number">{formatNumber(entry.player_pollution)}</td>
                    <td className="number">{formatNumber(entry.build_space_occupied)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

