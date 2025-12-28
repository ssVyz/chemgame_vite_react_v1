import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { gameClient } from '../api/gameClient';
import { useEffect, useState } from 'react';

export function ProtectedRoute() {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [playerExists, setPlayerExists] = useState<boolean | null>(null);
  const [checkingPlayer, setCheckingPlayer] = useState(false);

  // Check if player exists in database
  useEffect(() => {
    const checkPlayer = async () => {
      if (!user || authLoading) {
        return;
      }

      // Skip check if already on onboarding page
      if (location.pathname === '/onboarding') {
        setPlayerExists(true); // Allow access to onboarding
        setCheckingPlayer(false);
        return;
      }

      setCheckingPlayer(true);
      const result = await gameClient.get_player_data();
      
      if (result.success && result.data) {
        setPlayerExists(true);
      } else {
        // Player doesn't exist - redirect to onboarding
        setPlayerExists(false);
      }
      setCheckingPlayer(false);
    };

    checkPlayer();
  }, [user, authLoading, location.pathname]);

  // Show loading while checking authentication or player existence
  if (authLoading || checkingPlayer || (user && playerExists === null)) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If player doesn't exist and not on onboarding page, redirect to onboarding
  if (playerExists === false && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
