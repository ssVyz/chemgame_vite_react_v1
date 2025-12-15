import { useEffect, useState, useCallback } from 'react';
import { gameClient } from '../api/gameClient';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';
import type { EventSchedule, ProcessSchedule } from '../types';

export function DebugPage() {
  const { user, session } = useAuth();
  const { processCatalogue, lastRefresh, refreshAll } = useGame();

  const [events, setEvents] = useState<EventSchedule[]>([]);
  const [processSchedule, setProcessSchedule] = useState<ProcessSchedule[]>([]);
  const [rawData, setRawData] = useState<string>('');
  const [cashAmount, setCashAmount] = useState('10000');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [refreshResults, setRefreshResults] = useState<string>('');

  const loadEvents = useCallback(async () => {
    const result = await gameClient.get_events_schedule();
    if (result.success && result.data) {
      setEvents(result.data);
    }
  }, []);

  const loadProcessSchedule = useCallback(async () => {
    const result = await gameClient.get_process_schedule();
    if (result.success && result.data) {
      setProcessSchedule(result.data);
    }
  }, []);

  useEffect(() => {
    loadEvents();
    loadProcessSchedule();
  }, [loadEvents, loadProcessSchedule, lastRefresh]);

  const handleRequestCash = async () => {
    const amount = parseInt(cashAmount);
    if (isNaN(amount) || amount <= 0) {
      setStatus({ type: 'error', message: 'Please enter a valid positive amount' });
      return;
    }

    const result = await gameClient.request_cash(amount);
    if (result.success) {
      setStatus({ type: 'success', message: `Requested ${amount.toLocaleString()} cash (arrives in 15 minutes)` });
      loadEvents();
    } else {
      setStatus({ type: 'error', message: `Failed: ${result.error}` });
    }
  };

  const handleRefreshAll = async () => {
    setRefreshResults('Running resolvers...\n');

    try {
      const results: string[] = [];

      // Run each resolver and capture results
      const cashResult = await gameClient.resolve_scheduled_cash();
      results.push(`resolve_scheduled_cash: ${cashResult.success ? 'OK' : cashResult.error}`);

      const constructionResult = await gameClient.finish_construction();
      results.push(`finish_construction: ${constructionResult.success ? 'OK' : constructionResult.error}`);

      const buildingProcResult = await gameClient.resolve_building_processes();
      results.push(`resolve_building_processes: ${buildingProcResult.success ? 'OK' : buildingProcResult.error}`);

      const processRunsResult = await gameClient.resolve_process_runs();
      results.push(`resolve_process_runs: ${processRunsResult.success ? 'OK' : processRunsResult.error}`);

      setRefreshResults(results.join('\n'));

      // Trigger refresh in game context
      await refreshAll();

      // Reload local data
      loadEvents();
      loadProcessSchedule();

      setStatus({ type: 'success', message: 'Refresh completed' });
    } catch (e) {
      setRefreshResults(`Error: ${e}`);
      setStatus({ type: 'error', message: `Refresh failed: ${e}` });
    }
  };

  const showRawData = async (dataType: 'player' | 'buildings' | 'materials' | 'npc_buyers') => {
    let result;
    switch (dataType) {
      case 'player':
        result = await gameClient.get_player_data();
        break;
      case 'buildings':
        result = await gameClient.get_player_buildings();
        break;
      case 'materials':
        result = await gameClient.get_player_materials();
        break;
      case 'npc_buyers':
        result = await gameClient.get_npc_buyers();
        break;
    }

    if (result.success) {
      setRawData(JSON.stringify(result.data, null, 2));
    } else {
      setRawData(`Error: ${result.error}`);
    }
  };

  return (
    <div className="debug-page">
      <h2>🔧 Debug</h2>

      {/* User/Session Info */}
      <section className="session-section">
        <h3>Current User/Session</h3>
        <div className="session-info">
          <p><strong>User ID:</strong> {user?.id || 'Not logged in'}</p>
          <p><strong>Email:</strong> {user?.email || '-'}</p>
          <p><strong>Session Expires:</strong> {session?.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : '-'}</p>
          <p><strong>Access Token (truncated):</strong> {session?.access_token ? `${session.access_token.substring(0, 50)}...` : '-'}</p>
        </div>
      </section>

      {/* Request Cash */}
      <section className="cash-section">
        <h3>Request Cash (Debug)</h3>
        <div className="cash-controls">
          <label>
            Amount:
            <input
              type="number"
              value={cashAmount}
              onChange={(e) => setCashAmount(e.target.value)}
              min="1"
              style={{ width: '120px', marginLeft: '8px' }}
            />
          </label>
          <button onClick={handleRequestCash} className="btn-primary">
            Request
          </button>
        </div>
      </section>

      {/* Refresh All */}
      <section className="refresh-section">
        <h3>Refresh All (Run Resolvers)</h3>
        <button onClick={handleRefreshAll} className="btn-primary">
          🔄 Refresh All
        </button>
        {refreshResults && (
          <pre className="refresh-results">{refreshResults}</pre>
        )}
      </section>

      {/* Events Schedule */}
      <section className="events-section">
        <h3>Pending Events</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Ends At</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={4} className="empty-row">No pending events</td>
              </tr>
            ) : (
              events.map((evt) => (
                <tr key={evt.id}>
                  <td>{evt.id}</td>
                  <td>{evt.cash_receive ? 'Cash' : 'Unknown'}</td>
                  <td className="number">{(evt.cash_receive || 0).toLocaleString()}</td>
                  <td>{evt.ends_at}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <button onClick={loadEvents} className="btn-secondary">
          Refresh Events
        </button>
      </section>

      {/* Process Schedule */}
      <section className="proc-schedule-section">
        <h3>Running Processes</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Process</th>
              <th>Runs</th>
              <th>Building ID</th>
              <th>Ends At</th>
            </tr>
          </thead>
          <tbody>
            {processSchedule.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-row">No running processes</td>
              </tr>
            ) : (
              processSchedule.map((sched) => {
                const proc = processCatalogue.get(sched.proc_id);
                return (
                  <tr key={sched.id}>
                    <td>{sched.id}</td>
                    <td>{proc?.proc_name || `Process ${sched.proc_id}`}</td>
                    <td>{sched.number_runs}</td>
                    <td>{sched.runs_in_this_building_id}</td>
                    <td>{sched.ends_at}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <button onClick={loadProcessSchedule} className="btn-secondary">
          Refresh Schedule
        </button>
      </section>

      {/* Raw Data Viewer */}
      <section className="raw-data-section">
        <h3>Raw Data Viewer</h3>
        <div className="raw-data-buttons">
          <button onClick={() => showRawData('player')} className="btn-secondary">
            Player Data
          </button>
          <button onClick={() => showRawData('buildings')} className="btn-secondary">
            Buildings
          </button>
          <button onClick={() => showRawData('materials')} className="btn-secondary">
            Materials
          </button>
          <button onClick={() => showRawData('npc_buyers')} className="btn-secondary">
            NPC Buyers
          </button>
        </div>
        <textarea
          className="raw-data-output"
          value={rawData}
          readOnly
          rows={15}
        />
      </section>

      {status && (
        <div className={`status-message ${status.type}`}>
          {status.message}
        </div>
      )}
    </div>
  );
}
