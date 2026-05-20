/**
 * MatchSimulator — a tick-by-tick possession model for animating a match replay.
 *
 * Architecture:
 *
 *   MatchResult (pre-computed outcome)
 *        │
 *        ▼
 *   MatchSimulator.init()   ← seeds the state machine from the result
 *        │
 *        ▼
 *   MatchSimulator.tick()   ← advances by one tick (~1 simulated second)
 *        │
 *        ▼
 *   SimFrame                ← snapshot the renderer consumes each animation frame
 *
 * The simulator is a plain class with no React dependency. The renderer calls
 * tick() on a rAF loop and reads the resulting SimFrame.
 *
 * PHASE STATE MACHINE
 * ───────────────────
 * Each tick the match is in one of these phases:
 *
 *   KICKOFF ──► BUILDUP ──► MIDFIELD ──► ATTACK ──► CHANCE
 *                  ▲           │            │          │
 *                  │    (loss of possession) │          ├─► GOAL
 *                  └───────────┘            │          └─► SAVE → BUILDUP
 *                                           └─► COUNTER (transition)
 *
 * Ball zone: a [col, row] coordinate on a 3-wide × 5-tall grid.
 * Zone [1,2] is the centre circle. Rows 0/4 are the attacking thirds.
 *
 * PLAYER MOVEMENT
 * ───────────────
 * Each player has a "role" that determines their target position at every tick.
 * The role reads ball zone + phase and picks a target from a lookup table.
 * Players lerp toward their target each frame (done in the renderer).
 *
 * CONNECTING TO THE RESULT
 * ────────────────────────
 * The pre-computed MatchResult contains events at known minutes. When the
 * simulator's clock reaches an event minute, it forces the appropriate phase
 * transition (e.g. CHANCE → GOAL) regardless of what the stochastic model
 * would have chosen. This ensures the animation is consistent with the result.
 */

import {
	findClosestDefender,
	getDefenderTarget,
	selectAttackingAction,
	selectBuildupAction,
	selectDefendingAction,
	selectDribbleAction,
} from "./actions/actionSelector";
import { midfieldTargets, pressTargets, spreadTargets } from "./positioning";
import type { MatchEvent, MatchResult } from "./types";

// ─── Pitch grid ──────────────────────────────────────────────────────────────

/** 3 columns × 5 rows. col 0 = left, row 0 = home's attacking end. */
export type Zone = [col: number, row: number];

export function zoneToXY(
	zone: Zone,
	pitchW: number,
	pitchH: number,
): { x: number; y: number } {
	const [col, row] = zone;
	return {
		x: ((col + 0.5) / 3) * pitchW,
		y: ((row + 0.5) / 5) * pitchH,
	};
}

// ─── Movement constants ───────────────────────────────────────────────────────

/** Max distance (pitch-fractions) a player without the ball moves per tick. */
export const PLAYER_SPEED = 0.006;
/** Carrier is slightly slower — ball control costs a little pace. */
export const CARRIER_SPEED = 0.005;
/** Initial speed of a kicked ball (pitch-fractions/tick). */
export const BALL_INITIAL_SPEED = 0.02;
/** Per-tick friction multiplier while the ball is in flight. */
export const BALL_FRICTION = 0.976;

/** Move (x, y) toward (tx, ty) by at most maxStep. Returns new position. */
function stepToward(
	x: number,
	y: number,
	tx: number,
	ty: number,
	maxStep: number,
): { x: number; y: number } {
	const dx = tx - x;
	const dy = ty - y;
	const d = Math.sqrt(dx * dx + dy * dy);
	if (d <= maxStep) return { x: tx, y: ty };
	const r = maxStep / d;
	return { x: x + dx * r, y: y + dy * r };
}

// ─── Phases ───────────────────────────────────────────────────────────────────

export type Phase =
	| "kickoff"
	| "buildup" // keeper / defenders playing out
	| "midfield" // possession in centre
	| "attack" // in the final third
	| "chance" // clear shooting opportunity
	| "goal" // ball in net (brief)
	| "save" // keeper saves (brief)
	| "counter" // rapid transition from defence to attack
	| "corner" // corner kick setup
	| "freekick"; // free kick setup

// ─── Player roles ─────────────────────────────────────────────────────────────

export type Role =
	| "GK"
	| "CB"
	| "LB"
	| "RB"
	| "CDM"
	| "CM"
	| "LM"
	| "RM"
	| "CAM"
	| "ST"
	| "LW"
	| "RW";

