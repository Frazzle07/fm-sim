# PRD: Player Scouting System

## Problem Statement

The manager can only discover and sign players who are already listed on the transfer market. There is no way to proactively search for talent across the league — the player is entirely reactive, waiting for players to appear rather than sending scouts to watch games and build a pipeline of targets. This makes squad building feel passive and removes a core loop of football management.

## Solution

Introduce a scouting system that lets the manager run up to three concurrent scouting assignments. Each assignment has a dedicated scout who attends one fixture per day, evaluates every player in that match against the assignment's criteria, and gradually builds a report of discovered players. The scout's knowledge of each player improves with repeated sightings, so the PA estimate shown in the report narrows over time from a wide range to a tight one. The scouting page uses a master/detail layout — assignments listed on the left, the selected assignment's report on the right.

## User Stories

1. As a manager, I want to create a scouting assignment so that I can instruct a scout to look for players matching my tactical needs.
2. As a manager, I want to filter scouting assignments by position so that I only receive reports on players who fit my formation.
3. As a manager, I want to set a minimum age on an assignment so that I can target experienced players rather than youth.
4. As a manager, I want to set a maximum age on an assignment so that I can focus on younger talent with long-term potential.
5. As a manager, I want to set a maximum wage on an assignment so that the scout only surfaces players I can realistically afford.
6. As a manager, I want to run up to three assignments simultaneously so that I can scout multiple positions or age groups at the same time.
7. As a manager, I want each assignment to have its own dedicated scout so that multiple assignments do not slow each other down.
8. As a manager, I want the scout to attend one fixture per day so that scouting feels grounded in the match schedule.
9. As a manager, I want players who appear in a watched fixture and match the criteria to automatically appear on the report so that I do not have to manually trigger discovery.
10. As a manager, I want every eligible player in a watched fixture to be evaluated so that the scout does not miss players by chance.
11. As a manager, I want discovered players to appear only once on the report so that the list stays clean and readable.
12. As a manager, I want the report to show an estimated PA range for each discovered player so that I can assess their long-term potential without knowing their true PA.
13. As a manager, I want the PA estimate range to be wide on first sighting (±30) so that early scouting reports reflect genuine uncertainty.
14. As a manager, I want the PA estimate to narrow with each additional sighting of the same player so that sustained scouting yields more reliable intelligence.
15. As a manager, I want the PA estimate to tighten significantly after 3 sightings (±15) and become precise after 6 sightings (±5) so that I know how much to trust a report.
16. As a manager, I want the report to show each player's name, position, age, and current wage so that I can make informed decisions about approaching them.
17. As a manager, I want to see how many times the scout has watched each player so that I know how reliable the PA estimate is.
18. As a manager, I want to select an assignment from a list on the left side of the scouting page so that I can quickly switch between reports.
19. As a manager, I want to see all discovered players for the selected assignment in a panel on the right so that the layout is clear and focused.
20. As a manager, I want to see empty assignment slots with a prompt to create a new assignment so that I always know how many slots are available.
21. As a manager, I want to cancel an active assignment so that I can free up the slot for a different search.
22. As a manager, I want cancelling an assignment to clear its report so that stale data does not persist when I start a new search with the same slot.
23. As a manager, I want the assignment form to be displayed inline rather than in a modal so that the workflow stays on the same page.
24. As a manager, I want the scouting page to be accessible via a dedicated route so that I can navigate directly to it from the main navigation.

## Implementation Decisions

### Modules to build or modify

**New: Scouting domain (`src/domains/scouting/`)**
- `types.ts` — defines `ScoutingAssignment` and `ScoutedPlayer` interfaces
- `processor.ts` — a `DayProcessor` that runs after match results are settled; for each active assignment, picks one fixture played that day, evaluates every player on both teams against the assignment criteria, and upserts into `scoutedPlayers` with updated sighting count and recalculated PA estimate range
- `paEstimate.ts` — pure function: given a player's true PA and a sighting count, returns `{ low, high }` using the agreed accuracy tiers (±30 / ±15 / ±5)

