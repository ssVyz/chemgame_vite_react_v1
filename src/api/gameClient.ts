import { supabase } from './supabase';
import type {
  ApiResult,
  Player,
  PlayerMaterial,
  PlayerBuilding,
  BuildingCatalogue,
  ProcessCatalogue,
  MaterialCatalogue,
  AllowedProcess,
  ProcessInput,
  ProcessOutput,
  EventSchedule,
  ProcessSchedule,
  NpcBuyer,
  StorageExtensionCatalogue,
  PlayerStorageExtension,
  PlayerExpansion,
  MarketSellOrder,
  TechnologyCatalogue,
  PlayerTechnologyInventory,
  TechnologyPrerequisite,
  TechnologyResearchMaterial,
} from '../types';
import { AuthApiError, Session, User } from '@supabase/supabase-js';

/**
 * Game client wrapper for Supabase operations
 * Mirrors the Python SupabaseGameClient class methods
 */
class GameClient {
  // ========================================================================
  // Authentication Methods
  // ========================================================================

  async login(email: string, password: string): Promise<ApiResult<User>> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error instanceof AuthApiError) {
          return { success: false, error: error.message };
        }
        return { success: false, error: error.message };
      }

      if (!data.user) {
        return { success: false, error: 'No user returned from login' };
      }

      return { success: true, data: data.user };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async signUp(email: string, password: string): Promise<ApiResult<User>> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        if (error instanceof AuthApiError) {
          return { success: false, error: error.message };
        }
        return { success: false, error: error.message };
      }

      if (!data.user) {
        return { success: false, error: 'No user returned from signup' };
      }

      return { success: true, data: data.user };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async logout(): Promise<void> {
    await supabase.auth.signOut();
  }

  async getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    return data.session;
  }

  async getUser(): Promise<User | null> {
    const { data } = await supabase.auth.getUser();
    return data.user;
  }

  // ========================================================================
  // Data Fetching Methods
  // ========================================================================

  async get_player_data(): Promise<ApiResult<Player>> {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as Player };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async get_player_materials(): Promise<ApiResult<PlayerMaterial[]>> {
    try {
      const { data, error } = await supabase
        .from('player_materials_inventory')
        .select('*');

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as PlayerMaterial[] };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  // Alias for consistency with Python naming
  async get_player_materials_inventory(): Promise<ApiResult<PlayerMaterial[]>> {
    return this.get_player_materials();
  }

  async get_player_buildings(): Promise<ApiResult<PlayerBuilding[]>> {
    try {
      const { data, error } = await supabase
        .from('player_buildings_inventory')
        .select('*');

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as PlayerBuilding[] };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  // Alias for consistency
  async get_player_buildings_inventory(): Promise<ApiResult<PlayerBuilding[]>> {
    return this.get_player_buildings();
  }

  async get_buildings_catalogue(): Promise<ApiResult<BuildingCatalogue[]>> {
    try {
      const { data, error } = await supabase
        .from('buildings_catalogue')
        .select('*');

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as BuildingCatalogue[] };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async get_process_catalogue(): Promise<ApiResult<ProcessCatalogue[]>> {
    try {
      const { data, error } = await supabase
        .from('process_catalogue')
        .select('*');

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as ProcessCatalogue[] };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async get_materials_catalogue(): Promise<ApiResult<MaterialCatalogue[]>> {
    try {
      const { data, error } = await supabase
        .from('materials_catalogue')
        .select('*');

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as MaterialCatalogue[] };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async get_allowed_processes(building_id: number): Promise<ApiResult<AllowedProcess[]>> {
    try {
      const { data, error } = await supabase
        .from('buildings_allowed_processes')
        .select('*')
        .eq('building_id', building_id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as AllowedProcess[] };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async get_process_inputs(proc_id: number): Promise<ApiResult<ProcessInput[]>> {
    try {
      const { data, error } = await supabase
        .from('process_inputs')
        .select('*')
        .eq('proc_id', proc_id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as ProcessInput[] };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async get_process_outputs(proc_id: number): Promise<ApiResult<ProcessOutput[]>> {
    try {
      const { data, error } = await supabase
        .from('process_outputs')
        .select('*')
        .eq('proc_id', proc_id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as ProcessOutput[] };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async get_events_schedule(): Promise<ApiResult<EventSchedule[]>> {
    try {
      const { data, error } = await supabase
        .from('events_schedule')
        .select('*');

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as EventSchedule[] };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async get_process_schedule(): Promise<ApiResult<ProcessSchedule[]>> {
    try {
      const { data, error } = await supabase
        .from('process_schedule')
        .select('*');

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as ProcessSchedule[] };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async get_npc_buyers(): Promise<ApiResult<NpcBuyer[]>> {
    try {
      const { data, error } = await supabase
        .from('npc_material_buyers')
        .select('*');

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as NpcBuyer[] };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  // Alias for Python naming
  async get_npc_material_buyers(): Promise<ApiResult<NpcBuyer[]>> {
    return this.get_npc_buyers();
  }

  async get_player_processes(): Promise<ApiResult<ProcessSchedule[]>> {
    return this.get_process_schedule();
  }

  // ========================================================================
  // RPC Calls (Game Actions)
  // ========================================================================

  async build_new_building(building_id: number): Promise<ApiResult<unknown>> {
    try {
      const { data, error } = await supabase.rpc('build_new_building', {
        p_building_id: building_id,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async finish_construction(): Promise<ApiResult<unknown>> {
    try {
      const { data, error } = await supabase.rpc('finish_construction');

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async install_process(this_building_id: number, proc_id: number): Promise<ApiResult<unknown>> {
    try {
      const { data, error } = await supabase.rpc('install_process_on_building', {
        p_this_building_id: this_building_id,
        p_proc_id: proc_id,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async uninstall_process(this_building_id: number): Promise<ApiResult<unknown>> {
    try {
      const { data, error } = await supabase.rpc('uninstall_process_on_building', {
        p_this_building_id: this_building_id,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async run_process(this_building_id: number, amount_runs: number): Promise<ApiResult<unknown>> {
    try {
      const { data, error } = await supabase.rpc('run_process', {
        p_this_building_id: this_building_id,
        p_amount_runs: amount_runs,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async activate_autorun(this_building_id: number): Promise<ApiResult<unknown>> {
    try {
      const { data, error } = await supabase.rpc('activate_autorun', {
        p_this_building_id: this_building_id,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async deactivate_autorun(this_building_id: number): Promise<ApiResult<unknown>> {
    try {
      const { data, error } = await supabase.rpc('deactivate_autorun', {
        p_this_building_id: this_building_id,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async resolve_building_processes(): Promise<ApiResult<unknown>> {
    try {
      const { data, error } = await supabase.rpc('resolve_building_processes');

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async resolve_process_runs(): Promise<ApiResult<unknown>> {
    try {
      const { data, error } = await supabase.rpc('resolve_process_runs');

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async resolve_scheduled_cash(): Promise<ApiResult<unknown>> {
    try {
      const { data, error } = await supabase.rpc('resolve_scheduled_cash');

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async request_cash(amount: number): Promise<ApiResult<unknown>> {
    try {
      const { data, error } = await supabase.rpc('request_cash', { amount });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async demolish_building(this_building_id: number): Promise<ApiResult<unknown>> {
    try {
      const { data, error } = await supabase.rpc('demolish_building', {
        p_this_building_id: this_building_id,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async dispose_resources(res_id: number, amount: number): Promise<ApiResult<unknown>> {
    try {
      const { data, error } = await supabase.rpc('dispose_resources', {
        p_res_id: res_id,
        p_amount: amount,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async sell_to_npc(npc_buyer_id: number, amount: number): Promise<ApiResult<number>> {
    try {
      const { data, error } = await supabase.rpc('sell_to_npc', {
        p_npc_buyer_id: npc_buyer_id,
        p_amount: amount,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as number };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  // ========================================================================
  // Market Methods
  // ========================================================================

  async get_market_sell_orders(): Promise<ApiResult<MarketSellOrder[]>> {
    try {
      const { data, error } = await supabase.rpc('get_market_sell_orders');

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as MarketSellOrder[] };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async create_sell_order(p_res_id: number, p_amount: number, p_price: number): Promise<ApiResult<MarketSellOrder>> {
    try {
      const { data, error } = await supabase.rpc('create_sell_order', {
        p_res_id,
        p_amount,
        p_price,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as MarketSellOrder };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async cancel_sell_order(p_sell_order_id: number): Promise<ApiResult<unknown>> {
    try {
      const { data, error } = await supabase.rpc('cancel_sell_order', {
        p_sell_order_id,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async buy_from_sell_order(p_sell_order_id: number, p_amount: number): Promise<ApiResult<unknown>> {
    try {
      const { data, error } = await supabase.rpc('buy_from_sell_order', {
        p_sell_order_id,
        p_amount,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  // ========================================================================
  // Storage Extensions Methods
  // ========================================================================

  async get_storage_extensions_catalogue(): Promise<ApiResult<StorageExtensionCatalogue[]>> {
    try {
      const { data, error } = await supabase
        .from('storage_extensions_catalogue')
        .select('*');

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as StorageExtensionCatalogue[] };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async get_player_storage_extensions(): Promise<ApiResult<PlayerStorageExtension[]>> {
    try {
      const { data, error } = await supabase
        .from('player_storage_extensions_inventory')
        .select('*');

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as PlayerStorageExtension[] };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async build_new_storage_extension(s_extension_id: number): Promise<ApiResult<PlayerStorageExtension>> {
    try {
      const { data, error } = await supabase.rpc('build_new_storage_extension', {
        p_s_extension_id: s_extension_id,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as PlayerStorageExtension };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async finish_storage_extension_construction(): Promise<ApiResult<PlayerStorageExtension[]>> {
    try {
      const { data, error } = await supabase.rpc('finish_storage_extension_construction');

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as PlayerStorageExtension[] };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async demolish_storage_extension(this_s_extension_id: number): Promise<ApiResult<unknown>> {
    try {
      const { data, error } = await supabase.rpc('demolish_storage_extension', {
        p_this_s_extension_id: this_s_extension_id,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  // ========================================================================
  // Building Space Upgrade Methods
  // ========================================================================

  async get_player_expansions(): Promise<ApiResult<PlayerExpansion | null>> {
    try {
      const { data, error } = await supabase
        .from('player_expansions')
        .select('*')
        .maybeSingle();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as PlayerExpansion | null };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async upgrade_building_space(): Promise<ApiResult<PlayerExpansion>> {
    try {
      const { data, error } = await supabase.rpc('upgrade_building_space');

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as PlayerExpansion };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  // ========================================================================
  // Technology Methods
  // ========================================================================

  async get_technology_catalogue(): Promise<ApiResult<TechnologyCatalogue[]>> {
    try {
      const { data, error } = await supabase.from('technology_catalogue').select('*');

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as TechnologyCatalogue[] };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async get_player_technology_inventory(): Promise<ApiResult<PlayerTechnologyInventory[]>> {
    try {
      // Don't use embedded selects since there's no foreign key relationship
      const { data, error } = await supabase
        .from('player_technology_inventory')
        .select('*');

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as PlayerTechnologyInventory[] };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async get_technology_prerequisites(): Promise<ApiResult<TechnologyPrerequisite[]>> {
    try {
      const { data, error } = await supabase
        .from('technology_tech_required')
        .select('tech_to_research, tech_required');

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as TechnologyPrerequisite[] };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async get_technology_research_materials(): Promise<ApiResult<TechnologyResearchMaterial[]>> {
    try {
      const { data, error } = await supabase
        .from('technology_research_materials')
        .select('tech_mat_id, tech_id, res_id, res_amount, materials_catalogue(res_name, res_code)');

      if (error) {
        return { success: false, error: error.message };
      }

      // Map the query result to our expected type
      // Supabase returns materials_catalogue as an object (not array) for foreign key relationships
      const mappedData = (data || []).map((item: any) => ({
        tech_mat_id: item.tech_mat_id,
        tech_id: item.tech_id,
        res_id: item.res_id,
        res_amount: item.res_amount,
        materials_catalogue: item.materials_catalogue
          ? {
              res_name: item.materials_catalogue.res_name,
              res_code: item.materials_catalogue.res_code,
            }
          : undefined,
      })) as TechnologyResearchMaterial[];

      return { success: true, data: mappedData };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async start_research(p_tech_id: number): Promise<ApiResult<boolean>> {
    try {
      const { data, error } = await supabase.rpc('technology_start_research', {
        p_tech_id,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as boolean };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Run all resolvers (like refresh_all in Python client)
   */
  async runResolvers(): Promise<void> {
    await this.resolve_scheduled_cash();
    await this.finish_construction();
    await this.finish_storage_extension_construction();
    await this.resolve_building_processes();
    await this.resolve_process_runs();
  }
}

// Export singleton instance
export const gameClient = new GameClient();