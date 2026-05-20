/**
 * MatchPitchV2 — renders SimFrames produced by MatchSimulator onto an SVG pitch.
 *
 * Responsibilities:
 *   - Run the rAF loop, calling simulator.advance() each frame
 *   - Lerp player positions each frame for smooth movement
 *   - Draw pitch markings, player circles, ball
 *   - Show scoreline, minute, phase, and flash banners
 *
 * Not responsible for:
 *   - Any game logic (all in simulator.ts)
 *   - Knowing what the final score will be
 */

import { useEffect, useRef, useState } from "react";
import { MatchSimulatorV2 as MatchSimulator } from "#/domains/matchv2/simulator";
import type { SimFrame, SimPlayer } from "#/domains/matchv2/types";
import type { MatchResult } from "#/domains/match/types";

// SVG canvas dimensions — landscape orientation
const W = 700;
const H = 440;

// Simulator coords: x=0..1 (left→right width), y=0..1 (home goal→away goal).
// On screen we map: sim.y → screen.x (home attacks right), sim.x → screen.y.
function simToScreen(sx: number, sy: number): { px: number; py: number } {
	return { px: sy * W, py: sx * H };
}

// How many simulator ticks to advance per animation frame.
// 1 = real-time feel (slow). 3–5 = watchable speed.
// TASK: expose as a speed control slider.
const TICKS_PER_FRAME = 1;

// ─── Pitch markings ───────────────────────────────────────────────────────────

// Pitch border inset
const PAD = 24;

function PitchSVG() {
	return (
		<>
			{/* Grass */}
			<rect width={W} height={H} fill="#1a6b2f" />

			{/* Alternating vertical grass stripes */}
			{Array.from({ length: 10 }, (_, i) => (
				<rect
					key={i}
					x={(i * W) / 10}
					y={0}
					width={W / 20}
					height={H}
					fill="rgba(0,0,0,0.05)"
				/>
			))}

			{/* Pitch border */}
			<rect
				x={PAD}
				y={PAD}
				width={W - PAD * 2}
				height={H - PAD * 2}
				fill="none"
				stroke="rgba(255,255,255,0.4)"
				strokeWidth={1.5}
			/>

			{/* Halfway line (vertical) */}
			<line
				x1={W / 2}
				y1={PAD}
				x2={W / 2}
				y2={H - PAD}
				stroke="rgba(255,255,255,0.4)"
				strokeWidth={1.5}
			/>

			{/* Centre circle */}
			<circle
				cx={W / 2}
				cy={H / 2}
				r={60}
				fill="none"
				stroke="rgba(255,255,255,0.4)"
				strokeWidth={1.5}
			/>
			<circle cx={W / 2} cy={H / 2} r={3} fill="rgba(255,255,255,0.4)" />

			{/* Left penalty area (home goal end) */}
			<rect
				x={PAD}
				y={H * 0.2}
				width={W * 0.16}
				height={H * 0.6}
				fill="none"
				stroke="rgba(255,255,255,0.4)"
				strokeWidth={1.5}
			/>
			{/* Left 6-yard box */}
			<rect
				x={PAD}
				y={H * 0.35}
				width={W * 0.06}
				height={H * 0.3}
				fill="none"
				stroke="rgba(255,255,255,0.3)"
				strokeWidth={1}
			/>
			{/* Left penalty spot */}
			<circle cx={W * 0.14} cy={H / 2} r={2.5} fill="rgba(255,255,255,0.4)" />

			{/* Right penalty area (away goal end) */}
			<rect
				x={W - PAD - W * 0.16}
				y={H * 0.2}
				width={W * 0.16}
				height={H * 0.6}
				fill="none"
				stroke="rgba(255,255,255,0.4)"
				strokeWidth={1.5}
			/>
			{/* Right 6-yard box */}
			<rect
				x={W - PAD - W * 0.06}
				y={H * 0.35}
				width={W * 0.06}
				height={H * 0.3}
				fill="none"
				stroke="rgba(255,255,255,0.3)"
				strokeWidth={1}
			/>
			{/* Right penalty spot */}
			<circle cx={W * 0.86} cy={H / 2} r={2.5} fill="rgba(255,255,255,0.4)" />

			{/* Left goal */}
			<rect
				x={14}
				y={H * 0.38}
				width={12}
				height={H * 0.24}
				fill="rgba(255,255,255,0.1)"
				stroke="rgba(255,255,255,0.5)"
				strokeWidth={1}
			/>
			{/* Right goal */}
			<rect
				x={W - 26}
				y={H * 0.38}
				width={12}
				height={H * 0.24}
				fill="rgba(255,255,255,0.1)"
				stroke="rgba(255,255,255,0.5)"
				strokeWidth={1}
			/>
		</>
	);
}