The processor is a deep module — it takes `GameState` + date, returns updated `GameState`, and can be tested in isolation with no UI dependency.

**Modified: `GameState`**
- Add `scoutingAssignments: ScoutingAssignment[]` (max length 3)

**Modified: `game.ts`**
- Register the scouting processor in the `processors` pipeline after `processMatches` so that player data from that day's fixtures is available

**New: Scouting route (`src/routes/_app.scouting.tsx`)**
- Master/detail layout: left column lists assignment slots, right column shows the selected assignment's report
- Inline assignment creation form within the empty slot card
- Cancel button on active assignments
- Read-only player report table (name, position, age, wage, sightings, PA estimate range)

### Data shapes

`ScoutingAssignment`:
- `id`, `position` (nullable — null means any position), `minAge`, `maxAge`, `maxWage`, `scoutedPlayers`

`ScoutedPlayer`:
- `playerId`, `sightings`, `paEstimateLow`, `paEstimateHigh`

### PA estimate accuracy tiers

| Sightings | Range  |
|-----------|--------|
| 1–2       | ±30    |
| 3–5       | ±15    |
| 6+        | ±5     |

Clamped to [1, 200].

### Scout-to-fixture assignment

When multiple fixtures are scheduled on the same day, each scout picks one fixture independently (e.g. round-robin across available fixtures by assignment index). A scout never attends a fixture they have already used for discovery on the same day.

### Region

`Player` will gain a `region` field at generation time. For this release, all teams are assigned the same region and region is not a filterable condition. The field is added now to avoid a breaking schema change when multi-league support is introduced.

## Testing Decisions

Good tests for this feature test **observable outputs given controlled inputs** — not internal implementation details like which array index was chosen or how PA was interpolated. Avoid mocking the match engine; construct minimal `GameState` fixtures directly.

### Modules to test

**`paEstimate.ts`** — pure function, highest priority. Assert that:
- Sighting count 1 returns a range of exactly ±30 (clamped to [1, 200])
- Sighting count 3 returns ±15
- Sighting count 6 returns ±5
- Clamping works correctly at PA extremes (e.g. PA 10 does not go below 1)

**`processor.ts`** — integration-style unit test against a minimal `GameState`. Assert that:
- A player matching all criteria appears in `scoutedPlayers` after a day is processed
- A player not matching criteria (wrong position, outside age range, wage too high) does not appear
- A player seen in a second processed day increments `sightings` and narrows the PA range
- A player only appears once even if eligible in both teams (edge case: player on both team rosters is impossible by design, but confirm no duplicate upsert)
- No changes occur on a day with no fixtures

### Prior art

Existing processor tests (if any) in `src/domains/match/` or `src/domains/training/` serve as the structural template. The pattern is: build a minimal `GameState`, call the processor with a specific date, assert on the returned state.

## Out of Scope

- **Staff page** — scout cards and scout quality attributes are not part of this release
- **Scout quality affecting PA accuracy** — all scouts have identical accuracy tiers for now
- **Region filtering** — the `region` field is added to `Player` but is not a filterable condition until a second league exists
- **Transfer actions from the scouting report** — the report is read-only; approaching a player is done via the Transfers tab
- **AI team scouting** — only the player's team runs assignments
- **Scout fatigue or availability** — scouts always attend one fixture per available match day

## Further Notes

- The scouting processor must run **after** `processMatches` in the day pipeline so that `fixture.played` is already `true` and results are settled before player evaluation.
- The PA estimate is derived from the player's true `pa` field (which is already in the data model but hidden from the UI). The estimate shown in the report must never expose the raw `pa` value — only the computed `{ low, high }` range.
- When a fixture has no players on a team (edge case during testing), the processor should skip that fixture gracefully.
- The max of three assignments should be enforced in both the UI (disable the "New Assignment" button) and the domain layer (guard in the processor or a helper).