// ─── Player state ─────────────────────────────────────────────────────────────

export interface SimPlayer {
	id: string;
	name: string;
	role: Role;
	isHome: boolean;
	/** Current position in pitch-relative [0,1] space. Renderer lerps to target. */
	x: number;
	y: number;
	/** Where the player wants to be this tick. */
	targetX: number;
	targetY: number;
	/** Formation home position — unique per player, used as drift anchor. */
	baseX: number;
	baseY: number;
	hasBall: boolean;
	/** Last action that fired for this player this tick — for debug overlays. */
	debugAction?: string;
}

// ─── Ball state ───────────────────────────────────────────────────────────────

export interface SimBall {
	x: number;
	y: number;
	targetX: number;
	targetY: number;
	speed: number;
}

// ─── Frame (snapshot the renderer reads) ──────────────────────────────────────

export interface BuildupCandidateDebug {
	playerId: string;
	score: number;
	pressureScore: number;
	progressionValue: number;
}

export interface BuildupDebugInfo {
	holderId: string;
	holderPressureDist: number;
	isCarrying: boolean;
	candidates: BuildupCandidateDebug[];
}

export interface SimFrame {
	/** Simulated minute (0–90). */
	minute: number;
	/** Simulated second within the minute (0–59). */
	second: number;
	phase: Phase;
	/** true = home team has possession. */
	homePossession: boolean;
	homeScore: number;
	awayScore: number;
	players: SimPlayer[];
	ball: SimBall;
	/** Event that just fired this tick (if any). Renderer uses for flash banners. */
	firedEvent: MatchEvent | null;
	/** Only present during buildup phase with showDebug active. */
	buildupDebug?: BuildupDebugInfo;
}

// ─── Simulator ────────────────────────────────────────────────────────────────

/**
 * Default formation slots in [x, y] pitch-fraction space.
 * Home attacks bottom→top (y=0 is home's goal, y=1 is away's goal).
 * TASK: replace with real formation data driven by selected XI positions.
 */

/**
 * Explicit per-slot starting positions for a 4-2-3-1 / 4-4-2 hybrid.
 * Each of the 11 players gets a unique [x, y] so no two share the same spot.
 */
const HOME_START_POSITIONS: [number, number][] = [
	[0.5, 0.05], // GK
	[0.15, 0.22], // LB
	[0.38, 0.2], // CB (left-centre)
	[0.62, 0.2], // CB (right-centre)
	[0.85, 0.22], // RB
	[0.35, 0.4], // CM (left)
	[0.65, 0.4], // CM (right)
	[0.15, 0.55], // LM
	[0.85, 0.55], // RM
	[0.38, 0.7], // ST (left)
	[0.62, 0.7], // ST (right)
];

const HOME_START_ROLES: Role[] = [
	"GK",
	"LB",
	"CB",
	"CB",
	"RB",
	"CM",
	"CM",
	"LM",
	"RM",
	"ST",
	"ST",
];

/** Assign roles to an ordered list of players (GK first, then DEF×4, MID×4, FWD×2). */
export function assignRoles(
	players: { id: string; name: string }[],
	isHome: boolean,
): SimPlayer[] {
	return players.map((p, i) => {
		const role = HOME_START_ROLES[i] ?? "CM";
		let [x, y] = HOME_START_POSITIONS[i] ?? [0.5, 0.5];
		if (!isHome) {
			// Mirror vertically for away team
			y = 1 - y;
		}
		return {
			id: p.id,
			name: p.name,
			role,
			isHome,
			x,
			y,
			targetX: x,
			targetY: y,
			baseX: x,
			baseY: y,
			hasBall: false,
		};
	});
}

// ─── Phase transition probabilities ───────────────────────────────────────────

/**
 * From each phase, what can happen next tick and with what probability?
 * Probabilities don't need to sum to 1 — missing mass = stay in current phase.
 *
 * TASK: tune these weights by watching the animation and adjusting feel.
 * TASK: scale by strength ratio so better teams hold possession longer.
 */
type Transition = { to: Phase; p: number };