// ─── Player dot ───────────────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
	pass:    "rgba(96,165,250,0.9)",   // blue
	shoot:   "rgba(248,113,113,0.9)",  // red
	dribble: "rgba(251,191,36,0.9)",   // amber
	cross:   "rgba(167,139,250,0.9)",  // purple
	tackle:  "rgba(52,211,153,0.9)",   // green
	press:   "rgba(251,146,60,0.9)",   // orange
	cover:   "rgba(244,63,94,0.9)",    // rose
	mark:    "rgba(244,63,94,0.9)",    // rose (legacy)
	shape:   "rgba(148,163,184,0.6)",  // slate (dim)
	support: "rgba(148,163,184,0.6)",  // slate (dim)
	carry:   "rgba(52,211,153,0.9)",   // green  (buildup carry)
	receive: "rgba(192,132,252,0.9)",  // purple (ball incoming)
};

function PlayerDot({
	player,
	color,
	showDebug,
	candidateScore,
	isCarrying,
}: {
	player: SimPlayer;
	color: string;
	showDebug: boolean;
	candidateScore?: number;
	isCarrying?: boolean;
}) {
	const { px, py } = simToScreen(player.x, player.y);
	const lastName = player.name.split(" ").slice(-1)[0].slice(0, 6);
	const action = player.debugAction;
	const actionColor = action ? (ACTION_COLORS[action] ?? "rgba(255,255,255,0.7)") : null;

	const scoreBadgeColor =
		candidateScore === undefined ? null
		: candidateScore > 0.3 ? "#22c55e"
		: candidateScore > 0.1 ? "#f59e0b"
		: "#ef4444";

	return (
		<g transform={`translate(${px},${py})`}>
			{/* Shadow */}
			<ellipse rx={6} ry={2.5} cy={8} fill="rgba(0,0,0,0.2)" />
			{/* Body */}
			<circle
				r={7}
				fill={color}
				stroke="rgba(255,255,255,0.85)"
				strokeWidth={1}
			/>
			{/* Name below dot */}
			<text
				y={16}
				textAnchor="middle"
				fontSize={5}
				fontWeight={600}
				fill="rgba(255,255,255,0.9)"
				style={{ pointerEvents: "none", userSelect: "none" }}
			>
				{lastName}
			</text>
			{/* Debug action label above dot */}
			{showDebug && action && actionColor && (
				<>
					<rect x={-14} y={-20} width={28} height={9} rx={3} fill={actionColor} />
					<text
						y={-13}
						textAnchor="middle"
						fontSize={5}
						fontWeight={700}
						fill="#111"
						style={{ pointerEvents: "none", userSelect: "none" }}
					>
						{action}
					</text>
				</>
			)}
			{/* Buildup candidate score badge */}
			{showDebug && scoreBadgeColor && (
				<>
					<rect x={-13} y={-32} width={26} height={9} rx={3} fill={scoreBadgeColor} opacity={0.9} />
					<text
						y={-25}
						textAnchor="middle"
						fontSize={5}
						fontWeight={700}
						fill="#111"
						style={{ pointerEvents: "none", userSelect: "none" }}
					>
						{candidateScore?.toFixed(2)}
					</text>
				</>
			)}
			{/* Carry indicator */}
			{showDebug && isCarrying && (
				<>
					<rect x={-14} y={-32} width={28} height={9} rx={3} fill="#a78bfa" />
					<text
						y={-25}
						textAnchor="middle"
						fontSize={5}
						fontWeight={700}
						fill="#111"
						style={{ pointerEvents: "none", userSelect: "none" }}
					>
						CARRY
					</text>
				</>
			)}
		</g>
	);
}

function PressureRing({ holderId, players }: { holderId: string; players: SimPlayer[] }) {
	const holder = players.find((p) => p.id === holderId);
	if (!holder) return null;
	const { px, py } = simToScreen(holder.x, holder.y);
	// 0.14 = carry pressure threshold in sim coords (fraction of pitch)
	const r = 0.14 * ((W + H) / 2) * 0.35;
	return (
		<circle
			cx={px}
			cy={py}
			r={r}
			fill="none"
			stroke="rgba(251,191,36,0.5)"
			strokeWidth={1.5}
			strokeDasharray="4 3"
		/>
	);
}

function TargetLines({ players }: { players: SimPlayer[] }) {
	return (
		<>
			{players.map((p) => {
				const { px: x1, py: y1 } = simToScreen(p.x, p.y);
				const { px: x2, py: y2 } = simToScreen(p.targetX, p.targetY);
				const dx = x2 - x1;
				const dy = y2 - y1;
				const len = Math.sqrt(dx * dx + dy * dy);
				if (len < 3) return null;
				const action = p.debugAction ?? "shape";
				const color = ACTION_COLORS[action] ?? "rgba(255,255,255,0.3)";
				return (
					<line
						key={p.id}
						x1={x1}
						y1={y1}
						x2={x2}
						y2={y2}
						stroke={color}
						strokeWidth={1.5}
						strokeDasharray="3 3"
						opacity={0.7}
					/>
				);
			})}
		</>
	);
}

