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
The attractiveness of a candidate position for an off-ball attacker. Multiplicative combination of three measures: `openness` (distance to nearest defender, penalised softly by proximity to teammates), `laneSafety` (clearance of the passing lane from ball holder to that position — geometric only, using `distToSegment` with a fixed obstruction radius), and `depthAlignment` (how close the candidate depth is to `ball.y + idealBallOffset` for the player's role — peaks at the ideal depth, falls off as a soft multiplier). All three must be non-zero for a position to score well. Players hold their current position when their space score exceeds `HOLD_THRESHOLD`; only climb when it drops below.

**Role**
A sub-classification within a position group that governs off-ball movement shape and Tactical Zone. Exposed on `MatchPlayer` so any action can specialise behaviour by role. Current roles: `LW` (left winger), `RW` (right winger), `CF` (centre forward), `CAM`, `CM`, `CDM`, `LB`, `CB`, `RB`. Position (GK/DEF/MID/FWD) continues to govern Zonal Press logic; Role governs movement.

**Attacking Position**
The off-ball movement behaviour for attacking players when their team has possession. Implemented as `AttackingPositionAction`. Each tick, a player probes 8 compass directions at a fixed distance and moves toward the probe position with the highest Space Score. `idealBallOffset` on the role's `ZoneConfig` biases the starting probe toward the role's preferred depth (ahead of ball for CF, behind for CDM) but the climb can move anywhere within the Tactical Zone if space demands it. Players hold position when already well-placed (score above `HOLD_THRESHOLD`). When the team loses possession the player switches to Defensive Position instead.

**Tactical Zone**
The hard rectangular bounds within which a player's Attacking Position climb is constrained. Role-specific and possession-aware: a wide attacker uses a larger, higher zone when their team has the ball (pushing into the attacking third) and a smaller, deeper zone when the opposition has possession (dropping to help defend). Prevents players drifting to absurd positions while still allowing organic repositioning within their area of responsibility.

**Man-Marking**
The defensive off-ball behaviour for DEFs and MIDs when the opposing team has possession. Each defending player independently runs a greedy nearest-pair assignment: rank all (defender, attacker) pairs by distance, assign closest pair first, repeat. Each defender reads off their own slot. Assigned defenders track their attacker — moving toward them to deny space. Stateless, recalculated per tick, no simulator changes required.

**Covering Position**
The fallback position for a defender with no attacker assigned (surplus defenders after man-marking). The defender holds a position between the ball and their own goal: `x` tracks the ball laterally, `y` holds the defensive line depth (`baseY`). Produces a sweeper/libero shape without explicit role assignment.

**Defensive Position**
The default defensive off-ball behaviour for all outfield players when the opposition has possession. Each player finds the opposition player in their active Tactical Zone whose `baseX` is closest to their own (their channel opponent). They then position goal-side of that player: laterally at the midpoint between the opponent's current `x` and their own `baseX`, and at a fixed `COVER_DEPTH` behind the opponent toward their own goal. This puts them between the opponent and the goal, ready to press once the ball arrives in their zone. If no opposition player is currently in the player's active zone, the player falls back to their defensive line position (`baseX` at defensive line depth). Recalculated each tick, stateless.

**Press Role Assignment**
When multiple forwards are pressing, each forward self-assigns its role each tick by comparing distances to the ball holder. The closest forward becomes the **primary presser** and moves directly toward the holder. All other forwards become **lane shadows** — each positions itself at the midpoint between the holder and the best available forward pass receiver (highest `pressureScore × progressionValue` among the holder's teammates ahead of the ball). A forward only presses when the ball is within their active Tactical Zone — if the ball is outside their zone they fall back to Defensive Position instead. Role assignment is stateless and recalculated independently by each forward each tick; no shared state or simulator changes are needed.

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

**Pass Target**
The point in space a pass is aimed at — not necessarily the receiver's current position. Computed as the receiver's position plus a **Lead Offset**. A pass to feet, a ball played in front of a runner, and a ball laid to the side are all the same mechanism with different offsets. The receiver is no longer pinned: once the ball is in flight they run onto the Pass Target, so arrival is a contested race rather than a guaranteed reception.

**Lead Offset**
The 2D vector added to a receiver's position to form the **Pass Target**. Chosen by probing several candidate points around the receiver and measuring the openness (nearest-opponent distance) at each, then selecting the most open — so the ball is played into real space rather than blindly along the receiver's run. The receiver's intended travel (their off-ball movement target this tick, falling back to the attacking direction when stationary) is a *bias*, not the sole input: when forward space is open the probe favours leading the runner ahead (picture: a free runner gets the ball played into stride); when a defender sits goal-side of the receiver, the probe finds the open pocket to the side or short of them, *against* the travel vector, away from the marker (picture: ball laid into the space behind/beside a receiver whose forward run is blocked). Magnitude scales with how open the chosen point is and is capped by a maximum lead; a receiver hemmed in on all sides collapses the offset toward zero (a pass to feet). It is never gated to zero purely because a defender is goal-side: a forward lead into open space is still attempted when the receiver is favoured to win the race for it.

The probe is a sampling scaffold, not the final target. The 8 compass points only locate the open *region*; the actual landing point is continuous — the bearing is interpolated between the winning probe and its higher-scoring neighbour (so the target lands anywhere on the open arc, not snapped to one of 8 spokes), the radius is set by the openness-scaled magnitude (already non-constant), and a small noise term is added. The result: no two passes in the same situation produce an identical landing point, and the offset never visibly quantises. This mirrors how the engine injects life elsewhere (PassAction score noise, per-player movement jitter).

**Contested Arrival**
The principle that a pass outcome is never certain. PassAction applies only a light favouredness filter at selection time (don't attempt hopeless balls); the genuine resolution happens in flight via the existing interception check, which — because the receiver is now unpinned and running onto the **Pass Target** — becomes a real race between the receiver closing on the ball and any defender doing the same. A defender being nearer the receiver does not preclude the pass; the receiver may still reach the ball first.

**Loose Ball**
A ball with no holder, resting at (or rolling near) its **Pass Target** after flight completes, collectable by whichever player reaches it first. Replaces the former model where flight completion (`t >= 1`) automatically handed possession to the named receiver. Now the ball travels to the Target, then sits loose; possession transfers on proximity — receiver or defender, whoever wins the foot-race. Both teams actively pursue a loose ball (see **LooseBallAction**), so a ball played into space is genuinely contestable on arrival. This is the state that makes **Contested Arrival** literal rather than cosmetic; it also unifies led balls, overhit balls, and deflections under one "nearest player collects" rule.

**LooseBallAction**
The movement behaviour that sends players to pursue a **Loose Ball**. When the ball has no holder, the single closest player on *each* team targets the ball's current position and collects it on proximity; everyone else keeps running their normal action, preserving team shape. Each player self-assigns statelessly per tick ("am I my team's closest to the loose ball?"), mirroring how **Press Role Assignment** picks the primary presser. Supersedes **ReceiveAction**'s named-receiver chase once the ball is loose — the named receiver holds no special status; if a teammate is marginally closer, they collect it instead, even though the pass was aimed elsewhere.

**ReceiveAction**
The movement behaviour for the player a pass is currently inbound to (`ctx.ballReceiverId`). Highest-priority movement action while the ball is in flight, replacing the simulator's former practice of pinning the receiver in place. Predominantly the receiver runs to the **Pass Target** (the landing point), claiming the space. Exception: when a defender is closing on the Pass Target, the receiver instead comes short — moving up the flight line toward the passer to take the ball earlier and shrink the defender's interception window. The exception concerns only contestation *of the target*; a receiver marked tight on their own body is handled at pass time by a shrunken **Lead Offset**, not here.

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
The set of `BallAction` objects evaluated each tick for the ball carrier only. No longer a priority list: every eligible action proposes an **Expected Gain** and the carrier picks the maximum (the **Ball Action Arbiter**). The earlier pass-first priority ordering was provisional — see [ADR 0003](docs/adr/0003-ball-action-pipeline-is-provisional.md) and its successor [ADR 0004](docs/adr/0004-ball-action-arbiter.md), which moved the arbiter ahead of the shoot action because pass-vs-dribble proved to be a genuine peer trade-off, not a fallback.

**Ball Action Arbiter**
The carrier's decision mechanism: each eligible `BallAction` proposes an **Expected Gain** on one shared scale, and the carrier executes the action with the highest gain. Replaces the priority pipeline. `canExecute` still gates *eligibility* (is this action even possible — e.g. is there a legal pass target), but no longer decides *selection*; among eligible actions, the maximum Expected Gain wins. Adding shoot later means adding a third proposer, not re-ordering a list. Lives as a dedicated `chooseBallAction` function in `actions/` (not in the simulator), preserving the **Simulator**'s "makes no decisions" principle and keeping the arbiter unit-testable without driving a full tick. Each action exposes `propose(ctx) → { gain, command }`: it computes its best move and that move's Expected Gain together (one pass, no double scoring), the arbiter compares `gain`, and the winning action's `command` is applied by the simulator. Selection adds a small noise term so identical situations don't resolve identically (engine house style). `propose()` is **pure** — it reads `ctx.playerState` but never advances it, so pricing a losing action's gain can't corrupt its state. For a `StatefulBallAction` (the dribbler's **Carry Gear**/dwell) the simulator runs the existing `updateState → store → execute-with-state` machinery only on the arbiter's *winner*; the gear roll therefore stays strictly downstream of selection, which is also why the carry's **Survival Probability** uses a neutral Jog estimate at propose-time (no gear has been rolled yet).

**State Value**
A single shared function `stateValue(ballPosition, holder, survivalProbability) → [0,1]` estimating how good a ball state is: a probability-weighted measure of progression toward the opponent goal (using **attackingDepth**) discounted by the chance possession survives (**Survival Probability**). The one place the "how good is this" judgement lives — both the current ball state and every action's resulting state are scored through it. Forward-compatible with shooting (a shot's resulting value is its xG).

**Survival Probability**
The `P` term in **State Value**: the probability the team still has the ball after an action resolves. One fixed *definition*, but each `BallAction` supplies its own *estimator* keyed to its own failure mode — a pass dies to a lane interception (estimated from lane safety + receiver openness, reusing PassAction's existing math); a carry dies to a tackle (estimated from nearest-defender proximity + drive odds). Same meaning, different formulas: a `P = 0.7` pass and a `P = 0.7` carry must denote the same real-world retention chance, so the two estimators are held to that shared definition rather than forced through one curve. The carry estimator uses a *neutral* (Jog-equivalent) retention estimate: the **Ball Action Arbiter** decides *whether* to carry, and the **Carry Gear** machinery (Drive Tendency, Speed Slew) then chooses *how fast* downstream of that decision — the stochastic gear roll never feeds back into the pass-vs-dribble choice.

**Expected Gain**
What each `BallAction` proposes to the **Ball Action Arbiter**: the *marginal* improvement an action would produce, `stateValue(after) − stateValue(now)`, on a shared `[-1, 1]`-ish scale. Marginal, not absolute, so a sideways or backward pass that doesn't progress the ball scores near zero while a carry into open space scores positive — the carrier does the thing that improves the team's position most, not merely a thing that is possible. A shot later proposes `xG − stateValue(now)`.

**Dribble**
A `BallAction`, and the fallback when no pass clears the bar: the carrier **carries** the ball into space rather than releasing it. The ball stays glued to the carrier (`ball.x = carrier.x, ball.y = carrier.y`). Direction is chosen by the **Carry Objective** (omnidirectional — any of 8 compass points — and *not* zone-clamped: the carrier is the one player free to leave their Tactical Zone wherever space leads). Speed is chosen by the **Carry Gear**. Returns `{ type: "dribble", toX, toY }` plus the chosen speed; the simulator sets the carrier's movement target and applies the carry speed. On reaching the target the pipeline re-evaluates normally — no special transition.

**Carry Objective**
The function scoring each of the 8 candidate dribble directions for the ball carrier. Distinct from off-ball **Space Score**: it omits `laneSafety` (the carrier isn't being passed to) and `depthAlignment` (the carrier isn't zone-clamped). Two factors only, initially: **openness** (distance from the nearest defender at the candidate point) combined with a **forward bias** (reward for candidates nearer the opponent goal). Net effect: with space everywhere the forward-most open direction wins (carry forward); when forward is blocked, openness dominates and the carrier turns sideways or back into space. Deliberately minimal — an explicit "away from marker" term is omitted on the expectation it emerges from openness, to be added only if carriers are observed running toward markers.

**Carry Gear**
The carrier's *target* movement speed while dribbling, selected each carry as one of three gears — **Walk** (~0.5× base, no defender near: deep buildup, unpressured probing), **Jog** (~1.0×, a defender is around but not committed), **Drive** (>1.0×, a defender is close *and* open space exists ahead — the burst that lets a carrier beat a man). Each gear is a *centre*, not a fixed value: a small ± jitter is applied around it (mirroring the engine's house style of named-constant-plus-noise), while player-to-player speed differences come from **Pace**, not randomness. "Deep players walk the ball" is *emergent* from pressure + space, not a position rule. Engaging **Drive** is gated by **Drive Tendency** (a stochastic roll), and the realised Drive speed is bounded by the player's pace attribute (see **Pace**). The chosen gear commits for a short dwell window (held in the carrier's per-player state) so it does not flicker tick-to-tick. The *actual* speed slews toward the gear target rather than snapping — see **Speed Slew**.

