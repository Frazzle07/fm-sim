---
name: FM-SIM Domain Glossary
description: Canonical terminology for the FM-SIM football simulation domain
---

# FM-SIM Domain Glossary

## Match Simulation

**Buildup**
A named phase of play from a goal kick (or equivalent restart) through the defensive passing sequence, until the ball reaches a midfielder. Runs through the shared action pipeline (pass → dribble) with a `PhaseConfig` that restricts GK short passes and defines exit roles. Ends when the ball is received by a CDM or CM (`exitRoles`), or when the GK plays a long ball (pass to a forward when no short option scores well).

**PhaseConfig**
Optional configuration passed through `ActionContext` that adapts the shared action pipeline to a specific phase. Fields: `gkReceiverRoles` (restricts who the GK can short-pass to), `exitRoles` (roles whose receipt triggers a phase transition). Phases that need no special rules pass no config.

**Action Pipeline**
The priority-ordered list of `Action` objects evaluated each tick for the ball carrier. Each action implements `canExecute(ctx)` and `execute(ctx)`. The first action whose `canExecute` returns true fires. Separate pipelines exist per phase (e.g. buildup uses `pass → dribble`; attack uses `shoot → cross → pass → dribble`).

**Off-ball Positioning**
Player movement targets for players not directly involved in the current action. Handled as a separate concern outside the action pipeline — a `getOffBallTargets` style function called alongside (not inside) actions. During buildup: possessing team spreads to create outlets; opposing forwards press the holder and shadow passing lanes.

**Space Score**
The attractiveness of a candidate position for an off-ball attacker. Combines two measures: `openness` (distance to nearest defender — higher is better) and `laneSafety` (clearance of the passing lane from ball holder to that position — higher means less blocked). A player gradient-climbs toward positions with increasing space score each tick.

**Role**
A sub-classification within a position group that governs off-ball movement shape and Tactical Zone. Exposed on `MatchPlayer` so any action can specialise behaviour by role. Current roles: `LW` (left winger), `RW` (right winger), `CF` (centre forward), `CAM`, `CM`, `CDM`, `LB`, `CB`, `RB`. Position (GK/DEF/MID/FWD) continues to govern Zonal Press logic; Role governs movement.

**Gradient Climb**
The off-ball movement strategy for attacking players when their team has possession. Each tick, a player probes 8 compass directions at a distance proportional to their current space score (more space → larger probe, bigger stride). They move toward whichever probe position scores highest. Bounded by the active Tactical Zone — players cannot leave the zone even if space lies beyond it. When the team loses possession the player switches to Channel Cover or Man-Marking instead of climbing.

**Tactical Zone**
The hard rectangular bounds within which a player's gradient climb is constrained. Role-specific and possession-aware: a wide attacker uses a larger, higher zone when their team has the ball (pushing into the attacking third) and a smaller, deeper zone when the opposition has possession (dropping to help defend). Prevents players drifting to absurd positions while still allowing organic repositioning within their area of responsibility.

**Man-Marking**
The defensive off-ball behaviour for DEFs and MIDs when the opposing team has possession. Each defending player independently runs a greedy nearest-pair assignment: rank all (defender, attacker) pairs by distance, assign closest pair first, repeat. Each defender reads off their own slot. Assigned defenders track their attacker — moving toward them to deny space. Stateless, recalculated per tick, no simulator changes required.

**Covering Position**
The fallback position for a defender with no attacker assigned (surplus defenders after man-marking). The defender holds a position between the ball and their own goal: `x` tracks the ball laterally, `y` holds the defensive line depth (`baseY`). Produces a sweeper/libero shape without explicit role assignment.

**Channel Cover**
The defensive off-ball behaviour for a wide attacker (e.g. LW, RW) when the opposition has possession. The player finds the opposition player whose `baseX` is closest to their own (the player in their channel — typically the opposing fullback or wide midfielder), then positions at the midpoint between the ball and that player. Sits in the passing lane to deny the route into the channel. Recalculated each tick, stateless. Distinct from Covering Position (which tracks the ball laterally at defensive line depth) and Man-Marking (which tracks the assigned attacker directly).

