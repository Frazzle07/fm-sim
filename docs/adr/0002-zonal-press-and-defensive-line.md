# ADR 0002 — Zonal Press and Defensive Line Movement

**Status:** Accepted

## Context

The original `PressAction` fired only for `FWD` players and targeted whoever held the ball, regardless of the ball's location on the pitch or the position of the ball-holder. This meant forwards chased the opposition goalkeeper and defenders in their own third, and midfielders never pressed at all. The defensive line (`HoldAction`) returned `baseY` unconditionally — no positional compactness during attack or defence.

Three behaviours were needed:
1. The defensive line should push up when the ball is in the opposition's half and drop when it is in their own half.
2. Pressing duties should be distributed by position group, not assigned entirely to forwards.
3. Players should press in their own lane (lateral band), not be dragged across the pitch.

## Decision

### Zonal Press

Pressing is governed by ball position relative to the defending team's attacking direction, divided into three zones:

- **Opposition defensive third** — FWDs press the ball-holder.
- **Midfield third** — MIDs press; FWDs drop.
- **Own defensive third** — no active pressing; DEFs rely on `TackleAction`.

This was chosen over **role-to-role pressing** (each position always hunts its positional counterpart regardless of ball location), which produces absurd behaviour — midfielders sprinting across the pitch to press an opponent standing idle near their own goal.

### Lane pressing

Within the correct position tier for the active zone, a presser targets the opponent whose `baseX` is closest to their own `baseX`. No explicit lane field is added to `MatchPlayer`; lane identity is inferred from `baseX` proximity each tick. This avoids a schema change to `ActionContext` while producing correct lateral discipline.

### Defensive line movement

All players (including GK, with a tighter cap) shift their target `y` each tick based on ball `y`, regardless of who has possession. The shift is linear: the deeper into the opposition half the ball is, the closer the line pushes to the halfway line. Hard caps: outfield players stop at the halfway line; GKs advance to a shallow limit. `x` is unchanged — the line moves in depth only. This is applied in `HoldAction` as the fallback for all players not pressing or tackling.

Ball possession is deliberately ignored in this formula — the line shape is purely positional, not reactive to which team has the ball. This keeps the logic stateless and avoids a split between "attacking shape" and "defensive shape" that would require phase tracking.

## Consequences

- `PressAction` gains a zone check: `canExecute` returns false if the ball is not in the zone assigned to the player's position group.
- `PressAction` gains a lane check: the press target is the opponent in the same zone whose `baseX` is closest, not simply the ball-holder.
- `HoldAction` gains a line-depth calculation based on `ball.y`.
- A new `MidPressAction` (or an extended `PressAction`) handles MID pressing in the midfield zone with the same lane logic.
- DEF pressing in the own third is out of scope — `TackleAction` already handles close-range defensive engagement.