const TRANSITIONS: Record<Phase, Transition[]> = {
	kickoff: [{ to: "midfield", p: 1.0 }],
	buildup: [
		{ to: "midfield", p: 0.08 },
		{ to: "counter", p: 0.03 }, // TASK: increase when pressing team is strong
	],
	midfield: [
		{ to: "attack", p: 0.06 },
		{ to: "buildup", p: 0.04 }, // possession switches
		{ to: "counter", p: 0.02 },
	],
	attack: [
		{ to: "chance", p: 0.05 },
		{ to: "midfield", p: 0.06 }, // cleared
		{ to: "corner", p: 0.01 },
	],
	chance: [
		{ to: "goal", p: 0.25 }, // TASK: scale by xG / finishing
		{ to: "save", p: 0.4 },
		{ to: "midfield", p: 0.35 }, // missed
	],
	goal: [{ to: "kickoff", p: 1.0 }], // brief, then reset
	save: [{ to: "buildup", p: 1.0 }], // keeper distributes
	counter: [
		{ to: "attack", p: 0.3 },
		{ to: "midfield", p: 0.7 },
	],
	corner: [
		{ to: "chance", p: 0.2 },
		{ to: "midfield", p: 0.8 },
	],
	freekick: [
		{ to: "chance", p: 0.15 },
		{ to: "midfield", p: 0.85 },
	],
};

function sampleTransition(phase: Phase, rng: () => number): Phase {
	const transitions = TRANSITIONS[phase];
	const r = rng();
	let cumulative = 0;
	for (const t of transitions) {
		cumulative += t.p;
		if (r < cumulative) return t.to;
	}
	return phase; // stay
}

// ─── Holder selection per phase ───────────────────────────────────────────────

/** Which roles should carry the ball in each phase (possessing team). */
const PHASE_ROLES: Partial<Record<Phase, Role[]>> = {
	kickoff: ["ST", "CM", "CAM"],
	midfield: ["CM", "CDM", "LM", "RM", "CAM"],
	counter: ["CM", "LM", "RM", "ST"],
	attack: ["ST", "LW", "RW", "CAM"],
	chance: ["ST", "LW", "RW"],
	goal: ["ST", "LW", "RW"],
	save: ["GK"],
	corner: ["LB", "RB"],
	freekick: ["CM", "CAM"],
};

/**
 * Pick a player from the possessing team to hold the ball this phase.
 * Prefers roles listed in PHASE_ROLES; falls back to any outfield player.
 */
function pickHolder(
	players: SimPlayer[],
	homePossession: boolean,
	phase: Phase,
	rng: () => number,
): SimPlayer | null {
	const team = players.filter((p) => p.isHome === homePossession);
	const preferred = PHASE_ROLES[phase] ?? [];
	const candidates = team.filter((p) => preferred.includes(p.role));
	const pool =
		candidates.length > 0 ? candidates : team.filter((p) => p.role !== "GK");
	if (pool.length === 0) return null;
	return pool[Math.floor(rng() * pool.length)];
}

// ─── Seeded RNG (so replays are deterministic) ────────────────────────────────

function makeRng(seed: number) {
	let s = seed;
	return () => {
		s = (s * 16807 + 0) % 2147483647;
		return (s - 1) / 2147483646;
	};
}

// ─── Main class ───────────────────────────────────────────────────────────────

const TICKS_PER_MINUTE = 90; // 90 ticks = 1 simulated minute → ~2.5min real-time at 60fps/1tpf

/** Minimum ticks to stay in a phase before allowing a stochastic transition. */
const MIN_PHASE_TICKS = 60;

export class MatchSimulator {
	private tick = 0;
	private phase: Phase = "buildup";
	private phaseTick = 0;
	private homePossession: boolean;
	private homeScore = 0;
	private awayScore = 0;
	private players: SimPlayer[];
	private ball: SimBall;
	private events: MatchEvent[];
	private rng: () => number;
	/** ID of the player currently holding the ball. Null while ball is in flight. */
	private holderId: string | null = null;
	/** ID of the player who will receive the ball once it arrives. */
	private pendingCarrierId: string | null = null;
	/** Phase to transition into once the in-flight ball is received. */
	private pendingPhase: Phase | null = null;
	/** Ticks remaining before the current carrier can act again. */
	private actionDelay = 0;

	constructor(
		result: MatchResult,
		homePlayers: { id: string; name: string }[],
		awayPlayers: { id: string; name: string }[],
		seed = 42,
	) {
		this.events = [...result.events];
		this.homePossession = true;
		this.rng = makeRng(seed);

		this.players = [
			...assignRoles(homePlayers, true),
			...assignRoles(awayPlayers, false),
		];

		this.ball = {
			x: 0.5,
			y: 0.05,
			targetX: 0.5,
			targetY: 0.05,
			speed: BALL_INITIAL_SPEED,
		};
		// Start with the home GK holding the ball
		const gk = this.players.find((p) => p.isHome && p.role === "GK");
		this.holderId = gk?.id ?? null;
	}

