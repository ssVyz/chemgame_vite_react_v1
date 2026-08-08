# Changelog

All notable changes to the **front-end** of this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Scope:** This changelog and the version number track the **front-end code only**.
> Database schema work is developed in parallel and is intentionally **not** versioned here.
> See `CLAUDE.md` for the versioning rules.

## [Unreleased]

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
[0.1.0]: #010---2026-08-08
