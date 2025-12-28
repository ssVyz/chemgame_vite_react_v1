// Database types mirroring Supabase tables

export interface Player {
  player_id: string;
  player_name: string;
  player_factory: string;
  player_cash: number;
  player_pollution: number;
  building_space: number;
  build_space_occupied: number;
  player_dry_storage: number;
  player_dry_storage_reserved: number;
  player_dry_storage_occupied: number;
  player_fluid_storage: number;
  player_fluid_storage_reserved: number;
  player_fluid_storage_occupied: number;
  player_gas_storage: number;
  player_gas_storage_reserved: number;
  player_gas_storage_occupied: number;
}

export interface PlayerMaterial {
  res_id: number;
  res_code: string;
  amount: number;
}

export interface PlayerBuilding {
  this_building_id: number;
  building_id: number;
  building_code: string;
  b_current_status: string;
  b_proc_installed: number | null;
  b_proc_status: string | null;
  b_proc_autorun: boolean;
}

export interface BuildingCatalogue {
  building_id: number;
  building_code: string;
  building_name: string;
  building_cost: number;
  building_space_req: number;
  building_build_time: number;
  building_tech_req: number | null;
}

export interface ProcessCatalogue {
  proc_id: number;
  proc_code: string;
  proc_name: string;
  proc_category: string;
  proc_install_cost: number;
  proc_install_time: number;
  proc_run_cost: number;
  proc_run_time: number;
  proc_run_pollut: number;
  proc_tech_req: number | null;
}

export interface MaterialCatalogue {
  res_id: number;
  res_code: string;
  res_name: string;
  res_phase: string;
  res_description_text: string | null;
  res_dispose_cost: number | null;
  res_dispose_pollut: number | null;
  res_color1: string | null;
  res_color2: string | null;
}

export interface AllowedProcess {
  building_id: number;
  allow_proc: number;
}

export interface ProcessInput {
  proc_id: number;
  res_id: number;
  amount: number;
}

export interface ProcessOutput {
  proc_id: number;
  res_id: number;
  amount: number;
}

export interface EventSchedule {
  id: number;
  cash_receive: number | null;
  ends_at: string;
}

export interface ProcessSchedule {
  id: number;
  proc_id: number;
  number_runs: number;
  runs_in_this_building_id: number;
  ends_at: string;
}

export interface NpcBuyer {
  npc_buyer_id: number;
  npc_buyer_name: string;
  buy_res_id: number;
  buy_price: number;
  current_demand: number;
}

export interface StorageExtensionCatalogue {
  s_extension_id: number;
  s_extension_code: string;
  s_extension_name: string;
  s_extension_cost: number;
  s_extension_space_req: number;
  s_extension_build_time: number;
  s_extension_add_dry_storage: number;
  s_extension_add_fluid_storage: number;
  s_extension_add_gas_storage: number;
}

export interface PlayerStorageExtension {
  this_s_extension_id: number;
  created_at: string;
  s_extension_id: number;
  s_ext_current_status: 'under_construction' | 'completed';
  s_ext_finished_building: boolean;
}

export interface PlayerExpansion {
  entry_id: number;
  player_auth: string;
  expansion_level: number;
  base_cost: number;
}

// API response wrapper
export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Market types
export interface MarketSellOrder {
  sell_order_id: number;
  created_at: string;
  creator_factory: string;
  res_id: number;
  res_amount: number;
  res_price: number;
}

// Auth types
export interface AuthUser {
  id: string;
  email: string;
}

// Technology types
export interface TechnologyCatalogue {
  tech_id: number;
  created_at: string;
  tech_name: string;
  tech_code: string;
  tech_cost: number;
  tech_time: number; // in minutes
}

export interface PlayerTechnologyInventory {
  this_tech_id: number;
  created_at: string;
  player_auth: string;
  tech_id: number;
  tech_status: 'in_progress' | 'completed';
  // REMOVED: technology_catalogue?: TechnologyCatalogue;
}

export interface TechnologyPrerequisite {
  tech_req_id: number;
  tech_to_research: number;
  tech_required: number;
}

export interface TechnologyResearchMaterial {
  tech_mat_id: number;
  tech_id: number;
  res_id: number;
  res_amount: number;
  materials_catalogue?: {
    res_name: string;
    res_code: string;
  };
}