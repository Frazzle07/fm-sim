import { useEffect, useRef, useState } from "react";
import { activeZone } from "#/domains/match/actions/GradientClimbAction";
import { ROLE_ZONE_CONFIG } from "#/domains/match/actions/roles";
import { distToSegment } from "#/domains/match/queries";
import type { PlayerSeed } from "#/domains/match/simulator";
import { MatchSimulator } from "#/domains/match/simulator";
import type { SimFrame, SimPlayer } from "#/domains/match/types";

const W = 700;
const H = 440;
const PAD = 24;
const LANE_BLOCK_RADIUS = 0.06; // keep in sync with PassAction.ts

// Role colours for zone rectangles — distinct enough to tell positions apart.
const ROLE_COLORS: Record<string, string> = {
	GK: "rgba(255,220,50,0.15)",
	LB: "rgba(50,180,255,0.12)",
	CB: "rgba(50,100,255,0.12)",
	RB: "rgba(50,180,255,0.12)",
	LW: "rgba(255,100,50,0.12)",
	CM: "rgba(80,255,120,0.12)",
	CDM: "rgba(80,200,80,0.12)",
	RW: "rgba(255,100,50,0.12)",
	CAM: "rgba(255,160,50,0.12)",
	CF: "rgba(255,50,50,0.12)",
};
const ROLE_STROKE: Record<string, string> = {
	GK: "rgba(255,220,50,0.4)",
	LB: "rgba(50,180,255,0.35)",
	CB: "rgba(50,100,255,0.35)",
	RB: "rgba(50,180,255,0.35)",
	LW: "rgba(255,100,50,0.35)",
	CM: "rgba(80,255,120,0.35)",
	CDM: "rgba(80,200,80,0.35)",
	RW: "rgba(255,100,50,0.35)",
	CAM: "rgba(255,160,50,0.35)",
	CF: "rgba(255,50,50,0.35)",
};

function ZoneOverlay({ frame }: { frame: SimFrame }) {
	return (
		<>
			{frame.players.map((p) => {
				const config = ROLE_ZONE_CONFIG[p.role as keyof typeof ROLE_ZONE_CONFIG];
				if (!config) return null;
				const zone = activeZone(p, frame.ball, config);
				// sim coords: x → screen y, y → screen x (see simToScreen)
				const { px: x1, py: y1 } = simToScreen(zone.xMin, zone.yMin);
				const { px: x2, py: y2 } = simToScreen(zone.xMax, zone.yMax);
				const rx = Math.min(x1, x2);
				const ry = Math.min(y1, y2);
				const rw = Math.abs(x2 - x1);
				const rh = Math.abs(y2 - y1);
				return (
					<rect
						key={p.id}
						x={rx}
						y={ry}
						width={rw}
						height={rh}
						fill={ROLE_COLORS[p.role] ?? "rgba(255,255,255,0.08)"}
						stroke={ROLE_STROKE[p.role] ?? "rgba(255,255,255,0.3)"}
						strokeWidth={1}
						strokeDasharray="3 2"
					/>
				);
			})}
		</>
	);
}

