import { AttackingPositionAction } from "./actions/AttackingPositionAction";
import { chooseBallAction } from "./actions/arbiter";
import { DefensivePositionAction } from "./actions/DefensivePositionAction";
import { DribbleAction } from "./actions/DribbleAction";
import { FullbackAttackingAction } from "./actions/FullbackAttackingAction";
import { HoldAction } from "./actions/HoldAction";
import { LooseBallAction } from "./actions/LooseBallAction";
import { PassAction } from "./actions/PassAction";
import { PressAction } from "./actions/PressAction";
import { ReceiveAction } from "./actions/ReceiveAction";
import { TackleAction } from "./actions/TackleAction";
import type {
	Action,
	ActionContext,
	BallAction,
	MatchPlayer,
	PlayerRole,
	StatefulAction,
	StatefulBallAction,
} from "./actions/types";
import { kickoffPosition } from "./positions";
import type { MatchPhase, SimFrame, XY } from "./types";

function inferRole(
	position: "GK" | "DEF" | "MID" | "FWD",
	slotIndex: number,
): PlayerRole {
	if (position === "GK") return "GK";
	if (position === "DEF")
		return (["LB", "LCB", "RCB", "RB"] as PlayerRole[])[slotIndex] ?? "LCB";
	if (position === "MID")
		return (["LW", "LCM", "RCM", "RW"] as PlayerRole[])[slotIndex] ?? "LCM";
	return (["CF", "SS"] as PlayerRole[])[slotIndex] ?? "CF";
}

export interface PlayerSeed {
	id: string;
	name: string;
	position: "GK" | "DEF" | "MID" | "FWD";
}

const TICKS_PER_MINUTE = 200;
const TOTAL_MINUTES = 90;
const TOTAL_TICKS = TOTAL_MINUTES * TICKS_PER_MINUTE;

const MOVE_SPEED = 0.002;
const JITTER_RADIUS = 0.0008;

// Pace stub: the shared top-speed ceiling every player gets until a real
// per-player Pace attribute is wired through PlayerStats + the generator. As a
// multiplier on MOVE_SPEED, 1 leaves non-carrier movement unchanged.
const DEFAULT_MAX_SPEED = 1;

// Speed Slew: max change in a carrier's speed multiplier per tick. Stubbed
// constant — to be driven later by a per-player Acceleration attribute. Small
// enough that a Drive winds up over several ticks rather than snapping.
const SLEW_RATE = 0.04;

const TACKLE_SUCCESS_RATE = 0.4;

const INTERCEPTION_RADIUS = 0.04;
const INTERCEPTION_BASE_CHANCE = 0.7;
// Proximity at which a player collects a resting Loose Ball (reuses the
// interception radius — one "nearest player collects" rule).
const LOOSE_BALL_COLLECT_RADIUS = INTERCEPTION_RADIUS;

// Evaluated in order; first action whose canExecute returns true wins.
// PressAction leads: when the opposition has the ball, closing it down takes
// precedence over positional/attacking movement (it only fires while defending,
// so it never overrides attacking actions). This also lets a fullback who is the
// nearest defender step out to press instead of running its attacking phases.
const MOVEMENT_ACTIONS: Action[] = [
	// ReceiveAction leads: while a ball is inbound, the named receiver runs onto
	// the Pass Target. LooseBallAction follows: once the ball goes loose, the
	// closest player on each team chases it (superseding the receiver's privilege).
	ReceiveAction,
	LooseBallAction,
	PressAction,
	FullbackAttackingAction,
	AttackingPositionAction,
	DefensivePositionAction,
	HoldAction,
];
// Ball Action Arbiter (ADR 0004): a *set*, not a priority list. Each eligible
// action proposes an Expected Gain and the carrier executes the maximum, so
// order no longer matters. Pass-vs-dribble is a peer trade-off, not a fallback.
const BALL_ACTIONS: BallAction[] = [PassAction, DribbleAction];

function isStateful(action: Action): action is StatefulAction {
	return "stateKey" in action;
}

function isStatefulBall(action: BallAction): action is StatefulBallAction {
	return "stateKey" in action;
}

interface LivePlayer extends MatchPlayer {
	targetX: number;
	targetY: number;
	speedMultiplier: number;
	// Speed Slew: the carrier's *current* speed multiplier, moved toward the
	// Carry Gear target by at most SLEW_RATE each tick. Off-ball players ignore
	// this (they snap via speedMultiplier); only the dribbler slews.
	currentSpeedMultiplier: number;
	phaseX: number;
	phaseY: number;
	freqX: number;
	freqY: number;
	// Opaque per-player state bags, keyed by action.stateKey.
	actionState: Record<string, Record<string, unknown>>;
}

