/**
 * MatchSimulatorV2 — strict four-stage pipeline per tick.
 *
 * Each tick runs exactly these stages in order:
 *   1a. selectPositioning — non-carrier players choose movement targets
 *   1b. selectCarrierAction — carrier chooses what to do (Phase 1: always dribble)
 *   2.  resolvePhysics — apply all movement from the TickPlan
 *   3.  resolveState — update holderId, possession, phase from new positions
 *   4.  emitFrame — snapshot into SimFrame
 *
 * No stage reads data that a later stage has mutated.
 * Ball and player positions are always computed from the same pre-tick snapshot.
 */

import type { MatchEvent, MatchResult } from "#/domains/match/types";
import type {
	Phase,
	Role,
	SimBall,
	SimFrame,
	SimPlayer,
	TickPlan,
} from "./types";

// ─── Movement constants ───────────────────────────────────────────────────────

export const PLAYER_SPEED = 0.003;
export const CARRIER_SPEED = 0.002;
export const BALL_INITIAL_SPEED = 0.02;
export const BALL_FRICTION = 0.976;

// ─── Starting positions & roles ───────────────────────────────────────────────

const HOME_START_POSITIONS: [number, number][] = [
	[0.5, 0.05], // GK
	[0.15, 0.22], // LB
	[0.38, 0.2], // CB
	[0.62, 0.2], // CB
	[0.85, 0.22], // RB
	[0.35, 0.4], // CM
	[0.65, 0.4], // CM
	[0.15, 0.55], // LM
	[0.85, 0.55], // RM
	[0.38, 0.7], // ST
	[0.62, 0.7], // ST
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

export function assignRoles(
	players: { id: string; name: string }[],
	isHome: boolean,
): SimPlayer[] {
	return players.map((p, i) => {
		const role = HOME_START_ROLES[i] ?? "CM";
		let [x, y] = HOME_START_POSITIONS[i] ?? [0.5, 0.5];
		if (!isHome) y = 1 - y;
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

// ─── Phase transitions ────────────────────────────────────────────────────────

type Transition = { to: Phase; p: number };

const TRANSITIONS: Record<Phase, Transition[]> = {
	kickoff: [{ to: "midfield", p: 1.0 }],
	buildup: [
		{ to: "midfield", p: 0.08 },
		{ to: "counter", p: 0.03 },
	],
	midfield: [
		{ to: "attack", p: 0.06 },
		{ to: "buildup", p: 0.04 },
		{ to: "counter", p: 0.02 },
	],
	attack: [
		{ to: "chance", p: 0.05 },
		{ to: "midfield", p: 0.06 },
		{ to: "corner", p: 0.01 },
	],
	chance: [
		{ to: "goal", p: 0.25 },
		{ to: "save", p: 0.4 },
		{ to: "midfield", p: 0.35 },
	],
	goal: [{ to: "kickoff", p: 1.0 }],
	save: [{ to: "buildup", p: 1.0 }],
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
	const r = rng();
	let cumulative = 0;
	for (const t of TRANSITIONS[phase]) {
		cumulative += t.p;
		if (r < cumulative) return t.to;
	}
	return phase;
}

// ─── Holder selection ─────────────────────────────────────────────────────────

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

// ─── RNG ──────────────────────────────────────────────────────────────────────

function makeRng(seed: number) {
	let s = seed;
	return () => {
		s = (s * 16807 + 0) % 2147483647;
		return (s - 1) / 2147483646;
	};
}

// ─── Physics helpers ──────────────────────────────────────────────────────────

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

// ─── Stage 1a — Positioning pass ──────────────────────────────────────────────

/**
 * Non-carrier players choose movement targets from the pre-tick snapshot.
 * Only updates playerTargets in the plan; no mutation yet.
 *
 * Phase 1: players hold their base positions (off-ball positioning added in Phase 3).
 */
function selectPositioning(
	carrier: SimPlayer,
	players: SimPlayer[],
	_homePossession: boolean,
	plan: TickPlan,
): void {
	for (const p of players) {
		if (p.id === carrier.id) continue;
		// Phase 1: drift toward base position
		plan.playerTargets.set(p.id, {
			x: p.baseX,
			y: p.baseY,
			debugAction: "shape",
		});
	}
}

// ─── Stage 1b — Carrier action ────────────────────────────────────────────────

/**
 * Carrier chooses its action reading from the pre-tick snapshot.
 *
 * Phase 1: carrier always dribbles toward goal. Ball target is null (stays glued).
 */
function selectCarrierAction(
	carrier: SimPlayer,
	_players: SimPlayer[],
	homePossession: boolean,
	_phase: Phase,
	_rng: () => number,
	plan: TickPlan,
): void {
	// Dribble toward opponent's goal
	const goalY = homePossession ? 1.0 : 0.0;
	plan.playerTargets.set(carrier.id, {
		x: carrier.targetX !== carrier.x ? carrier.targetX : carrier.x,
		y: goalY,
		debugAction: "dribble",
	});
	plan.carrierAction = "dribble";
	// Ball stays glued to carrier — ballTarget remains null
}

// ─── Stage 2 — Resolve physics ────────────────────────────────────────────────

/**
 * Apply all movement from the TickPlan.
 * Reads plan + pre-tick positions, writes new positions.
 * Ball is pinned to carrier when no ballTarget.
 */
function resolvePhysics(
	players: SimPlayer[],
	ball: SimBall,
	holderId: string | null,
	plan: TickPlan,
): void {
	// Move players
	for (const player of players) {
		const t = plan.playerTargets.get(player.id);
		if (t) {
			player.targetX = t.x;
			player.targetY = t.y;
			if (t.debugAction) player.debugAction = t.debugAction;
		}
		const speed = player.id === holderId ? CARRIER_SPEED : PLAYER_SPEED;
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

	// Move ball
	if (plan.ballTarget) {
		const d = Math.hypot(
			plan.ballTarget.x - ball.x,
			plan.ballTarget.y - ball.y,
		);
		if (d <= ball.speed || ball.speed < 0.001) {
			ball.x = plan.ballTarget.x;
			ball.y = plan.ballTarget.y;
		} else {
			const r = ball.speed / d;
			ball.x += (plan.ballTarget.x - ball.x) * r;
			ball.y += (plan.ballTarget.y - ball.y) * r;
		}
		ball.speed *= BALL_FRICTION;
		ball.targetX = plan.ballTarget.x;
		ball.targetY = plan.ballTarget.y;
	} else if (holderId) {
		// Pin ball to carrier using their NEW (already moved) position
		const carrier = players.find((p) => p.id === holderId);
		if (carrier) {
			ball.x = carrier.x;
			ball.y = carrier.y;
			ball.targetX = carrier.x;
			ball.targetY = carrier.y;
			ball.speed = 0;
		}
	}
}

// ─── Stage 3 — Resolve state ──────────────────────────────────────────────────

/**
 * Update holderId, possession, and phase from resolved positions.
 * Runs after physics so it sees new positions.
 */
function resolveState(
	ball: SimBall,
	players: SimPlayer[],
	plan: TickPlan,
	currentHolderId: string | null,
	currentPendingCarrierId: string | null,
	currentPendingPhase: Phase | null,
	homePossession: boolean,
	phase: Phase,
	phaseTick: number,
): {
	holderId: string | null;
	pendingCarrierId: string | null;
	pendingPhase: Phase | null;
	homePossession: boolean;
	phase: Phase;
	phaseTick: number;
} {
	let holderId = currentHolderId;
	let pendingCarrierId = currentPendingCarrierId;
	let pendingPhase = currentPendingPhase;

	// Check if in-flight ball has reached pending receiver
	if (pendingCarrierId && plan.ballTarget) {
		const distToTarget = Math.hypot(
			ball.x - ball.targetX,
			ball.y - ball.targetY,
		);
		if (distToTarget <= ball.speed * 2 || ball.speed < 0.002) {
			holderId = pendingCarrierId;
			pendingCarrierId = null;
			if (pendingPhase) {
				phase = pendingPhase;
				pendingPhase = null;
				phaseTick = 0;
			}
		}
	}

	// Apply phase change from plan (for immediate transitions)
	if (plan.nextPhase && plan.nextPhase !== phase && !pendingCarrierId) {
		phase = plan.nextPhase;
		phaseTick = 0;
	}

	return {
		holderId,
		pendingCarrierId,
		pendingPhase,
		homePossession,
		phase,
		phaseTick,
	};
}

// ─── Stage 4 — Emit frame ─────────────────────────────────────────────────────

function emitFrame(
	tick: number,
	phase: Phase,
	homePossession: boolean,
	homeScore: number,
	awayScore: number,
	players: SimPlayer[],
	ball: SimBall,
	holderId: string | null,
	firedEvent: MatchEvent | null,
): SimFrame {
	const minute = Math.floor(tick / TICKS_PER_MINUTE);
	const second = (tick % TICKS_PER_MINUTE) * (60 / TICKS_PER_MINUTE);
	return {
		minute,
		second,
		phase,
		homePossession,
		homeScore,
		awayScore,
		players: players.map((p) => ({ ...p, hasBall: p.id === holderId })),
		ball: { ...ball },
		firedEvent,
	};
}

// ─── Main class ───────────────────────────────────────────────────────────────

const TICKS_PER_MINUTE = 90;
const MIN_PHASE_TICKS = 60;

export class MatchSimulatorV2 {
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
	private holderId: string | null = null;
	private pendingCarrierId: string | null = null;
	private pendingPhase: Phase | null = null;

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

		this.ball = { x: 0.5, y: 0.05, targetX: 0.5, targetY: 0.05, speed: 0 };

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

	advance(): SimFrame {
		let firedEvent: MatchEvent | null = null;

		// Clear debug actions from last tick
		for (const p of this.players) {
			p.debugAction = undefined;
		}

		// Check forced event
		const pendingEvent = this.events[0];
		if (pendingEvent && pendingEvent.minute <= this.minute) {
			firedEvent = this.events.shift()!;
			this.applyForcedEvent(firedEvent);
		} else {
			// Stochastic phase transition
			this.phaseTick++;
			if (this.phaseTick >= MIN_PHASE_TICKS) {
				const next = sampleTransition(this.phase, this.rng);
				if (next !== this.phase) {
					this.onPhaseChange(next);
				} else {
					this.phaseTick = 0;
				}
			}
		}

		const carrier = this.holderId
			? (this.players.find((p) => p.id === this.holderId) ?? null)
			: null;

		// Build the tick plan (stages 1a + 1b read from pre-tick snapshot)
		const plan: TickPlan = {
			playerTargets: new Map(),
			ballTarget: null,
			ballSpeed: BALL_INITIAL_SPEED,
			pendingCarrierId: null,
			nextPhase: null,
			carrierAction: "hold",
		};

		if (carrier) {
			// Stage 1a — positioning pass (non-carriers choose targets)
			selectPositioning(carrier, this.players, this.homePossession, plan);

			// Stage 1b — carrier chooses action
			selectCarrierAction(
				carrier,
				this.players,
				this.homePossession,
				this.phase,
				this.rng,
				plan,
			);
		}

		// Stage 2 — resolve physics
		resolvePhysics(this.players, this.ball, this.holderId, plan);

		// Stage 3 — resolve state
		const next = resolveState(
			this.ball,
			this.players,
			plan,
			this.holderId,
			this.pendingCarrierId,
			this.pendingPhase,
			this.homePossession,
			this.phase,
			this.phaseTick,
		);
		this.holderId = next.holderId;
		this.pendingCarrierId = next.pendingCarrierId;
		this.pendingPhase = next.pendingPhase;
		this.homePossession = next.homePossession;
		this.phase = next.phase;
		this.phaseTick = next.phaseTick;

		// Stage 4 — emit frame
		const frame = emitFrame(
			this.tick,
			this.phase,
			this.homePossession,
			this.homeScore,
			this.awayScore,
			this.players,
			this.ball,
			this.holderId,
			firedEvent,
		);

		this.tick++;
		return frame;
	}

	private applyForcedEvent(event: MatchEvent) {
		const isHome = event.teamId !== "";
		switch (event.type) {
			case "goal":
				this.phase = "goal";
				if (isHome) this.homeScore++;
				else this.awayScore++;
				break;
			case "yellowCard":
			case "redCard":
				this.phase = "freekick";
				break;
		}
	}

	private onPhaseChange(next: Phase) {
		this.phaseTick = 0;
		if (this.phase === "midfield" && next === "buildup") {
			this.homePossession = !this.homePossession;
		}
		if (this.phase === "chance" && next === "save") {
			this.homePossession = !this.homePossession;
		}
		this.phase = next;
		if (next === "buildup") {
			const gk = this.players.find(
				(p) => p.isHome === this.homePossession && p.role === "GK",
			);
			this.holderId = gk?.id ?? null;
		} else {
			const currentHolder = this.holderId
				? this.players.find((p) => p.id === this.holderId)
				: null;
			if (currentHolder?.isHome !== this.homePossession) {
				const h = pickHolder(this.players, this.homePossession, next, this.rng);
				this.holderId = h?.id ?? null;
			}
		}
	}
}
