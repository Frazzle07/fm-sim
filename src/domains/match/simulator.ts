import { AttackingPositionAction } from "./actions/AttackingPositionAction";
import { DefensivePositionAction } from "./actions/DefensivePositionAction";
import { DribbleAction } from "./actions/DribbleAction";
import { FullbackAttackingAction } from "./actions/FullbackAttackingAction";
import { HoldAction } from "./actions/HoldAction";
import { PassAction } from "./actions/PassAction";
import { PressAction } from "./actions/PressAction";
import { TackleAction } from "./actions/TackleAction";
import type {
	Action,
	ActionContext,
	BallAction,
	MatchPlayer,
	PlayerRole,
	StatefulAction,
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

const TACKLE_SUCCESS_RATE = 0.4;

const INTERCEPTION_RADIUS = 0.04;
const INTERCEPTION_BASE_CHANCE = 0.7;

// Evaluated in order; first action whose canExecute returns true wins.
// PressAction leads: when the opposition has the ball, closing it down takes
// precedence over positional/attacking movement (it only fires while defending,
// so it never overrides attacking actions). This also lets a fullback who is the
// nearest defender step out to press instead of running its attacking phases.
const MOVEMENT_ACTIONS: Action[] = [
	PressAction,
	FullbackAttackingAction,
	AttackingPositionAction,
	DefensivePositionAction,
	HoldAction,
];
const BALL_ACTIONS: BallAction[] = [DribbleAction, PassAction];

function isStateful(action: Action): action is StatefulAction {
	return "stateKey" in action;
}

interface LivePlayer extends MatchPlayer {
	targetX: number;
	targetY: number;
	speedMultiplier: number;
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
				speedMultiplier: 1,
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
				for (const ballAction of BALL_ACTIONS) {
					if (ballAction.canExecute(ctx)) {
						const cmd = ballAction.execute(ctx);
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
							// Pin the receiver in place so they wait for the ball.
							const recv = this.players.find((p) => p.id === cmd.receiverId);
							if (recv) {
								recv.targetX = recv.x;
								recv.targetY = recv.y;
							}
						} else if (cmd.type === "dribble") {
							holder.targetX = cmd.toX;
							holder.targetY = cmd.toY;
							dribblerId = holder.id;
						}
						break;
					}
				}
			}
		}

		// Stage 4: Compute movement targets (skip the dribbler — target already set;
		// skip the receiver — they hold position until the ball arrives).
		const receiverId = this.ballFlight?.receiverId ?? null;
		for (const p of this.players) {
			if (p.id === dribblerId) continue;
			if (p.id === receiverId) continue;
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
			const speed = MOVE_SPEED * p.speedMultiplier;
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

			if (this.ballFlight !== null && t >= 1) {
				this.ballHolderId = receiverId;
				this.possessionTick.set(receiverId, this.tick);
				this.ballFlight = null;
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
					speedMultiplier: _sm,
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
