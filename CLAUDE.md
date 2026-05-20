# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

FM-SIM is a browser-based football (soccer) management simulation game. The player manages a team through a league season — buying/selling players, simulating weekly match fixtures, and tracking standings. All game logic runs entirely client-side with no backend.

## Commands

```bash
pnpm dev          # Start dev server on port 3000
pnpm build        # Production build
pnpm test         # Run all tests (Vitest)
pnpm check        # Biome lint + format check (run before committing)
pnpm lint         # Biome lint only
pnpm format       # Biome format only
```

To run a single test file:
```bash
pnpm vitest run src/domains/match/engine.test.ts
```

To add UI components:
```bash
pnpm dlx shadcn@latest add button
```

## Architecture

### Game logic (`src/game.ts` + `src/domains/`)

All simulation logic is fully decoupled from React — plain TypeScript, no imports of React anywhere.

**[game.ts](src/game.ts)** is the top-level orchestrator. Import from here for game actions:
- `createNewGame` — initialises a fresh season
- `advanceDay` — simulates all fixtures scheduled for the next date, updates standings, returns played fixtures
- `processTransfer`, `listPlayerForSale` — re-exported from the transfer domain
- `sortedStandings` — re-exported from the league domain

**[GameState.ts](src/GameState.ts)** holds the root `GameState` interface (the single source of truth passed through React context).

**Domains** (`src/domains/`) contain the granular logic, each with clearly bounded responsibilities:

| Domain | Files | Responsibility |
|---|---|---|
| `player` | `types.ts`, `generator.ts` | `Player`, `PlayerStats`, `Position` types; player and squad generation |
| `team` | `types.ts`, `generator.ts` | `Team` type; `generateLeague` (8 hardcoded teams, quality 63–80) |
| `match` | `types.ts`, `engine.ts`, `schedule.ts` | `Fixture`, `MatchResult`, `MatchEvent` types; `simulateMatch` (Poisson model); `generateFixtures` (double round-robin) |
| `league` | `types.ts`, `standings.ts`, `news.ts` | `Standing` type; `applyResult`, `sortedStandings`; news headline generation |
| `transfer` | `types.ts`, `market.ts` | `TransferOffer` type; `processTransfer`, `listPlayerForSale` |

Domain files only import from sibling domains or deeper — never from `game.ts` or React.

### UI (`src/FootballManager.tsx`)

A single large React component that owns all game state via `useState`. It renders four tab views — Dashboard, Squad, Transfers, League Table — and a MatchReport overlay. It calls into the engine functions directly for game logic.

This component is intentionally monolithic at this stage of the project.

### Routing

TanStack Router with file-based routing. Routes live in `src/routes/`. The root layout is `src/routes/__root.tsx`; the index route at `src/routes/index.tsx` renders `<FootballManager />`. Add new routes by creating files in `src/routes/` — the router plugin auto-generates the boilerplate.

### Path Aliases

`#/*` maps to `./src/*` (configured in `package.json` `imports` field). Examples:
- `#/game` — top-level game actions
- `#/GameState` — root `GameState` type
- `#/domains/match/types` — domain-specific types
- `#/domains/player/generator` — domain-specific logic

Prefer `#/` aliases over relative paths when importing across directory boundaries.

## Key Simulation Details

- **Scoring model**: Poisson distribution parameterised by expected goals; strength ratio between teams sets the λ values.
- **Player form**: Each player has a `form` value (0–10) that scales their contribution to team strength in `teamStrength()`.
- **Transfers**: Only the player's team actively buys/sells. AI teams do not make transfers.
- **Season length**: 14 weeks (each of 8 teams plays every other team twice).
