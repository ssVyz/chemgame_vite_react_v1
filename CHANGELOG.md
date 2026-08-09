# Changelog

All notable changes to the **front-end** of this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Scope:** This changelog and the version number track the **front-end code only**.
> Database schema work is developed in parallel and is intentionally **not** versioned here.
> See `CLAUDE.md` for the versioning rules.

## [Unreleased]

## [0.1.3] - 2026-08-08

Phase 2 of the frontend rework: the consolidated Factory tab.

### Added
- New **Factory** tab (`/factory`) that merges building and process management
  into one place (D1):
  - Building cards with inline actions — install / uninstall process, run
    (with run count), autorun on/off, demolish — plus live status badges and
    construction/process timers.
  - Reusable **RecipeCard** (D5): process inputs → outputs as color material
    chips, with run cost/time/pollution (and install cost/time in pickers)
    (`src/components/game/RecipeCard.tsx`).
  - Card-based **pickers** (D3): build a building, install a process, and build
    a storage extension — each with cash / building-space / tech gating.
  - **Batch build** (build N of a building type) and **batch install** (install
    a process into N empty buildings of the same type).
  - Bulk actions: autorun all / none, uninstall all, demolish all.
  - Storage extensions are managed here too (build via picker, demolish inline).

### Changed
- `/buildings` and `/processes` now redirect to `/factory`; the nav shows a
  single “🏭 Factory” entry (the old Buildings/Processes pages are superseded).

## [0.1.2] - 2026-08-08

Phase 1 of the frontend rework (foundation + Dashboard). Existing pages remain
backward-compatible.

### Added
- Design-system foundation: CSS design tokens (`src/styles/tokens.css`) and
  reusable UI primitives — `Card`, `StatTile`, `Meter`, `Badge`, `MaterialChip`,
  `Modal` (`src/components/ui/`). Light mode, responsive.
- Helper libs: `src/lib/format.ts` (number/duration/time-remaining) and
  `src/lib/icons.ts` (placeholder building/process emoji, material-phase helpers).
- Central game store: `GameContext` now loads all catalogues, relations (recipes,
  allowed processes, tech prerequisites) and live player state once, exposing
  `refreshAll`/`refreshPlayer` plus `getRecipe`/`isBuildingUnlocked`/`isProcessUnlocked`.
- Bulk relation fetches in `gameClient`: `get_all_process_inputs`,
  `get_all_process_outputs`, `get_all_buildings_allowed_processes`.

### Changed
- Reworked the Dashboard into a factory overview: vital-stat tiles (cash,
  pollution, building space, building count), storage meters (dry/fluid/gas),
  a buildings-at-a-glance grid with live status badges/timers, and
  clutter-managed storage contents (grouped by phase, with filter and show-all)
  using color-coded material chips. Dispose and building-space upgrade preserved.

## [0.1.1] - 2026-08-08

### Fixed
- Building-space expansion cost was one power of ten too high (the base tier was
  skipped): the client computed `base_cost * 10^expansion_level`, so the first
  extension cost `base_cost * 10` instead of `base_cost`. Now uses
  `10^(expansion_level - 1)` in `DashboardPage`, matching the corresponding DB
  fix to `upgrade_building_space`. Pricing is now base, base×10, base×100, …

## [0.1.0] - 2026-08-08

### Added
- Baseline of the React + TypeScript web client for ChemGame (replacing the Python Tkinter client).
- Authentication and session handling (`AuthContext`, `LoginPage`, `ProtectedRoute`).
- New player registration and onboarding flow (`NewPlayerReg`, `OnboardingPage`).
- Dashboard with player stats, materials inventory, and material disposal (`DashboardPage`).
- Buildings management: view, build, and demolish (`BuildingsPage`).
- Processes: install/uninstall, run, and autorun toggling (`ProcessesPage`).
- Process encyclopedia and research views (`ProcessEncyclopediaPage`, `ResearchPage`).
- Market and NPC buyers with material selling (`MarketPage`, `NpcBuyersPage`).
- Leaderboard (`LeaderboardPage`).
- Debug tools: session info, request cash, run resolvers (`DebugPage`).
- Supabase-backed game client API wrapper (`src/api/gameClient.ts`, `src/api/supabase.ts`).

[Unreleased]: #unreleased
[0.1.3]: #013---2026-08-08
[0.1.2]: #012---2026-08-08
[0.1.1]: #011---2026-08-08
[0.1.0]: #010---2026-08-08
