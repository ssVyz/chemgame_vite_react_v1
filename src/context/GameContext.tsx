import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { gameClient } from '../api/gameClient';
import { useAuth } from './AuthContext';
import type {
  BuildingCatalogue,
  ProcessCatalogue,
  MaterialCatalogue,
  TechnologyCatalogue,
  StorageExtensionCatalogue,
  NpcBuyer,
  ProcessInput,
  ProcessOutput,
  TechnologyResearchMaterial,
  Player,
  PlayerMaterial,
  PlayerBuilding,
  PlayerStorageExtension,
  PlayerTechnologyInventory,
  PlayerExpansion,
  ProcessSchedule,
  EventSchedule,
  ClaimCatalogue,
  ClaimOutputCatalogue,
  PlayerClaim,
  PlayerClaimOutput,
} from '../types';

interface Recipe {
  inputs: ProcessInput[];
  outputs: ProcessOutput[];
}

interface GameContextType {
  // Catalogues (indexed by id)
  buildingsCatalogue: Map<number, BuildingCatalogue>;
  processCatalogue: Map<number, ProcessCatalogue>;
  materialsCatalogue: Map<number, MaterialCatalogue>;
  technologyCatalogue: Map<number, TechnologyCatalogue>;
  storageExtensionsCatalogue: Map<number, StorageExtensionCatalogue>;
  claimsCatalogue: Map<number, ClaimCatalogue>;
  npcBuyers: NpcBuyer[];

  // Relations
  processInputs: Map<number, ProcessInput[]>;   // by proc_id
  processOutputs: Map<number, ProcessOutput[]>;  // by proc_id
  allowedProcesses: Map<number, number[]>;       // building_id -> proc_id[]
  techRequired: Map<number, number[]>;           // tech_to_research -> required tech ids
  techResearchMaterials: Map<number, TechnologyResearchMaterial[]>; // tech_id -> materials
  claimOutputsCatalogue: Map<number, ClaimOutputCatalogue[]>;      // claim_id -> outputs

  // Live player state
  player: Player | null;
  materialsInventory: PlayerMaterial[];
  buildingsInventory: PlayerBuilding[];
  storageExtensionsInventory: PlayerStorageExtension[];
  technologyInventory: PlayerTechnologyInventory[];
  expansion: PlayerExpansion | null;
  processSchedule: ProcessSchedule[];
  eventsSchedule: EventSchedule[];
  playerClaims: PlayerClaim[];
  claimOutputs: Map<number, PlayerClaimOutput[]>;  // this_claim_id -> outputs
  completedTechIds: Set<number>;

  // Flags
  cataloguesLoaded: boolean;
  playerLoaded: boolean;
  lastRefresh: Date | null;

  // Selectors
  getRecipe: (procId: number) => Recipe;
  isBuildingUnlocked: (buildingId: number) => boolean;
  isProcessUnlocked: (procId: number) => boolean;

  // Actions
  refreshAll: () => Promise<void>;      // run resolvers + reload player state
  refreshPlayer: () => Promise<void>;   // reload player state only
}

const GameContext = createContext<GameContextType | undefined>(undefined);

function indexBy<T>(rows: T[], key: (row: T) => number): Map<number, T> {
  const m = new Map<number, T>();
  rows.forEach((r) => m.set(key(r), r));
  return m;
}

function groupBy<T>(rows: T[], key: (row: T) => number): Map<number, T[]> {
  const m = new Map<number, T[]>();
  rows.forEach((r) => {
    const k = key(r);
    const arr = m.get(k);
    if (arr) arr.push(r);
    else m.set(k, [r]);
  });
  return m;
}