// ─── Ball ─────────────────────────────────────────────────────────────────────

function Ball({ x, y }: { x: number; y: number }) {
	const { px, py } = simToScreen(x, y);
	return (
		<g>
			<ellipse cx={px} cy={py + 5} rx={4} ry={1.5} fill="rgba(0,0,0,0.15)" />
			<circle
				cx={px}
				cy={py}
				r={4}
				fill="#fff"
				stroke="rgba(0,0,0,0.3)"
				strokeWidth={1}
			/>
			{/* Panel lines — purely decorative */}
			<circle
				cx={px}
				cy={py}
				r={1.5}
				fill="none"
				stroke="rgba(0,0,0,0.15)"
				strokeWidth={1}
			/>
		</g>
	);
}

// ─── Scoreboard ───────────────────────────────────────────────────────────────

function Scoreboard({
	homeShortName,
	awayShortName,
	homeColor,
	awayColor,
	homeScore,
	awayScore,
	minute,
	phase,
	done,
}: {
	homeShortName: string;
	awayShortName: string;
	homeColor: string;
	awayColor: string;
	homeScore: number;
	awayScore: number;
	minute: number;
	phase: string;
	done: boolean;
}) {
	return (
		<div style={{ textAlign: "center", marginBottom: 8 }}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					gap: 12,
				}}
			>
				<TeamLabel name={homeShortName} color={homeColor} align="right" />
				<div
					style={{
						fontSize: 24,
						fontWeight: 700,
						minWidth: 64,
						textAlign: "center",
						letterSpacing: 2,
					}}
				>
					{homeScore} – {awayScore}
				</div>
				<TeamLabel name={awayShortName} color={awayColor} align="left" />
			</div>
			<div
				style={{
					fontSize: 11,
					color: "var(--color-text-secondary)",
					marginTop: 4,
				}}
			>
				{done ? "Full time" : `${minute}' · ${phase}`}
			</div>
		</div>
	);
}

function TeamLabel({
	name,
	color,
	align,
}: {
	name: string;
	color: string;
	align: "left" | "right";
}) {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 5,
				flexDirection: align === "right" ? "row-reverse" : "row",
			}}
		>
			<div
				style={{
					width: 9,
					height: 9,
					borderRadius: "50%",
					background: color,
					flexShrink: 0,
				}}
			/>
			<span style={{ fontWeight: 600, fontSize: 13 }}>{name}</span>
		</div>
	);
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
	result: MatchResult;
	homeColor: string;
	awayColor: string;
	homeShortName: string;
	awayShortName: string;
	/** Players in order: GK first, then DEF, MID, FWD. */
	homePlayers: { id: string; name: string }[];
	awayPlayers: { id: string; name: string }[];
	/** Override ticks advanced per animation frame. Defaults to TICKS_PER_FRAME. */
	ticksPerFrame?: number;
	/** Called with every rendered frame — use for debug overlays or event logs. */
	onFrame?: (frame: SimFrame) => void;
	/** Show action labels above each player. */
	showDebug?: boolean;
}

