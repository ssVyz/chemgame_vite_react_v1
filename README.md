# GardenWorld / ChemGame Web Client

A React + TypeScript web client for the ChemGame browser game, replacing the Python Tkinter client.

## Features

This web client mirrors the functionality of the Python Tkinter client:

- **Dashboard**: View player stats (cash, pollution, storage), materials inventory, dispose materials
- **Buildings**: View your buildings, build new buildings, demolish unconfigured buildings
- **Processes**: Install/uninstall processes on buildings, run processes, enable/disable autorun
- **NPC Buyers**: View NPC buyers and sell materials to them
- **Debug**: View session info, request debug cash, run resolvers, view raw data

## Prerequisites

- Node.js 18+ (recommended: Node.js 20+)
- npm 9+

## Setup

1. **Clone/copy the project** to your local machine

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and fill in your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. **Open the app** in your browser (usually http://localhost:5173)

## Usage

1. **Login** with your email and password (same credentials as the Python client)

2. **Navigate** using the tabs in the header:
   - 📊 Dashboard - Player overview and materials
   - 🏭 Buildings - Manage buildings
   - ⚙️ Processes - Install and run processes
   - 💰 NPC Buyers - Sell materials
   - 🔧 Debug - Developer tools

3. **Refresh** - Click "🔄 REFRESH ALL" to run all resolvers and update data

4. **Logout** - Click "Logout" in the header

## API Methods

The `gameClient` in `src/api/gameClient.ts` mirrors the Python `SupabaseGameClient`:

### Data Fetching
- `get_player_data()` - Player stats
- `get_player_materials()` / `get_player_materials_inventory()` - Materials inventory
- `get_player_buildings()` / `get_player_buildings_inventory()` - Buildings
- `get_buildings_catalogue()` - All building types
- `get_process_catalogue()` - All processes
- `get_materials_catalogue()` - All materials
- `get_allowed_processes(building_id)` - Processes allowed for a building type
- `get_process_inputs(proc_id)` - Process input materials
- `get_process_outputs(proc_id)` - Process output materials
- `get_events_schedule()` - Pending events (cash, etc.)
- `get_process_schedule()` - Running processes
- `get_npc_buyers()` / `get_npc_material_buyers()` - NPC buyers

### Game Actions (RPCs)
- `build_new_building(building_id)` - Start building construction
- `finish_construction()` - Complete pending constructions
- `install_process(this_building_id, proc_id)` - Install process on building
- `uninstall_process(this_building_id)` - Uninstall process
- `run_process(this_building_id, amount_runs)` - Run a process
- `activate_autorun(this_building_id)` - Enable autorun
- `deactivate_autorun(this_building_id)` - Disable autorun
- `resolve_building_processes()` - Update building process states
- `resolve_process_runs()` - Complete finished process runs
- `resolve_scheduled_cash()` - Deliver scheduled cash
- `request_cash(amount)` - Debug: request cash
- `demolish_building(this_building_id)` - Demolish unconfigured building
- `dispose_resources(res_id, amount)` - Dispose materials
- `sell_to_npc(npc_buyer_id, amount)` - Sell to NPC buyer

## Project Structure

```
gardenworld-client/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .env.example
└── src/
    ├── main.tsx          # Entry point
    ├── App.tsx           # Root component with routing
    ├── index.css         # Global styles
    ├── vite-env.d.ts     # Vite environment types
    ├── api/
    │   ├── supabase.ts   # Supabase client init
    │   └── gameClient.ts # Game API wrapper
    ├── context/
    │   ├── AuthContext.tsx   # Auth state management
    │   └── GameContext.tsx   # Game state (catalogues)
    ├── components/
    │   ├── Layout.tsx        # App shell with nav
    │   └── ProtectedRoute.tsx # Auth guard
    ├── pages/
    │   ├── LoginPage.tsx
    │   ├── DashboardPage.tsx
    │   ├── BuildingsPage.tsx
    │   ├── ProcessesPage.tsx
    │   ├── NpcBuyersPage.tsx
    │   └── DebugPage.tsx
    └── types/
        └── index.ts      # TypeScript interfaces
```

## Verification Checklist

After running the app, verify:

1. **Login works** - Enter credentials, should redirect to dashboard
2. **Session persists** - Refresh browser, should stay logged in
3. **Dashboard loads** - Player stats and materials display
4. **Buildings tab** - Shows your buildings, can select one
5. **Build new** - Select a building type, click Build
6. **Processes tab** - Select building, see available processes
7. **Run process** - Select building with installed process, click Run
8. **NPC Buyers** - Shows buyers, can select and sell
9. **Debug** - Shows session, can request cash and run resolvers
10. **Logout** - Returns to login page

## Error Handling

The client handles errors at multiple levels:

- **Auth errors** - Invalid credentials, session expired
- **RLS/403 errors** - Row-level security denials
- **RPC failures** - Database function errors
- **Network errors** - Connection issues

Errors are displayed in status messages below each action.

## Notes

- This client uses `@supabase/supabase-js` v2
- Never use service role keys in browser code
- The database schema and RPCs are unchanged from the Python client
- Session is stored in localStorage by Supabase automatically