	get done(): boolean {
		return this.minute >= 90;
	}

	get minute(): number {
		return Math.floor(this.tick / TICKS_PER_MINUTE);
	}

	get second(): number {
		return (this.tick % TICKS_PER_MINUTE) * (60 / TICKS_PER_MINUTE);
	}

	/**
	 * Advance by one tick. Call this ~10× per second for real-time feel,
	 * or faster to speed up the animation.
	 *
	 * Returns the current SimFrame.
	 */
	advance(): SimFrame {
		let firedEvent: MatchEvent | null = null;

		// --- Check for a forced event at this minute ---
		const pendingEvent = this.events[0];
		if (pendingEvent && pendingEvent.minute <= this.minute) {
			firedEvent = this.events.shift()!;
			this.applyForcedEvent(firedEvent);
		} else {
			// --- Stochastic phase transition (only after minimum dwell) ---
			this.phaseTick++;
			if (this.phaseTick >= MIN_PHASE_TICKS) {
				const next = sampleTransition(this.phase, this.rng);
				if (next !== this.phase) {
					this.onPhaseChange(next);
				} else {
					// Didn't transition — reset so we wait another MIN_PHASE_TICKS before trying again
					this.phaseTick = 0;
				}
			}
		}

		// --- Update ball and player targets ---
		const carrier = this.holderId
			? (this.players.find((p) => p.id === this.holderId) ?? null)
			: null;

		// Clear debug actions from last tick
		for (const player of this.players) {
			player.debugAction = undefined;
		}

		// Tick down the action delay (prevents passing every single tick)
		if (this.actionDelay > 0) this.actionDelay--;

		if (carrier) carrier.debugAction = "hold";

		const pressedIds = new Set<string>();
		if (carrier) {
			// ── Off-ball positioning ──────────────────────────────────────────
			// Runs every tick (not gated by actionDelay) so debug labels don't flicker.
			const myTeam = this.players.filter(
				(p) => p.isHome === this.homePossession,
			);
			const opponents = this.players.filter(
				(p) => p.isHome !== this.homePossession,
			);

			if (this.phase === "buildup") {
				const spread = spreadTargets(carrier, myTeam, this.homePossession);
				const press = pressTargets(
					carrier,
					opponents,
					myTeam,
					!this.homePossession,
				);
				for (const [id, t] of spread) {
					if (id === carrier.id) continue; // carrier moves via action pipeline
					const p = this.players.find((pl) => pl.id === id);
					if (p) {
						p.targetX = t.x;
						p.targetY = t.y;
						p.debugAction = t.debugAction;
					}
				}
				for (const [id, t] of press) {
					const p = this.players.find((pl) => pl.id === id);
					if (p) {
						p.targetX = t.x;
						p.targetY = t.y;
						p.debugAction = t.debugAction;
						pressedIds.add(id);
					}
				}
			} else if (this.phase === "midfield") {
				const shape = midfieldTargets(carrier, myTeam, this.homePossession);
				for (const [id, t] of shape) {
					if (id === carrier.id) continue; // carrier moves via action pipeline
					const p = this.players.find((pl) => pl.id === id);
					if (p) {
						p.targetX = t.x;
						p.targetY = t.y;
						p.debugAction = t.debugAction;
					}
				}
			}
		}

		if (carrier) {
			// ── Action pipeline ───────────────────────────────────────────────
			// Dribble runs every tick so the carrier moves while waiting to pass.
			// Pass/shoot/cross are gated behind actionDelay to prevent instant turnover.
			const result =
				this.actionDelay > 0
					? selectDribbleAction(
							carrier,
							this.players,
							this.homePossession,
							this.rng,
						)
					: this.phase === "buildup"
						? selectBuildupAction(
								carrier,
								this.players,
								this.homePossession,
								this.rng,
							)
						: selectAttackingAction(
								carrier,
								this.players,
								this.phase,
								this.homePossession,
								this.rng,
							);

			if (result) {
				carrier.debugAction = result.action;
				if (result.reason) {
					console.debug(
						`[${this.minute}:${Math.floor(this.second).toString().padStart(2, "0")}] ${carrier.name} → ${result.action}: ${result.reason}`,
					);
				}
				if (result.playerTargets) {
					for (const player of this.players) {
						const t = result.playerTargets.get(player.id);
						if (t) {
							player.targetX = t.x;
							player.targetY = t.y;
						}
					}
				}
				if (result.ballReleased && result.newCarrierId) {
					// Release ball — it will fly to the receiver; holderId cleared so
					// ball moves freely and isn't snapped to the receiver this tick.
					this.holderId = null;
					this.pendingCarrierId = result.newCarrierId;
				}
				if (result.ballTarget) {
					this.ball.targetX = result.ballTarget.x;
					this.ball.targetY = result.ballTarget.y;
					this.ball.speed = result.ballSpeed ?? BALL_INITIAL_SPEED;
				}
				if (result.nextPhase && result.nextPhase !== this.phase) {
					// If ball is in flight, defer the phase change until it arrives.
					if (this.pendingCarrierId) {
						this.pendingPhase = result.nextPhase;
					} else {
						this.onPhaseChange(result.nextPhase);
					}
				}
			}
		}

		// ── Defending actions ─────────────────────────────────────────────────
		const closestDefender = findClosestDefender(
			this.players,
			this.homePossession,
			this.ball.x,
			this.ball.y,
		);
		if (closestDefender && this.actionDelay === 0) {
			const defResult = selectDefendingAction(
				closestDefender,
				this.players,
				this.phase,
				this.homePossession,
				this.rng,
			);
			if (defResult) {
				closestDefender.debugAction = defResult.action;
				if (defResult.reason) {
					console.debug(
						`[${this.minute}:${Math.floor(this.second).toString().padStart(2, "0")}] ${closestDefender.name} → ${defResult.action}: ${defResult.reason}`,
					);
				}
				if (defResult.playerTargets) {
					for (const player of this.players) {
						const t = defResult.playerTargets.get(player.id);
						if (t) {
							player.targetX = t.x;
							player.targetY = t.y;
						}
					}
				}
				if (defResult.ballReleased && defResult.newCarrierId) {
					this.holderId = defResult.newCarrierId;
					this.homePossession = !this.homePossession;
					this.actionDelay = 30;
				}
				if (defResult.nextPhase && defResult.nextPhase !== this.phase) {
					this.onPhaseChange(defResult.nextPhase);
				}
			}
		}

		// ── Off-ball defender positioning ─────────────────────────────────────
		const updatedByAction = new Set<string>([...pressedIds]);
		if (carrier) updatedByAction.add(carrier.id);
		if (closestDefender) updatedByAction.add(closestDefender.id);

		for (const player of this.players) {
			if (updatedByAction.has(player.id)) continue;
			if (player.isHome !== this.homePossession) {
				const t = getDefenderTarget(
					player,
					carrier,
					this.ball.x,
					this.ball.y,
					false,
					this.tick,
					this.rng,
					this.players,
					this.homePossession,
				);
				player.targetX = t.x;
				player.targetY = t.y;
				player.debugAction = t.debugAction;
			}
		}

		// ── Ball movement ─────────────────────────────────────────────────────
		const currentCarrier = this.holderId
			? (this.players.find((p) => p.id === this.holderId) ?? null)
			: null;
		if (currentCarrier) {
			// Ball is held — pin it to the carrier.
			this.ball.x = currentCarrier.x;
			this.ball.y = currentCarrier.y;
			this.ball.targetX = currentCarrier.x;
			this.ball.targetY = currentCarrier.y;
		} else {
			// Ball is in flight — step toward target then apply friction.
			const d = Math.hypot(
				this.ball.targetX - this.ball.x,
				this.ball.targetY - this.ball.y,
			);
			if (d <= this.ball.speed || this.ball.speed < 0.001) {
				this.ball.x = this.ball.targetX;
				this.ball.y = this.ball.targetY;
			} else {
				const r = this.ball.speed / d;
				this.ball.x += (this.ball.targetX - this.ball.x) * r;
				this.ball.y += (this.ball.targetY - this.ball.y) * r;
			}
			this.ball.speed *= BALL_FRICTION;

			// Check if ball has arrived at the pending receiver.
			// Compare against the ball's own target, not the moving receiver, so the
			// receiver walking away mid-flight doesn't prevent the pass from landing.
			if (this.pendingCarrierId) {
				const pending =
					this.players.find((p) => p.id === this.pendingCarrierId) ?? null;
				const distToTarget = Math.hypot(
					this.ball.x - this.ball.targetX,
					this.ball.y - this.ball.targetY,
				);
				if (distToTarget <= this.ball.speed * 2) {
					this.holderId = this.pendingCarrierId;
					this.pendingCarrierId = null;
					if (pending && pending.isHome !== this.homePossession) {
						this.homePossession = !this.homePossession;
					}
					const opponents = this.players.filter(
						(p) => p.isHome !== this.homePossession,
					);
					const nearestOpp = pending
						? Math.min(
								...opponents.map((o) =>
									Math.hypot(o.x - pending.x, o.y - pending.y),
								),
							)
						: 1;
					this.actionDelay = nearestOpp < 0.12 ? 12 : 30;
					if (this.pendingPhase) {
						this.onPhaseChange(this.pendingPhase);
						this.pendingPhase = null;
					}
				}
			}
		}

		// ── Player movement ───────────────────────────────────────────────────
		for (const player of this.players) {
			const speed = player.id === this.holderId ? CARRIER_SPEED : PLAYER_SPEED;
			const moved = stepToward(
				player.x,
				player.y,
				player.targetX,
				player.targetY,
				speed,
			);
			player.x = moved.x;
			player.y = moved.y;
		}

		this.tick++;

		return this.frame(firedEvent);
	}

