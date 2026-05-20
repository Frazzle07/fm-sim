# PRD: Dynamic Player Attributes (CA/PA System)

## Problem Statement

Players in FM-SIM are static — their attributes never change across a season. This means there is no reason to invest in young players, no consequence to injuries beyond missed matches, and no satisfaction in watching a player you developed reach their potential. The game lacks the progression and long-term planning that makes football management compelling.

## Solution

Introduce a Current Ability (CA) / Potential Ability (PA) system where every player has a hidden ceiling (PA) and a current level (CA) that changes over time through training, match experience, aging, and injuries. Individual stats are derived from CA using position-specific weightings. The player never sees CA or PA directly — they observe attribute changes over time and must judge potential from age, personality, and natural fitness.

## User Stories

1. As a manager, I want young players to improve through training, so that investing in youth feels rewarding.
2. As a manager, I want player improvement to be gradual across multiple seasons, so that development feels realistic rather than instant.
3. As a manager, I want players aged 19–21 to develop the fastest, so that scouting and signing young players has strategic value.
4. As a manager, I want players over 27 to stop improving, so that I must make decisions about when a player has peaked.
5. As a manager, I want players to decline after age 31, so that I must plan squad transitions and avoid over-relying on aging stars.
6. As a manager, I want each player to have a natural fitness attribute, so that I can judge how gracefully an aging player will decline.
7. As a manager, I want natural fitness to be visible on a player's profile, so that I can make informed decisions about long-term contracts for older players.
8. As a manager, I want players to have personalities that affect how well they train, so that two players with identical attributes may develop at different rates.
9. As a manager, I want personality to be visible on a player's profile, so that I can prioritise signing hard-working players if I want a developing squad.
10. As a manager, I want playing matches to accelerate a young player's development, so that getting youth players game time feels meaningful.
11. As a manager, I want injured players to lose CA during their injury, so that long-term injuries feel like a genuine setback.
12. As a manager, I want an injured player to be able to train their CA back after recovery, so that injuries are a setback rather than permanent damage.
13. As a manager, I want goalkeeper attributes to reflect goalkeeping skills, so that GKs feel distinct from outfield players.
14. As a manager, I want player stats to visibly change over a season, so that I can observe the effects of training and match experience.
15. As a manager, I want a player's potential to remain hidden, so that assessing youth signings requires judgment and observation rather than reading a number.
16. As a manager, I want transfer prices to reflect current ability and age only, so that high-potential youngsters are not obviously flagged by their price.
17. As a manager, I want players who don't play matches to miss out on match-experience gains, so that squad rotation has a development cost.
18. As a manager, I want training to happen on every non-match day automatically, so that I don't need to manage training sessions manually.
19. As a manager, I want a lazy player to develop slower than their potential suggests, so that personality is a meaningful factor in recruitment.
20. As a manager, I want a Model Professional player to develop faster and maintain form into their 30s, so that character is as important as raw ability.
21. As a manager, I want a player with poor natural fitness to decline steeply after 31, so that I must replace aging squad members proactively.
22. As a manager, I want a player with excellent natural fitness to age gracefully, so that experienced players can remain useful later in their career.
23. As a manager, I want stat distributions to reflect a player's position, so that a striker's CA improvement is felt in shooting and pace, not defending.
24. As a manager, I want goalkeeper stats (reflexes, handling, positioning, kicking, aerial) to be shown instead of outfield stats, so that GK quality is meaningful and readable.

## Implementation Decisions

### New player fields

Every player gains the following fixed-at-generation fields:
- **`ca`** (1–200): current ability, the source of truth for player quality. Replaces `rating`.
- **`pa`** (1–200): potential ability, fixed ceiling. Hidden from the player in the UI.
- **`dateOfBirth`**: ISO date string. Age is always calculated dynamically from `currentDate` rather than stored statically.
- **`personality`**: one of five named values — Model Professional, Determined, Average, Lazy, Temperamental. Visible in UI.
- **`naturalFitness`** (1–20): governs post-31 decline rate. Visible in UI.

The existing `rating` field is removed. The match engine works directly from CA.

### Goalkeeper attributes