interface BallFlight {
	fromX: number;
	fromY: number;
	toX: number;
	toY: number;
	receiverId: string;
	startTimeMs: number;
	durationMs: number;
	easing: number;
}

// Ticks after gaining possession during which a player is immune to interception.
const INTERCEPTION_COOLDOWN_TICKS = 40;

export class MatchSimulator {
	private tick = 0;
	private players: LivePlayer[];
	private phase: MatchPhase = "kickoff";
	private ball: XY = { x: 0.5, y: 0.5 };
	private prevBall: XY = { x: 0.5, y: 0.5 };
	private ballHolderId: string | null = null;
	private ballFlight: BallFlight | null = null;
	// Maps player id → tick at which they last gained possession (intercept or receive).
	private possessionTick: Map<string, number> = new Map();

	get done(): boolean {
		return this.tick >= TOTAL_TICKS;
	}

	constructor(homePlayers: PlayerSeed[], awayPlayers: PlayerSeed[]) {
		this.players = [
			...this.initialiseSide(homePlayers, true),
			...this.initialiseSide(awayPlayers, false),
		];
		const kicker = this.players.find((p) => p.isHome && p.position === "FWD");
		if (kicker) this.ballHolderId = kicker.id;
	}

	private initialiseSide(seeds: PlayerSeed[], isHome: boolean): LivePlayer[] {
		const counters: Record<string, number> = {};
		return seeds.map((seed) => {
			const pos = seed.position;
			const slotIndex = counters[pos] ?? 0;
			counters[pos] = slotIndex + 1;
			const { x, y } = kickoffPosition(pos, slotIndex, isHome);
			return {
				...seed,
				role: inferRole(pos, slotIndex),
				isHome,
				x,
				y,
				baseX: x,
				baseY: y,
				targetX: x,
				targetY: y,
				maxSpeed: DEFAULT_MAX_SPEED,
				speedMultiplier: 1,
				currentSpeedMultiplier: 1,
				phaseX: Math.random() * Math.PI * 2,
				phaseY: Math.random() * Math.PI * 2,
				freqX: 0.04 + Math.random() * 0.03,
				freqY: 0.04 + Math.random() * 0.03,
				actionState: {},
			};
		});
	}

	private buildContext(player: LivePlayer, stateKey?: string): ActionContext {
		return {
			player,
			allPlayers: this.players,
			ball: this.ball,
			ballVelocity: {
				x: this.ball.x - this.prevBall.x,
				y: this.ball.y - this.prevBall.y,
			},
			ballHolderId: this.ballHolderId,
			ballReceiverId: this.ballFlight?.receiverId ?? null,
			ballFlight: this.ballFlight
				? {
						fromX: this.ballFlight.fromX,
						fromY: this.ballFlight.fromY,
						toX: this.ballFlight.toX,
						toY: this.ballFlight.toY,
						receiverId: this.ballFlight.receiverId,
					}
				: null,
			phase: this.phase,
			tick: this.tick,
			playerState: stateKey ? (player.actionState[stateKey] ?? {}) : {},
		};
	}