	private applyForcedEvent(event: MatchEvent) {
		const isHome = event.teamId !== ""; // TASK: compare against actual homeTeamId
		switch (event.type) {
			case "goal":
				this.phase = "goal";
				if (isHome) this.homeScore++;
				else this.awayScore++;
				// TASK: trigger celebration positions
				break;
			case "yellowCard":
			case "redCard":
				this.phase = "freekick";
				break;
			case "injury":
				// TASK: remove injured player from positions
				break;
		}
	}

	private onPhaseChange(next: Phase) {
		this.phaseTick = 0;
		if (this.phase === "midfield" && next === "buildup") {
			this.homePossession = !this.homePossession; // turnover
		}
		if (this.phase === "chance" && next === "save") {
			this.homePossession = !this.homePossession; // keeper catches, distributes
		}
		this.phase = next;
		if (next === "buildup") {
			// GK starts with the ball
			const gk = this.players.find(
				(p) => p.isHome === this.homePossession && p.role === "GK",
			);
			this.holderId = gk?.id ?? null;
			this.actionDelay = 10; // brief think before first pass
		} else {
			const currentHolder = this.holderId
				? this.players.find((p) => p.id === this.holderId)
				: null;
			const holderIsOnPossessingTeam =
				currentHolder?.isHome === this.homePossession;
			if (!holderIsOnPossessingTeam) {
				const h = pickHolder(this.players, this.homePossession, next, this.rng);
				this.holderId = h?.id ?? null;
			}
		}
	}

