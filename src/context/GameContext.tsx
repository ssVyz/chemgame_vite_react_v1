import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { gameClient } from '../api/gameClient';
import { useAuth } from './AuthContext';
import type {
  BuildingCatalogue,
  ProcessCatalogue,
  MaterialCatalogue,
} from '../types';

interface GameContextType {
  buildingsCatalogue: Map<number, BuildingCatalogue>;
  processCatalogue: Map<number, ProcessCatalogue>;
  materialsCatalogue: Map<number, MaterialCatalogue>;
  cataloguesLoaded: boolean;
  refreshAll: () => Promise<void>;
  lastRefresh: Date | null;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [buildingsCatalogue, setBuildingsCatalogue] = useState<Map<number, BuildingCatalogue>>(new Map());
  const [processCatalogue, setProcessCatalogue] = useState<Map<number, ProcessCatalogue>>(new Map());
  const [materialsCatalogue, setMaterialsCatalogue] = useState<Map<number, MaterialCatalogue>>(new Map());
  const [cataloguesLoaded, setCataloguesLoaded] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Load catalogues when user logs in
  useEffect(() => {
    if (user) {
      loadCatalogues();
    } else {
      // Clear catalogues on logout
      setBuildingsCatalogue(new Map());
      setProcessCatalogue(new Map());
      setMaterialsCatalogue(new Map());
      setCataloguesLoaded(false);
    }
  }, [user]);

  const loadCatalogues = async () => {
    try {
      // Load buildings catalogue
      const buildingsResult = await gameClient.get_buildings_catalogue();
      if (buildingsResult.success && buildingsResult.data) {
        const map = new Map<number, BuildingCatalogue>();
        buildingsResult.data.forEach((b) => map.set(b.building_id, b));
        setBuildingsCatalogue(map);
      }

      // Load process catalogue
      const processResult = await gameClient.get_process_catalogue();
      if (processResult.success && processResult.data) {
        const map = new Map<number, ProcessCatalogue>();
        processResult.data.forEach((p) => map.set(p.proc_id, p));
        setProcessCatalogue(map);
      }

      // Load materials catalogue
      const materialsResult = await gameClient.get_materials_catalogue();
      if (materialsResult.success && materialsResult.data) {
        const map = new Map<number, MaterialCatalogue>();
        materialsResult.data.forEach((m) => map.set(m.res_id, m));
        setMaterialsCatalogue(map);
      }

      setCataloguesLoaded(true);
    } catch (error) {
      console.error('Failed to load catalogues:', error);
    }
  };

  const refreshAll = useCallback(async () => {
    // Run all resolvers
    await gameClient.runResolvers();
    setLastRefresh(new Date());
  }, []);

  const value = {
    buildingsCatalogue,
    processCatalogue,
    materialsCatalogue,
    cataloguesLoaded,
    refreshAll,
    lastRefresh,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