**Press Role Assignment**
When multiple forwards are pressing, each forward self-assigns its role each tick by comparing distances to the ball holder. The closest forward becomes the **primary presser** and moves directly toward the holder. All other forwards become **lane shadows** — each positions itself at the midpoint between the holder and the best available forward pass receiver (highest `pressureScore × progressionValue` among the holder's teammates ahead of the ball). Role assignment is stateless and recalculated independently by each forward each tick; no shared state or simulator changes are needed.

**Zonal Press**
The rule governing which position group presses based on where the ball is on the pitch. Divided into three zones relative to the defending team's direction of attack: (1) **opposition defensive third** — FWDs press; (2) **midfield third** — MIDs press, FWDs drop; (3) **own defensive third** — DEFs rely on tackling, MIDs and FWDs hold shape. Zone boundaries are at `y=0.33` and `y=0.67` (pitch-absolute), interpreted relative to each team's attacking direction. A player only presses when the ball is in the zone assigned to their position group.

**Lane**
The implicit vertical band of the pitch a player is responsible for, derived from their `baseX`. Players press the opposition player — within the correct position tier for the current **Zonal Press** zone — whose `baseX` is closest to their own `baseX`. No explicit lane field exists; lane identity is inferred from `baseX` proximity each tick.

**Defensive Line**
The target depth of the entire defending team, computed each tick from ball `y` regardless of which team has possession. When the ball is in the opposition's half, the line pushes up toward the halfway line; when it is in the team's own half, the line holds near `baseY`. The shift is linear and proportional to how deep into the opposition half the ball sits. Hard caps: outfield players cannot cross the halfway line (`y=0.5`); GKs advance only slightly (home cap `y=0.12`, away cap `y=0.88`). `x` positions are unaffected — the line moves as a unit in depth only. Applied via `HoldAction` as the fallback movement target for all players not currently pressing or tackling.

**Phase**
A named stage of the match state machine. Current phases: `kickoff`, `buildup`, `midfield`, `attack`, `chance`, `goal`, `save`, `counter`, `corner`. Each phase governs player movement targets and stochastic transitions.

**Pressure Score**
A continuous value (0.0–1.0) representing how free a player is from the nearest opponent. Derived from `nearestOppDist` — higher means more space. Not a binary flag. Used as the primary weight in pass selection during buildup.

**Progression Value**
A continuous value (0.0–1.0) representing how far up the pitch a candidate receiver is, normalised to the attacking direction. A free midfielder scores higher than a free defender because their progression value is higher, not because of their role directly.

**Pass Score**
The combined attractiveness of passing to a candidate: `pressureScore × progressionValue + noise`. Pressure and progression are multiplicative — a marked midfielder scores lower than a free defender.

**Long Ball**
A goalkeeper punt that bypasses the defensive buildup entirely. Triggered probabilistically when the GK's best pass option scores below a threshold (everyone is pressed). Ends the buildup phase immediately with possession contested. Distinct from a headed duel (not yet modelled).

**Drawing the Press**
The emergent behaviour where defenders pass between each other because midfielders are marked. Not explicitly coded — arises from the pass scoring formula: marked midfielders have low pressure scores, so free defenders outscore them until the press shifts.

**Header Duel**
A contested long ball where the striker and a defender compete for possession in the air. Not yet implemented — deferred for a future phase.

## Match Simulator

**Simulator**
The tick loop owner. Advances match state one tick at a time, sequences the four stages per tick, and emits a `SimFrame`. Does not make decisions — delegates all action selection to the action pipeline.

**MatchPlayer**
A read-only, lean view of a player exposed to actions via `ActionContext`. Contains only: `id`, `name`, `position`, `isHome`, `x`, `y`. Simulator internals (jitter phases, movement frequencies) are not exposed.

**ActionContext**
The read-only snapshot passed to every action each tick. Contains: `player` (the acting player as `MatchPlayer`), `allPlayers` (all players as `MatchPlayer[]`), `ball`, `ballHolderId`, `phase`, `tick`.

**Action**
Governs movement for a single player. Implements `canExecute(ctx): boolean` and `execute(ctx): XY`. The simulator evaluates the movement action pipeline in priority order — the first action whose `canExecute` returns true fires and returns a movement target.

**BallAction**
Governs what the ball carrier does with the ball. Implements `canExecute(ctx): boolean` and `execute(ctx): BallCommand`. Evaluated against the ball action pipeline (pass → shoot → dribble) for the carrier only.

**BallCommand**
The output of a `BallAction`. A discriminated union describing what happens to the ball: `{ type: "pass", receiverId, flight }` or similar. The simulator applies the command after all movement targets are computed.

**Movement Action Pipeline**
Priority-ordered list of `Action` objects evaluated each tick for every player. First action whose `canExecute` returns true fires. Lives in `actions/` — adding a new movement behaviour means adding a new action file, not editing the simulator.

**Ball Action Pipeline**
Priority-ordered list of `BallAction` objects evaluated each tick for the ball carrier only. Ordered: dribble → pass → shoot. Dribble fires first when the carrier has open space ahead (no opponent within `DRIBBLE_SPACE_RADIUS` in the attacking direction); pass fires when a lane exists; shoot when in range. Dribble is not a pure fallback — it is a genuine first choice when space exists.

**Dribble**
A `BallAction` that moves the ball carrier forward (toward the opponent's goal) by a fixed step when open space exists ahead. The ball stays glued to the carrier — `ball.x = carrier.x, ball.y = carrier.y` throughout. Returns `{ type: "dribble", toX, toY }`. The simulator sets the carrier's movement target to `(toX, toY)`. On reaching the target, the pipeline re-evaluates normally — no special transition. `DRIBBLE_SPACE_RADIUS = 0.15` (opponent-free zone ahead required to trigger).

**Dribble Step**
The fixed forward distance a carrier moves per dribble evaluation. Small enough to re-evaluate frequently; large enough to produce visible forward progress. Tunable constant.

**Tick Stages**
The fixed sequence within each `advance()` call:
1. Compute movement targets — evaluate movement pipeline for all players
2. Compute ball command — evaluate ball action pipeline for the carrier
3. Apply movement — step each player toward their target
4. Apply ball command — update ball flight / holder
5. Advance ball flight — interpolate ball position
6. Emit frame