function PassLaneOverlay({ frame }: { frame: SimFrame }) {
	const holder = frame.players.find((p) => p.hasBall);
	if (!holder) return null;

	const teammates = frame.players.filter(
		(p) => p.isHome === holder.isHome && p.id !== holder.id,
	);
	const opponents = frame.players.filter((p) => p.isHome !== holder.isHome);

	return (
		<>
			{teammates.map((t) => {
				const blockers = opponents.filter(
					(o) => distToSegment(o, holder, t) < LANE_BLOCK_RADIUS,
				);
				const blocked = blockers.length > 0;

				const { px: x1, py: y1 } = simToScreen(holder.x, holder.y);
				const { px: x2, py: y2 } = simToScreen(t.x, t.y);

				// Tube half-width: radius is in sim units along the x axis (→ screen y),
				// so scale by the playable height to get pixels.
				const tubeHalfW = LANE_BLOCK_RADIUS * (H - PAD * 2);

				const dx = x2 - x1;
				const dy = y2 - y1;
				const len = Math.hypot(dx, dy);
				if (len === 0) return null;
				const nx = (-dy / len) * tubeHalfW;
				const ny = (dx / len) * tubeHalfW;

				const points = [
					[x1 + nx, y1 + ny],
					[x2 + nx, y2 + ny],
					[x2 - nx, y2 - ny],
					[x1 - nx, y1 - ny],
				]
					.map(([px, py]) => `${px},${py}`)
					.join(" ");

				return (
					<g key={t.id}>
						<polygon
							points={points}
							fill={blocked ? "rgba(255,60,60,0.15)" : "rgba(60,255,120,0.12)"}
							stroke={blocked ? "rgba(255,80,80,0.5)" : "rgba(60,220,100,0.4)"}
							strokeWidth={1}
						/>
						{blockers.map((o) => {
							const { px, py } = simToScreen(o.x, o.y);
							return (
								<circle
									key={o.id}
									cx={px}
									cy={py}
									r={10}
									fill="none"
									stroke="rgba(255,80,80,0.8)"
									strokeWidth={1.5}
								/>
							);
						})}
					</g>
				);
			})}
		</>
	);
}

// sim.y → screen.x (home attacks right), sim.x → screen.y
// Maps [0,1] into the pitch markings area, excluding the PAD border.
function simToScreen(x: number, y: number): { px: number; py: number } {
	return {
		px: PAD + y * (W - PAD * 2),
		py: PAD + x * (H - PAD * 2),
	};
}

function PitchMarkings() {
	return (
		<>
			<rect width={W} height={H} fill="#1a6b2f" />
			{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
				<rect
					key={i}
					x={(i * W) / 10}
					y={0}
					width={W / 20}
					height={H}
					fill="rgba(0,0,0,0.05)"
				/>
			))}
			<rect
				x={PAD}
				y={PAD}
				width={W - PAD * 2}
				height={H - PAD * 2}
				fill="none"
				stroke="rgba(255,255,255,0.4)"
				strokeWidth={1.5}
			/>
			<line
				x1={W / 2}
				y1={PAD}
				x2={W / 2}
				y2={H - PAD}
				stroke="rgba(255,255,255,0.4)"
				strokeWidth={1.5}
			/>
			<circle
				cx={W / 2}
				cy={H / 2}
				r={60}
				fill="none"
				stroke="rgba(255,255,255,0.4)"
				strokeWidth={1.5}
			/>
			<circle cx={W / 2} cy={H / 2} r={3} fill="rgba(255,255,255,0.4)" />
			{/* Left penalty area */}
			<rect
				x={PAD}
				y={H * 0.2}
				width={W * 0.16}
				height={H * 0.6}
				fill="none"
				stroke="rgba(255,255,255,0.4)"
				strokeWidth={1.5}
			/>
			<rect
				x={PAD}
				y={H * 0.35}
				width={W * 0.06}
				height={H * 0.3}
				fill="none"
				stroke="rgba(255,255,255,0.3)"
				strokeWidth={1}
			/>
			<circle cx={W * 0.14} cy={H / 2} r={2.5} fill="rgba(255,255,255,0.4)" />
			{/* Right penalty area */}
			<rect
				x={W - PAD - W * 0.16}
				y={H * 0.2}
				width={W * 0.16}
				height={H * 0.6}
				fill="none"
				stroke="rgba(255,255,255,0.4)"
				strokeWidth={1.5}
			/>
			<rect
				x={W - PAD - W * 0.06}
				y={H * 0.35}
				width={W * 0.06}
				height={H * 0.3}
				fill="none"
				stroke="rgba(255,255,255,0.3)"
				strokeWidth={1}
			/>
			<circle cx={W * 0.86} cy={H / 2} r={2.5} fill="rgba(255,255,255,0.4)" />
			{/* Goals */}
			<rect
				x={14}
				y={H * 0.38}
				width={12}
				height={H * 0.24}
				fill="rgba(255,255,255,0.1)"
				stroke="rgba(255,255,255,0.5)"
				strokeWidth={1}
			/>
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

