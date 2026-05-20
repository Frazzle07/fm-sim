import { useEffect, useRef, useState } from "react";
import type { PlayerSeed } from "#/domains/match/simulator";
import { MatchSimulator } from "#/domains/match/simulator";
import type { SimFrame, SimPlayer } from "#/domains/match/types";

const W = 700;
const H = 440;
const PAD = 24;

// sim.y → screen.x (home attacks right), sim.x → screen.y
function simToScreen(x: number, y: number): { px: number; py: number } {
	return { px: y * W, py: x * H };
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
	onFrame?: (frame: SimFrame) => void;
}

export default function MatchPitch({
	homePlayers,
	awayPlayers,
	homeColor,
	awayColor,
	ticksPerFrame = 1,
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
					<Ball x={frame.ball.x} y={frame.ball.y} />
				</svg>
			</div>
		</div>
	);
}
