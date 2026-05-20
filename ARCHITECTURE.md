# FM-SIM Architecture

## Overview

FM-SIM is a fully client-side football management sim. There is no backend — all state lives in the browser via React state + `localStorage`. The codebase splits cleanly into two layers:

- **Game logic** — pure TypeScript, zero React imports. Lives in `src/game.ts` and `src/domains/`.
- **UI** — React components that read game state and call game functions. Lives in `src/`.

This separation means game logic can be tested, reasoned about, and extended without touching the UI.

---

## Data flow

```
User action (button click)
       │
       ▼
FootballManager.tsx  ──calls──▶  game.ts (advanceDay / processTransfer / etc.)
                                      │
                                      ▼
                               DayProcessor[]  (pipeline of pure fns)
                                      │
                              ┌───────┴────────┐
                              ▼                ▼
                       processMatches    (future processors…)
                              │
                    simulateMatch() ──▶ applyResult() ──▶ generateNews()
                              │
                              ▼
                     updated GameState  +  DayEvent[]
                              │
                              ▼
               React re-renders from new state
```

Every "tick" of the game is `advanceDay`, which runs a **processor pipeline** and returns a new immutable `GameState`. The UI never mutates state directly.

---

## Core types

### `GameState` (`src/GameState.ts`)

The single source of truth. Passed through React context to all components.

```ts
interface GameState {
  playerTeamId: string;
  week: number;
  season: number;
  currentDate: string;   // ISO date, YYYY-MM-DD
  teams: Team[];
  fixtures: Fixture[];
  standings: Standing[];
  transferMarket: Player[];
  news: string[];
}
```

### `DayProcessor` (`src/GameState.ts`)

The contract every day-processor must implement:

```ts
type DayProcessor = (state: GameState, date: string, events: DayEvent[]) => GameState;
```

Processors are **pure**: they receive the current state, mutate nothing, and return a new state. They push `DayEvent` objects into the shared `events` array so that downstream steps (e.g. news generation) can react to what happened.

### `DayEvent`

A tagged-union message emitted by processors:

```ts
interface DayEvent {
  type: DayEventType;      // e.g. "matchPlayed"
  payload: Record<string, unknown>;
}
```

---

## The processor pipeline (`src/game.ts`)

```ts
const processors: DayProcessor[] = [
  processMatches,
  // processTransfers  ← add here when AI transfers land
  // processTraining   ← add here when training lands
];
```

`advanceDay` runs each processor in order, threading state through. After all processors run, `generateNews` converts the emitted events into human-readable news strings appended to `GameState.news`.

---

## Domain map

| Domain | Key files | What it owns |
|---|---|---|
| `player` | `types.ts`, `generator.ts` | `Player`, `PlayerStats`, `Position`; squad generation |
| `team` | `types.ts`, `generator.ts` | `Team`; `generateLeague` (8 teams, quality 63–80) |
| `match` | `types.ts`, `engine.ts`, `schedule.ts`, `processor.ts` | Fixture scheduling; Poisson-based `simulateMatch`; `processMatches` DayProcessor |
| `league` | `types.ts`, `standings.ts`, `news.ts` | `Standing`; `applyResult`; `sortedStandings`; news generation |
| `transfer` | `types.ts`, `market.ts` | `TransferOffer`; `processTransfer`; `listPlayerForSale` |

**Import rule**: domain files only import from sibling domains or deeper — never from `game.ts` or React.

---

## Match simulation (`src/domains/match/engine.ts`)

1. `teamStrength(team)` — picks the best available 11 (1 GK + 10 outfield), computes `rating × (form / 7)` average.
2. Home side gets a +3 strength bonus.
3. Expected goals (xG) for each side = `(strength / total) × rand(1.8, 3.2)`.
4. Actual goals drawn from a Poisson distribution parameterised by xG.
5. `generateEvents` assigns goal scorers, yellow cards (1–3 per game), and an 8% red card chance.

---

## UI layer (`src/FootballManager.tsx`)

A single component that:

- Holds game state via `useGameStore` (wraps `useState` + `localStorage` persistence).
- Provides state + action handlers down the tree via `GameContext`.
- Renders tab views (Dashboard, Squad, Transfers, League Table) and a `MatchReport` overlay.
- Calls `advanceDay`, `listPlayerForSale`, `processTransfer` — all imported from `#/game`.

The component is intentionally monolithic at this stage. Child components read from `GameContext` and call handlers passed down as props.

---

## How to add a new core feature

Here's the wiring for a feature like **Player Training**, **Injuries**, or **AI Transfers** — anything that should happen automatically each day.

### Step 1 — Extend `GameState` if needed

Add any new state to `GameState.ts`:

```ts
// src/GameState.ts
export interface GameState {
  // ... existing fields
  trainingSchedule: TrainingSlot[];  // ← new
}
```

Also extend `DayEventType` if your feature emits events:

```ts
export type DayEventType = "matchPlayed" | "trainingCompleted";
```

### Step 2 — Build the domain

Create `src/domains/training/` with:

- `types.ts` — your new types (`TrainingSlot`, etc.)
- `processor.ts` — the `DayProcessor` function

```ts
// src/domains/training/processor.ts
import type { DayProcessor } from "#/GameState";

export const processTraining: DayProcessor = (state, _date, events) => {
  // compute new state, push events
  return { ...state, /* updated fields */ };
};
```

Keep this file free of React imports. Test it with Vitest directly.

### Step 3 — Register the processor

Add it to the pipeline in `game.ts`:

```ts
// src/game.ts
import { processTraining } from "#/domains/training/processor";

const processors: DayProcessor[] = [
  processMatches,
  processTraining,   // ← add here
];
```

Order matters — processors run sequentially and each sees the state returned by the previous one.

### Step 4 — Handle events in `generateNews` (if needed)

If your processor emits events, teach `generateNews` to produce headlines for them:

```ts
// src/domains/league/news.ts
if (event.type === "trainingCompleted") {
  // return headline strings
}
```

### Step 5 — Expose actions via `game.ts` (if player-triggered)

For actions the player can trigger manually (not just day-tick), add or re-export functions through `game.ts` so the UI has a single import point:

```ts
// src/game.ts
export { scheduleTraining } from "#/domains/training/processor";
```

### Step 6 — Wire into the UI

In `FootballManager.tsx`, add a `useCallback` handler that calls `updateGame(g => yourNewFn(g, ...args))` and pass it through `GameContext` to whichever component needs it. Add the corresponding UI (a new tab, a button, a modal) in `src/routes/` or as a new component.

### Summary checklist

```
[ ] types.ts in the new domain (if needed)
[ ] DayProcessor in the domain's processor.ts
[ ] Registered in the processors[] array in game.ts
[ ] DayEventType extended in GameState.ts (if emitting events)
[ ] generateNews updated (if events should produce headlines)
[ ] game.ts re-exports any player-triggered actions
[ ] FootballManager.tsx handler + GameContext plumbing
[ ] Vitest tests for the processor in isolation
```