	advance(nowMs: number): SimFrame {
		// Stage 1: Increment tick and snapshot ball position for velocity computation.
		this.prevBall = { ...this.ball };
		this.tick++;

		// Stage 2: Phase transitions.
		if (this.tick === TICKS_PER_MINUTE && this.phase === "kickoff") {
			this.phase = "open_play";
		}

		// Stage 3: Compute ball command (ball-carrier decides what to do).
		let dribblerId: string | null = null;
		if (this.ballHolderId !== null) {
			const holder = this.players.find((p) => p.id === this.ballHolderId);
			if (holder) {
				const ctx = this.buildContext(holder);
				// Ball Action Arbiter: pick the eligible action with the highest
				// Expected Gain. propose() is pure, so pricing the losing action
				// never touched its state.
				const winner = chooseBallAction(ctx, BALL_ACTIONS);
				if (winner) {
					// Winner-only stateful execution: only now does the dribbler's
					// Carry Gear + dwell advance, and only when dribble actually wins —
					// so the gear roll stays strictly downstream of selection. Re-price
					// the winner with the freshly-stored state so its command carries
					// the real gear (gain is gear-independent, so it does not change).
					let cmd = winner.proposal.command;
					if (isStatefulBall(winner.action)) {
						const prevState = holder.actionState[winner.action.stateKey] ?? {};
						const nextState = winner.action.updateState(ctx, prevState);
						holder.actionState[winner.action.stateKey] = nextState;
						const execCtx = { ...ctx, playerState: nextState };
						cmd = winner.action.propose(execCtx).command;
					}

					if (cmd.type === "pass") {
						this.ballFlight = {
							fromX: holder.x,
							fromY: holder.y,
							toX: cmd.toX,
							toY: cmd.toY,
							receiverId: cmd.receiverId,
							startTimeMs: nowMs,
							durationMs: cmd.durationMs,
							easing: cmd.easing,
						};
						this.ballHolderId = null;
						// Receiver is no longer pinned — ReceiveAction runs them onto
						// the Pass Target so arrival is a contested race.
					} else if (cmd.type === "dribble") {
						holder.targetX = cmd.toX;
						holder.targetY = cmd.toY;
						// Record the Carry Gear target; Stage 5 slews
						// currentSpeedMultiplier toward it rather than snapping.
						holder.speedMultiplier = cmd.speedMultiplier;
						dribblerId = holder.id;
					}
				}
			}
		}

		// Stage 4: Compute movement targets (skip the dribbler — target already
		// set). The receiver is no longer skipped: ReceiveAction runs them onto
		// the Pass Target.
		for (const p of this.players) {
			if (p.id === dribblerId) continue;
			const ctx = this.buildContext(p);

			if (TackleAction.canExecute(ctx)) {
				const cmd = TackleAction.execute(ctx);
				if (cmd.type === "tackle") {
					if (Math.random() < TACKLE_SUCCESS_RATE) {
						this.ballHolderId = cmd.tacklerId;
						// Stop the tackler in place so the ball doesn't lurch toward their stale target
						p.targetX = p.x;
						p.targetY = p.y;
						console.debug(
							`[Tackle] ${cmd.tacklerId} won the ball from ${cmd.targetId}`,
						);
						continue;
					}
					console.debug(
						`[Tackle] ${cmd.tacklerId} failed to tackle ${cmd.targetId}`,
					);
				}
			}

			for (const action of MOVEMENT_ACTIONS) {
				if (!action.canExecute(ctx)) continue;

				if (isStateful(action)) {
					// Let the action advance its own state, then execute with the updated state.
					const prevState = p.actionState[action.stateKey] ?? {};
					const nextState = action.updateState(ctx, prevState);
					p.actionState[action.stateKey] = nextState;
					const ctxWithState: ActionContext = {
						...ctx,
						playerState: nextState,
					};
					const target = action.executeStateful(ctxWithState);
					p.targetX = target.x;
					p.targetY = target.y;
					p.speedMultiplier = action.speedMultiplier?.(ctxWithState) ?? 1;
				} else {
					const target = action.execute(ctx);
					p.targetX = target.x;
					p.targetY = target.y;
					p.speedMultiplier = 1;
				}
				break;
			}
		}

		// Stage 5: Apply movement.
		for (const p of this.players) {
			const dx = p.targetX - p.x;
			const dy = p.targetY - p.y;
			const dist = Math.hypot(dx, dy);

			// Speed Slew (carrier only): ease currentSpeedMultiplier toward the
			// Carry Gear target by at most SLEW_RATE per tick, so a Drive winds up
			// over several ticks. Off-ball players snap — they read speedMultiplier
			// directly, and their currentSpeedMultiplier tracks it so a future carry
			// starts from their actual speed rather than a stale slew value.
			let effectiveMultiplier: number;
			if (p.id === dribblerId) {
				const delta = p.speedMultiplier - p.currentSpeedMultiplier;
				p.currentSpeedMultiplier +=
					Math.max(-SLEW_RATE, Math.min(SLEW_RATE, delta));
				effectiveMultiplier = p.currentSpeedMultiplier * p.maxSpeed;
			} else {
				p.currentSpeedMultiplier = p.speedMultiplier;
				effectiveMultiplier = p.speedMultiplier;
			}

			const speed = MOVE_SPEED * effectiveMultiplier;
			if (dist > speed) {
				p.x += (dx / dist) * speed;
				p.y += (dy / dist) * speed;
			} else {
				p.x = p.targetX;
				p.y = p.targetY;
			}
			if (this.phase === "kickoff") {
				p.x = Math.max(
					0,
					Math.min(
						1,
						p.x + Math.sin(this.tick * p.freqX + p.phaseX) * JITTER_RADIUS,
					),
				);
				p.y = Math.max(
					0,
					Math.min(
						1,
						p.y + Math.cos(this.tick * p.freqY + p.phaseY) * JITTER_RADIUS,
					),
				);
			}
		}

		// Stage 6: Advance ball flight and emit frame.
		if (this.ballHolderId !== null) {
			const holder = this.players.find((p) => p.id === this.ballHolderId);
			if (holder) this.ball = { x: holder.x, y: holder.y };
		}

		if (this.ballFlight !== null) {
			const {
				fromX,
				fromY,
				toX,
				toY,
				receiverId,
				startTimeMs,
				durationMs,
				easing,
			} = this.ballFlight;
			const t = Math.min((nowMs - startTimeMs) / durationMs, 1);
			const eased = 1 - (1 - t) ** easing;
			this.ball = {
				x: fromX + (toX - fromX) * eased,
				y: fromY + (toY - fromY) * eased,
			};

			// Check for interceptions: opponent players near the ball's current position.
			const receiver = this.players.find((p) => p.id === receiverId);
			if (receiver) {
				const opponents = this.players.filter(
					(p) => p.isHome !== receiver.isHome,
				);
				for (const opp of opponents) {
					const lastGained = this.possessionTick.get(opp.id) ?? -Infinity;
					if (this.tick - lastGained < INTERCEPTION_COOLDOWN_TICKS) continue;
					const d = Math.hypot(opp.x - this.ball.x, opp.y - this.ball.y);
					if (d < INTERCEPTION_RADIUS) {
						const chance =
							INTERCEPTION_BASE_CHANCE * (1 - d / INTERCEPTION_RADIUS);
						if (Math.random() < chance) {
							this.ballHolderId = opp.id;
							this.ballFlight = null;
							this.possessionTick.set(opp.id, this.tick);
							console.debug(
								`[Intercept] ${opp.name} intercepted the pass near (${this.ball.x.toFixed(2)}, ${this.ball.y.toFixed(2)})`,
							);
							break;
						}
					}
				}
			}

			// On flight completion the ball does NOT auto-transfer to the named
			// receiver — it rests at the Pass Target as a Loose Ball with no
			// holder. Possession transfers on proximity below, so arrival is a
			// genuine contest (the receiver, now unpinned, is running onto it).
			if (this.ballFlight !== null && t >= 1) {
				this.ball = { x: toX, y: toY };
				this.ballFlight = null;
			}
		}

		// Loose-ball collection: with no holder and no flight, the first player
		// within the collection radius claims possession — nearest wins. One rule
		// covering led balls, overhit balls, and deflections; both teams pursue
		// the ball via LooseBallAction, so the receiver holds no special status.
		if (this.ballHolderId === null && this.ballFlight === null) {
			let collector: LivePlayer | null = null;
			let collectorDist = LOOSE_BALL_COLLECT_RADIUS;
			for (const p of this.players) {
				const lastGained = this.possessionTick.get(p.id) ?? -Infinity;
				if (this.tick - lastGained < INTERCEPTION_COOLDOWN_TICKS) continue;
				const d = Math.hypot(p.x - this.ball.x, p.y - this.ball.y);
				if (d < collectorDist) {
					collector = p;
					collectorDist = d;
				}
			}
			if (collector) {
				this.ballHolderId = collector.id;
				this.possessionTick.set(collector.id, this.tick);
				this.ball = { x: collector.x, y: collector.y };
			}
		}

		return {
			tick: this.tick,
			minute: Math.floor(this.tick / TICKS_PER_MINUTE),
			phase: this.phase,
			ball: { ...this.ball },
			players: this.players.map(
				({
					baseX: _bx,
					baseY: _by,
					targetX: _tx,
					targetY: _ty,
					maxSpeed: _ms,
					speedMultiplier: _sm,
					currentSpeedMultiplier: _csm,
					phaseX: _px,
					phaseY: _py,
					freqX: _fx,
					freqY: _fy,
					actionState,
					...rest
				}) => ({
					...rest,
					hasBall: rest.id === this.ballHolderId,
					// Expose fullback phase for debug rendering.
					...(actionState.fullback?.phase != null
						? { fullbackPhase: actionState.fullback.phase as string }
						: {}),
				}),
			),
		};
	}
}