function Ball({ x, y }: { x: number; y: number }) {
	const { px, py } = simToScreen(x, y);
	return (
		<g transform={`translate(${px},${py})`}>
			<ellipse rx={4} ry={1.5} cy={5} fill="rgba(0,0,0,0.2)" />
			<circle r={4} fill="#f5f0dc" stroke="rgba(0,0,0,0.4)" strokeWidth={0.75} />
		</g>
	);
}

function PlayerDot({ player, color }: { player: SimPlayer; color: string }) {
	const { px, py } = simToScreen(player.x, player.y);
	const lastName = player.name.split(" ").slice(-1)[0].slice(0, 6);
	return (
		<g transform={`translate(${px},${py})`}>
			<ellipse rx={6} ry={2.5} cy={8} fill="rgba(0,0,0,0.2)" />
			<circle
				r={7}
				fill={color}
				stroke="rgba(255,255,255,0.85)"
				strokeWidth={1}
			/>
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
		</g>
	);
}

interface Props {
	homePlayers: PlayerSeed[];
	awayPlayers: PlayerSeed[];
	homeColor: string;
	awayColor: string;
	ticksPerFrame?: number;
	showLanes?: boolean;
	showZones?: boolean;
	onFrame?: (frame: SimFrame) => void;
}

export default function MatchPitch({
	homePlayers,
	awayPlayers,
	homeColor,
	awayColor,
	ticksPerFrame = 1,
	showLanes = false,
	showZones = false,
	onFrame,
}: Props) {
	const simRef = useRef<MatchSimulator | null>(null);
	const rafRef = useRef<number>(0);
	const frameCounterRef = useRef(0);
	const lastFrameRef = useRef<SimFrame | null>(null);
	const [frame, setFrame] = useState<SimFrame | null>(null);

	useEffect(() => {
		simRef.current = new MatchSimulator(homePlayers, awayPlayers);
	}, [homePlayers, awayPlayers]);

	useEffect(() => {
		function loop() {
			const sim = simRef.current;
			if (!sim) return;

			const nowMs = performance.now();
			let latestFrame: SimFrame | null = null;
			if (ticksPerFrame >= 1) {
				for (let i = 0; i < ticksPerFrame; i++) {
					if (sim.done) break;
					latestFrame = sim.advance(nowMs);
				}
			} else {
				frameCounterRef.current++;
				const interval = Math.round(1 / ticksPerFrame);
				if (frameCounterRef.current >= interval) {
					frameCounterRef.current = 0;
					if (!sim.done) latestFrame = sim.advance(nowMs);
				} else {
					latestFrame = lastFrameRef.current;
				}
			}

			if (latestFrame) {
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
			<div
				style={{
					textAlign: "center",
					marginBottom: 8,
					fontSize: 11,
					color: "rgba(255,255,255,0.5)",
				}}
			>
				{frame.minute}' · {frame.phase}
			</div>
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
					aria-label="Match pitch"
				>
					<PitchMarkings />
					{showZones && <ZoneOverlay frame={frame} />}
					{frame.players
						.filter((p) => !p.isHome)
						.map((p) => (
							<PlayerDot key={p.id} player={p} color={awayColor} />
						))}
					{frame.players
						.filter((p) => p.isHome)
						.map((p) => (
							<PlayerDot key={p.id} player={p} color={homeColor} />
						))}
					{showLanes && <PassLaneOverlay frame={frame} />}
					<Ball x={frame.ball.x} y={frame.ball.y} />
				</svg>
			</div>
		</div>
	);
}
