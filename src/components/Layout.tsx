import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';

export function Layout() {
  const { user, logout } = useAuth();
  const { refreshAll, lastRefresh } = useGame();

  const handleRefresh = async () => {
    await refreshAll();
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-left">
          <h1>ChemGame Client</h1>
        </div>
        <nav className="header-nav">
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
            📊 Dashboard
          </NavLink>
          <NavLink to="/buildings" className={({ isActive }) => isActive ? 'active' : ''}>
            🏭 Buildings
          </NavLink>
          <NavLink to="/processes" className={({ isActive }) => isActive ? 'active' : ''}>
            ⚙️ Processes
          </NavLink>
          <NavLink to="/npc-buyers" className={({ isActive }) => isActive ? 'active' : ''}>
            💰 NPC Buyers
          </NavLink>
          <NavLink to="/debug" className={({ isActive }) => isActive ? 'active' : ''}>
            🔧 Debug
          </NavLink>
        </nav>
        <div className="header-right">
          <span className="user-email">{user?.email}</span>
          <span className="last-refresh">
            {lastRefresh ? `Last refresh: ${lastRefresh.toLocaleTimeString()}` : ''}
          </span>
          <button onClick={handleRefresh} className="btn-refresh">
            🔄 REFRESH ALL
          </button>
          <button onClick={logout} className="btn-logout">
            Logout
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
