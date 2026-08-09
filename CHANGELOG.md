# Changelog

All notable changes to the **front-end** of this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Scope:** This changelog and the version number track the **front-end code only**.
> Database schema work is developed in parallel and is intentionally **not** versioned here.
> See `CLAUDE.md` for the versioning rules.

## [Unreleased]

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
[0.1.1]: #011---2026-08-08
[0.1.0]: #010---2026-08-08