export default function MatchPitchV2({
	result,
	homeColor,
	awayColor,
	homeShortName,
	awayShortName,
	homePlayers,
	awayPlayers,
	ticksPerFrame = TICKS_PER_FRAME,
	onFrame,
	showDebug = false,
}: Props) {
	const simRef = useRef<MatchSimulator | null>(null);
	const rafRef = useRef<number>(0);
	const frameCounterRef = useRef(0);
	const lastFrameRef = useRef<SimFrame | null>(null);


	const [frame, setFrame] = useState<SimFrame | null>(null);
	const [flashText, setFlashText] = useState<string | null>(null);
	const [paused, setPaused] = useState(false);
	const pausedRef = useRef(false);
	const [debugOn, setDebugOn] = useState(showDebug);

	// Boot the simulator once
	useEffect(() => {
		simRef.current = new MatchSimulator(result, homePlayers, awayPlayers);
	}, [result, homePlayers, awayPlayers]);

	// Spacebar toggles pause
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (e.code === "Space" && e.target === document.body) {
				e.preventDefault();
				pausedRef.current = !pausedRef.current;
				setPaused(pausedRef.current);
				console.debug(`[sim] ${pausedRef.current ? "paused" : "resumed"}`);
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	// rAF loop
	useEffect(() => {
		function loop() {
			const sim = simRef.current;
			if (!sim) return;

			let latestFrame: SimFrame | null = null;
			if (pausedRef.current) {
				latestFrame = lastFrameRef.current;
			} else if (ticksPerFrame >= 1) {
				for (let i = 0; i < ticksPerFrame; i++) {
					if (sim.done) break;
					latestFrame = sim.advance();
				}
			} else {
				// Fractional speed: advance one tick every N frames
				frameCounterRef.current++;
				const frameInterval = Math.round(1 / ticksPerFrame);
				if (frameCounterRef.current >= frameInterval) {
					frameCounterRef.current = 0;
					if (!sim.done) latestFrame = sim.advance();
				} else {
					latestFrame = lastFrameRef.current;
				}
			}

			if (latestFrame) {

				// Flash banners for notable events
				if (latestFrame.firedEvent) {
					const ev = latestFrame.firedEvent;
					const banners: Record<string, string> = {
						goal: `⚽ ${ev.playerName}`,
						yellowCard: `🟨 ${ev.playerName}`,
						redCard: `🟥 ${ev.playerName}`,
						injury: `🤕 ${ev.playerName}`,
					};
					setFlashText(banners[ev.type] ?? null);
					setTimeout(() => setFlashText(null), 2500);
				}

				lastFrameRef.current = latestFrame;
				onFrame?.(latestFrame);
				setFrame({ ...latestFrame });
			}

			if (!sim.done) {
				rafRef.current = requestAnimationFrame(loop);
			}
		}

		rafRef.current = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(rafRef.current);
	}, [ticksPerFrame, onFrame]);

	if (!frame) return null;

	return (
		<div>
			<div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
				<button
					type="button"
					onClick={() => setDebugOn((v) => !v)}
					style={{
						fontSize: 10,
						padding: "2px 8px",
						borderRadius: 4,
						border: "1px solid var(--color-border-tertiary)",
						background: debugOn ? "var(--color-background-secondary)" : "transparent",
						color: "var(--color-text-secondary)",
						cursor: "pointer",
					}}
				>
					{debugOn ? "debug on" : "debug off"}
				</button>
			</div>
			{paused && (
				<div style={{ textAlign: "center", fontSize: 11, color: "#888", marginBottom: 2 }}>
					PAUSED — press Space to resume
				</div>
			)}
			<Scoreboard
				homeShortName={homeShortName}
				awayShortName={awayShortName}
				homeColor={homeColor}
				awayColor={awayColor}
				homeScore={frame.homeScore}
				awayScore={frame.awayScore}
				minute={frame.minute}
				phase={frame.phase}
				done={frame.minute >= 90}
			/>

			{/* Progress bar */}
			<div
				style={{
					height: 3,
					background: "var(--color-border-tertiary)",
					borderRadius: 2,
					marginBottom: 8,
					overflow: "hidden",
				}}
			>
				<div
					style={{
						height: "100%",
						width: `${(frame.minute / 90) * 100}%`,
						background: "var(--color-text-primary)",
						borderRadius: 2,
					}}
				/>
			</div>

			{/* Flash banner */}
			<div style={{ minHeight: 28, marginBottom: 6, textAlign: "center" }}>
				{flashText && (
					<span
						style={{
							fontSize: 12,
							fontWeight: 600,
							padding: "3px 12px",
							background: "var(--color-background-secondary)",
							borderRadius: 99,
						}}
					>
						{flashText}
					</span>
				)}
			</div>

			{/* SVG Pitch */}
			<div
				style={{
					borderRadius: 10,
					overflow: "hidden",
					border: "1px solid #145523",
				}}
			>
				<svg
					viewBox={`0 0 ${W} ${H}`}
					style={{ display: "block", width: "100%" }}
				>
					<PitchSVG />

					{/* Buildup pressure ring — behind players */}
					{debugOn && frame.buildupDebug && (
						<PressureRing holderId={frame.buildupDebug.holderId} players={frame.players} />
					)}

					{/* Target lines — behind players */}
					{debugOn && <TargetLines players={frame.players} />}

					{/* Away players (render first so home players appear on top) */}
					{frame.players
						.filter((p) => !p.isHome)
						.map((p) => (
							<PlayerDot
								key={p.id}
								player={p}
								color={awayColor}
								showDebug={debugOn}
							/>
						))}

					{/* Home players */}
					{frame.players
						.filter((p) => p.isHome)
						.map((p) => {
							const debug = frame.buildupDebug;
							const candidate = debug?.candidates.find((c) => c.playerId === p.id);
							const isCarrying = debug?.isCarrying && p.id === debug.holderId;
							return (
								<PlayerDot
									key={p.id}
									player={p}
									color={homeColor}
									showDebug={debugOn}
									candidateScore={candidate?.score}
									isCarrying={isCarrying}
								/>
							);
						})}

					{/* Ball (always on top) */}
					<Ball x={frame.ball.x} y={frame.ball.y} />
				</svg>
			</div>
		</div>
	);
}
