import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { GameProvider } from './context/GameContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { NewPlayerReg } from './pages/NewPlayerReg';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardPage } from './pages/DashboardPage';
import { BuildingsPage } from './pages/BuildingsPage';
import { ProcessesPage } from './pages/ProcessesPage';
import { ResearchPage } from './pages/ResearchPage';
import { ProcessEncyclopediaPage } from './pages/ProcessEncyclopediaPage';
import { NpcBuyersPage } from './pages/NpcBuyersPage';
import { MarketPage } from './pages/MarketPage';
import { DebugPage } from './pages/DebugPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <GameProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<NewPlayerReg />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              {/* Onboarding page - accessible without player entry */}
              <Route path="/onboarding" element={<OnboardingPage />} />
              
              {/* Other protected routes require player entry */}
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/buildings" element={<BuildingsPage />} />
                <Route path="/processes" element={<ProcessesPage />} />
                <Route path="/research" element={<ResearchPage />} />
                <Route path="/process-encyclopedia" element={<ProcessEncyclopediaPage />} />
                <Route path="/npc-buyers" element={<NpcBuyersPage />} />
                <Route path="/market" element={<MarketPage />} />
                {/* Debug route kept but navigation link hidden in Layout.tsx for playtesting purposes */}
                <Route path="/debug" element={<DebugPage />} />
              </Route>
            </Route>

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </GameProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