**Speed Slew**
The carrier's actual speed multiplier is moved toward the **Carry Gear** target by a capped step each tick, rather than jumping to it — so a carrier *winds up* into Drive over several ticks, giving a defender a beat to react and making "knock it past and accelerate" feel earned. Distinct from the **Carry Gear** dwell window: dwell stabilises the *choice* of gear; slew smooths its *execution*. Carrier-only for now; the slew *rate* is a stubbed constant, to be set later by a per-player **Acceleration** attribute (the natural partner to **Pace**: Pace is top speed, Acceleration is how fast you reach it). Not yet applied to off-ball movement (pressers still snap) — that awaits a fuller acceleration model.

**Drive Tendency**
A per-**Role** probability (0–1) that the carrier engages **Drive** when the situation invites it (close defender + open space ahead). High for wide attackers, low for centre-backs. Models "a defender *can* sprint with the ball but is far less likely to" — role gates the *likelihood* of sprinting, never the *top speed* (which is the player's **Pace**). Stored on the role's `ZoneConfig`.

**Pace**
A *player attribute* setting the maximum movement speed — intrinsic to the player, identical ceiling for a fast defender and a fast winger. Distinct from **Drive Tendency**, which is the role-driven *likelihood* of reaching for that speed with the ball. Currently **stubbed**: every player shares one constant `maxSpeed` on `MatchPlayer`, a seam to be wired through `PlayerStats` and the generator later. Eventually governs *all* movement (pressing and recovery too), not just carrying.

**Tick Stages**
The fixed sequence within each `advance()` call:
1. Compute movement targets — evaluate movement pipeline for all players
2. Compute ball command — evaluate ball action pipeline for the carrier
3. Apply movement — step each player toward their target
4. Apply ball command — update ball flight / holder
5. Advance ball flight — interpolate ball position
6. Emit frame