export function GameProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // Catalogues
  const [buildingsCatalogue, setBuildingsCatalogue] = useState<Map<number, BuildingCatalogue>>(new Map());
  const [processCatalogue, setProcessCatalogue] = useState<Map<number, ProcessCatalogue>>(new Map());
  const [materialsCatalogue, setMaterialsCatalogue] = useState<Map<number, MaterialCatalogue>>(new Map());
  const [technologyCatalogue, setTechnologyCatalogue] = useState<Map<number, TechnologyCatalogue>>(new Map());
  const [storageExtensionsCatalogue, setStorageExtensionsCatalogue] = useState<Map<number, StorageExtensionCatalogue>>(new Map());
  const [claimsCatalogue, setClaimsCatalogue] = useState<Map<number, ClaimCatalogue>>(new Map());
  const [npcBuyers, setNpcBuyers] = useState<NpcBuyer[]>([]);

  // Relations
  const [processInputs, setProcessInputs] = useState<Map<number, ProcessInput[]>>(new Map());
  const [processOutputs, setProcessOutputs] = useState<Map<number, ProcessOutput[]>>(new Map());
  const [allowedProcesses, setAllowedProcesses] = useState<Map<number, number[]>>(new Map());
  const [techRequired, setTechRequired] = useState<Map<number, number[]>>(new Map());
  const [techResearchMaterials, setTechResearchMaterials] = useState<Map<number, TechnologyResearchMaterial[]>>(new Map());
  const [claimOutputsCatalogue, setClaimOutputsCatalogue] = useState<Map<number, ClaimOutputCatalogue[]>>(new Map());

  // Player state
  const [player, setPlayer] = useState<Player | null>(null);
  const [materialsInventory, setMaterialsInventory] = useState<PlayerMaterial[]>([]);
  const [buildingsInventory, setBuildingsInventory] = useState<PlayerBuilding[]>([]);
  const [storageExtensionsInventory, setStorageExtensionsInventory] = useState<PlayerStorageExtension[]>([]);
  const [technologyInventory, setTechnologyInventory] = useState<PlayerTechnologyInventory[]>([]);
  const [expansion, setExpansion] = useState<PlayerExpansion | null>(null);
  const [processSchedule, setProcessSchedule] = useState<ProcessSchedule[]>([]);
  const [eventsSchedule, setEventsSchedule] = useState<EventSchedule[]>([]);
  const [playerClaims, setPlayerClaims] = useState<PlayerClaim[]>([]);
  const [claimOutputs, setClaimOutputs] = useState<Map<number, PlayerClaimOutput[]>>(new Map());

  const [cataloguesLoaded, setCataloguesLoaded] = useState(false);
  const [playerLoaded, setPlayerLoaded] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadCatalogues = useCallback(async () => {
    const [
      buildings, processes, materials, tech, storageExt, npc,
      inputs, outputs, allowed, prereqs, researchMats,
      claims, claimOuts,
    ] = await Promise.all([
      gameClient.get_buildings_catalogue(),
      gameClient.get_process_catalogue(),
      gameClient.get_materials_catalogue(),
      gameClient.get_technology_catalogue(),
      gameClient.get_storage_extensions_catalogue(),
      gameClient.get_npc_buyers(),
      gameClient.get_all_process_inputs(),
      gameClient.get_all_process_outputs(),
      gameClient.get_all_buildings_allowed_processes(),
      gameClient.get_technology_prerequisites(),
      gameClient.get_technology_research_materials(),
      gameClient.get_claims_catalogue(),
      gameClient.get_claims_outputs_catalogue(),
    ]);

    if (buildings.success && buildings.data) setBuildingsCatalogue(indexBy(buildings.data, (b) => b.building_id));
    if (processes.success && processes.data) setProcessCatalogue(indexBy(processes.data, (p) => p.proc_id));
    if (materials.success && materials.data) setMaterialsCatalogue(indexBy(materials.data, (m) => m.res_id));
    if (tech.success && tech.data) setTechnologyCatalogue(indexBy(tech.data, (t) => t.tech_id));
    if (storageExt.success && storageExt.data) setStorageExtensionsCatalogue(indexBy(storageExt.data, (s) => s.s_extension_id));
    if (npc.success && npc.data) setNpcBuyers(npc.data);
    if (inputs.success && inputs.data) setProcessInputs(groupBy(inputs.data, (r) => r.proc_id));
    if (outputs.success && outputs.data) setProcessOutputs(groupBy(outputs.data, (r) => r.proc_id));
    if (allowed.success && allowed.data) {
      const m = new Map<number, number[]>();
      allowed.data.forEach((r) => {
        const arr = m.get(r.building_id);
        if (arr) arr.push(r.allow_proc);
        else m.set(r.building_id, [r.allow_proc]);
      });
      setAllowedProcesses(m);
    }
    if (prereqs.success && prereqs.data) {
      const m = new Map<number, number[]>();
      prereqs.data.forEach((r) => {
        const arr = m.get(r.tech_to_research);
        if (arr) arr.push(r.tech_required);
        else m.set(r.tech_to_research, [r.tech_required]);
      });
      setTechRequired(m);
    }
    if (researchMats.success && researchMats.data) {
      setTechResearchMaterials(groupBy(researchMats.data, (r) => r.tech_id));
    }
    if (claims.success && claims.data) setClaimsCatalogue(indexBy(claims.data, (c) => c.claim_id));
    if (claimOuts.success && claimOuts.data) setClaimOutputsCatalogue(groupBy(claimOuts.data, (r) => r.claim_id));

    setCataloguesLoaded(true);
  }, []);

  const loadPlayer = useCallback(async () => {
    const [
      playerRes, mats, builds, storageExt, techInv, exp, procSched, events,
      claimsInv, playerClaimOuts,
    ] = await Promise.all([
      gameClient.get_player_data(),
      gameClient.get_player_materials(),
      gameClient.get_player_buildings(),
      gameClient.get_player_storage_extensions(),
      gameClient.get_player_technology_inventory(),
      gameClient.get_player_expansions(),
      gameClient.get_process_schedule(),
      gameClient.get_events_schedule(),
      gameClient.get_player_claims(),
      gameClient.get_player_claims_outputs(),
    ]);

    if (playerRes.success && playerRes.data) setPlayer(playerRes.data);
    if (mats.success && mats.data) setMaterialsInventory(mats.data);
    if (builds.success && builds.data) setBuildingsInventory(builds.data);
    if (storageExt.success && storageExt.data) setStorageExtensionsInventory(storageExt.data);
    if (techInv.success && techInv.data) setTechnologyInventory(techInv.data);
    if (exp.success) setExpansion(exp.data ?? null);
    if (procSched.success && procSched.data) setProcessSchedule(procSched.data);
    if (events.success && events.data) setEventsSchedule(events.data);
    if (claimsInv.success && claimsInv.data) setPlayerClaims(claimsInv.data);
    if (playerClaimOuts.success && playerClaimOuts.data) {
      setClaimOutputs(groupBy(playerClaimOuts.data, (r) => r.player_claim_id));
    }

    setPlayerLoaded(true);
  }, []);

  useEffect(() => {
    if (user) {
      loadCatalogues();
      loadPlayer();
    } else {
      setBuildingsCatalogue(new Map());
      setProcessCatalogue(new Map());
      setMaterialsCatalogue(new Map());
      setTechnologyCatalogue(new Map());
      setStorageExtensionsCatalogue(new Map());
      setClaimsCatalogue(new Map());
      setNpcBuyers([]);
      setProcessInputs(new Map());
      setProcessOutputs(new Map());
      setAllowedProcesses(new Map());
      setTechRequired(new Map());
      setTechResearchMaterials(new Map());
      setClaimOutputsCatalogue(new Map());
      setPlayer(null);
      setMaterialsInventory([]);
      setBuildingsInventory([]);
      setStorageExtensionsInventory([]);
      setTechnologyInventory([]);
      setExpansion(null);
      setProcessSchedule([]);
      setEventsSchedule([]);
      setPlayerClaims([]);
      setClaimOutputs(new Map());
      setCataloguesLoaded(false);
      setPlayerLoaded(false);
    }
  }, [user, loadCatalogues, loadPlayer]);

  const refreshPlayer = useCallback(async () => {
    await loadPlayer();
    setLastRefresh(new Date());
  }, [loadPlayer]);

  const refreshAll = useCallback(async () => {
    await gameClient.runResolvers();
    await loadPlayer();
    setLastRefresh(new Date());
  }, [loadPlayer]);

  const completedTechIds = useMemo(() => {
    const s = new Set<number>();
    technologyInventory.forEach((t) => { if (t.tech_status === 'completed') s.add(t.tech_id); });
    return s;
  }, [technologyInventory]);

  const value = useMemo<GameContextType>(() => {
    const getRecipe = (procId: number): Recipe => ({
      inputs: processInputs.get(procId) ?? [],
      outputs: processOutputs.get(procId) ?? [],
    });
    const isBuildingUnlocked = (buildingId: number): boolean => {
      const req = buildingsCatalogue.get(buildingId)?.building_tech_req;
      return req == null || completedTechIds.has(req);
    };
    const isProcessUnlocked = (procId: number): boolean => {
      const req = processCatalogue.get(procId)?.proc_tech_req;
      return req == null || completedTechIds.has(req);
    };
    return {
      buildingsCatalogue, processCatalogue, materialsCatalogue, technologyCatalogue,
      storageExtensionsCatalogue, claimsCatalogue, npcBuyers,
      processInputs, processOutputs, allowedProcesses, techRequired, techResearchMaterials,
      claimOutputsCatalogue,
      player, materialsInventory, buildingsInventory, storageExtensionsInventory,
      technologyInventory, expansion, processSchedule, eventsSchedule,
      playerClaims, claimOutputs, completedTechIds,
      cataloguesLoaded, playerLoaded, lastRefresh,
      getRecipe, isBuildingUnlocked, isProcessUnlocked,
      refreshAll, refreshPlayer,
    };
  }, [
    buildingsCatalogue, processCatalogue, materialsCatalogue, technologyCatalogue,
    storageExtensionsCatalogue, claimsCatalogue, npcBuyers, processInputs, processOutputs, allowedProcesses,
    techRequired, techResearchMaterials, claimOutputsCatalogue,
    player, materialsInventory, buildingsInventory, storageExtensionsInventory,
    technologyInventory, expansion, processSchedule, eventsSchedule,
    playerClaims, claimOutputs, completedTechIds,
    cataloguesLoaded, playerLoaded, lastRefresh, refreshAll, refreshPlayer,
  ]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