Goalkeepers have a separate stat set replacing the outfield `PlayerStats`:
- `reflexes`, `handling`, `positioning`, `kicking`, `aerial`

Outfield players retain `pace`, `shooting`, `passing`, `defending`, `physical`.

Stats are derived from CA using position-weighted distributions. CA is always the root; stats are a read projection of it.

### CA generation at player creation

- PA is generated independently of age in the range ~80–180.
- CA at generation is set as `PA × ageRatio`, where `ageRatio` scales from ~0.4 at age 17 to ~0.95 at age 34.
- This means older players start close to their ceiling; younger players have significant headroom.

### Training gains (non-match days)

Training applies automatically every day where no match is played.

**Formula:** `dailyGain = 0.05 × ageMultiplier × personalityModifier`

**Age multiplier curve:**
- Age 17–18: 0.7×
- Age 19–21: 1.0× (peak)
- Age 22–23: 0.5×
- Age 24–26: 0.2×
- Age 27+: 0×

**Personality modifier:**
- Model Professional: 1.5×
- Determined: 1.25×
- Average: 1.0×
- Lazy: 0.75×
- Temperamental: 0.5×

CA gains stop hard at PA. No dampening — players train at full rate until they hit their ceiling.

### Match experience gains (match days)

Players who feature in a match receive a CA gain that day instead of a training gain.

**Formula:** `matchGain = 0.15 × ageMultiplier × personalityModifier`

Players who do not play (injured or not selected) receive no gain that day.

### CA decline (age 31+)

Players aged 31 and over lose CA each day instead of gaining it.

**Decline rate by natural fitness:**
- 1–5 (Poor): ~0.15 CA/day (~9–10 CA/season)
- 6–10 (Average): ~0.10 CA/day (~6 CA/season)
- 11–15 (Good): ~0.07 CA/day (~4 CA/season)
- 16–20 (Excellent): ~0.04 CA/day (~2 CA/season)

### Injury CA impact

When a player is injured, they lose CA gradually across the injury duration (zero gain, only loss). CA loss is proportional to injury severity (duration in weeks). Once fit, the player can train CA back through normal training and match experience routes.

### Match engine changes

The `teamStrength` function is updated to use CA directly instead of `rating`. The `rating` field is removed from the `Player` type entirely.

### Transfer value

Transfer value is calculated from CA and age only. PA has no influence on price, keeping high-potential youngsters identifiable only through observation.

### Stat redistribution

When CA changes, individual stats are recomputed using position-specific weightings:

- **FWD**: shooting 30%, pace 25%, passing 20%, physical 15%, defending 10%
- **MID**: passing 30%, physical 20%, shooting 20%, pace 15%, defending 15%
- **DEF**: defending 35%, physical 25%, passing 20%, pace 15%, shooting 5%
- **GK**: reflexes 30%, positioning 25%, handling 20%, aerial 15%, kicking 10%

### Processor pipeline

A new `processTraining` DayProcessor is added to the existing pipeline in `game.ts`. It runs after `processMatches` each day and handles:
- Training gains for non-match days
- Match experience gains for players who featured that day
- CA decline for players aged 31+
- Injury CA drain for currently injured players
- Stat redistribution after any CA change

### UI changes

- `rating` removed from all UI surfaces
- Individual stats shown in Squad and Transfer views
- Player profile shows: personality, natural fitness, age, position, stats
- CA and PA are not shown anywhere in the UI

## Out of Scope

- Personality affecting anything other than training rate (morale volatility, injury susceptibility, form consistency are future work)
- AI teams making transfers based on CA/PA
- A scouting system to reveal PA
- Manual training session scheduling
- Player retirement mechanics
- CA recovery during injury (partial training while injured)
- Loan system for young players to gain match experience

## Further Notes

The development system is intentionally opaque to the player. The fun is in signing an 18-year-old, playing them regularly, and watching their attributes climb over two or three seasons — not in reading a progress bar. Keep CA and PA out of the UI entirely.

The season runs approximately 14 weeks (~98 days, ~14 match days, ~84 training days). A 19-year-old Average personality player gains roughly 4.2 CA from training and up to 2.1 CA from match appearances per season — development that becomes clearly visible over 2–3 seasons but never feels overnight.