	private frame(firedEvent: MatchEvent | null): SimFrame {
		const holderId = this.holderId;

		let buildupDebug: BuildupDebugInfo | undefined;
		if (this.phase === "buildup" && holderId) {
			const holder = this.players.find((p) => p.id === holderId);
			if (holder) {
				const opponents = this.players.filter(
					(p) => p.isHome !== holder.isHome,
				);
				const teammates = this.players.filter(
					(p) => p.isHome === holder.isHome,
				);
				const isHome = holder.isHome;

				const holderPressureDist =
					opponents.length > 0
						? Math.min(
								...opponents.map((o) =>
									Math.hypot(o.x - holder.x, o.y - holder.y),
								),
							)
						: 1;

				const candidates = teammates
					.filter(
						(p) =>
							p.id !== holder.id &&
							["CB", "LB", "RB", "CDM", "CM"].includes(p.role),
					)
					.map((p) => {
						const nearestOppDist =
							opponents.length > 0
								? Math.min(
										...opponents.map((o) => Math.hypot(o.x - p.x, o.y - p.y)),
									)
								: 1;
						const pressureScore = Math.min(nearestOppDist / 0.4, 1);
						const progressionValue = isHome ? p.y : 1 - p.y;
						return {
							playerId: p.id,
							score: pressureScore * progressionValue,
							pressureScore,
							progressionValue,
						};
					});

				buildupDebug = {
					holderId,
					holderPressureDist,
					isCarrying: false,
					candidates,
				};
			}
		}

		return {
			minute: this.minute,
			second: this.second,
			phase: this.phase,
			homePossession: this.homePossession,
			homeScore: this.homeScore,
			awayScore: this.awayScore,
			players: this.players.map((p) => ({ ...p, hasBall: p.id === holderId })),
			ball: { ...this.ball },
			firedEvent,
			buildupDebug,
		};
	}
}
