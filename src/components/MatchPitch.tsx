import { useEffect, useRef, useState } from "react";
import type { MatchEvent, MatchResult } from "#/domains/match/types";

// Pitch dimensions (SVG viewBox units)
const W = 400;
const H = 600;

// Formation slot positions [x, y] as fractions of W/H
// Attacking direction: home attacks top→bottom, away attacks bottom→top
const HOME_POSITIONS: [number, number][] = [
	// GK
	[0.5, 0.08],
	// DEF
	[0.2, 0.22], [0.4, 0.22], [0.6, 0.22], [0.8, 0.22],
	// MID
	[0.2, 0.40], [0.4, 0.40], [0.6, 0.40], [0.8, 0.40],
	// FWD
	[0.33, 0.56], [0.67, 0.56],
];

const AWAY_POSITIONS: [number, number][] = [
	// GK
	[0.5, 0.92],
	// DEF
	[0.2, 0.78], [0.4, 0.78], [0.6, 0.78], [0.8, 0.78],
	// MID
	[0.2, 0.60], [0.4, 0.60], [0.6, 0.60], [0.8, 0.60],
	// FWD
	[0.33, 0.44], [0.67, 0.44],
];

interface Vec2 { x: number; y: number }

function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
	return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function rand(min: number, max: number, seed: number) {
	// Deterministic-ish jitter per player
	return min + ((Math.sin(seed * 127.1) * 0.5 + 0.5) % 1) * (max - min);
}

// Returns a position near the ball for attackers, defensive shape for defenders
function getAttackPos(baseX: number, baseY: number, ballX: number, ballY: number, isHome: boolean, idx: number): Vec2 {
	const pull = isHome ? 0.3 : -0.3;
	const jitterX = rand(-0.05, 0.05, idx * 3.1);
	const jitterY = rand(-0.03, 0.03, idx * 7.3);
	return {
		x: (baseX + ballX * 0.15 + jitterX) * W,
		y: (baseY + pull * 0.1 + ballY * 0.05 + jitterY) * H,
	};
}

interface PlayerDot {
	id: number;
	isHome: boolean;
	label: string;
	color: string;
	pos: Vec2;
	target: Vec2;
}

function buildDots(homeColor: string, awayColor: string): PlayerDot[] {
	const dots: PlayerDot[] = [];
	for (let i = 0; i < 11; i++) {
		const [fx, fy] = HOME_POSITIONS[i];
		const pos: Vec2 = { x: fx * W, y: fy * H };
		dots.push({ id: i, isHome: true, label: i === 0 ? "GK" : String(i), color: homeColor, pos: { ...pos }, target: { ...pos } });
	}
	for (let i = 0; i < 11; i++) {
		const [fx, fy] = AWAY_POSITIONS[i];
		const pos: Vec2 = { x: fx * W, y: fy * H };
		dots.push({ id: i + 11, isHome: false, label: i === 0 ? "GK" : String(i), color: awayColor, pos: { ...pos }, target: { ...pos } });
	}
	return dots;
}

function ballTargetForEvent(event: MatchEvent | null, homeTeamId: string): Vec2 {
	if (!event) return { x: W / 2, y: H / 2 };
	const isHome = event.teamId === homeTeamId;
	switch (event.type) {
		case "goal":
			// Ball at attacking net
			return isHome ? { x: W / 2 + rand(-20, 20, 1), y: H * 0.94 } : { x: W / 2 + rand(-20, 20, 2), y: H * 0.06 };
		case "yellowCard":
		case "redCard":
			return { x: W * (isHome ? 0.3 : 0.7), y: H * 0.5 };
		case "injury":
			return { x: W * 0.5, y: H * (isHome ? 0.35 : 0.65) };
		default:
			return { x: W / 2, y: H / 2 };
	}
}

interface FlashEvent {
	text: string;
	minute: number;
	color: string;
	id: number;
}

export default function MatchPitch({
	result,
	homeColor,
	awayColor,
	homeShortName,
	awayShortName,
}: {
	result: MatchResult;
	homeColor: string;
	awayColor: string;
	homeShortName: string;
	awayShortName: string;
}) {
	const [minute, setMinute] = useState(0);
	const [homeScore, setHomeScore] = useState(0);
	const [awayScore, setAwayScore] = useState(0);
	const [dots, setDots] = useState<PlayerDot[]>(() => buildDots(homeColor, awayColor));
	const [ball, setBall] = useState<Vec2>({ x: W / 2, y: H / 2 });
	const [ballTarget, setBallTarget] = useState<Vec2>({ x: W / 2, y: H / 2 });
	const [flashes, setFlashes] = useState<FlashEvent[]>([]);
	const [done, setDone] = useState(false);
	const flashIdRef = useRef(0);

	const events = result.events; // sorted by minute

	// Tick the clock
	useEffect(() => {
		if (done) return;
		const id = setInterval(() => {
			setMinute((m) => {
				if (m >= 90) { setDone(true); return 90; }
				return m + 1;
			});
		}, 100); // 100ms per minute = 9s per match
		return () => clearInterval(id);
	}, [done]);

	// On each minute change: fire events, update ball target, jitter players
	useEffect(() => {
		const ev = events.find((e) => e.minute === minute);
		if (ev) {
			const bt = ballTargetForEvent(ev, result.homeTeamId);
			setBallTarget(bt);

			if (ev.type === "goal") {
				const isHome = ev.teamId === result.homeTeamId;
				if (isHome) setHomeScore((s) => s + 1);
				else setAwayScore((s) => s + 1);
				setFlashes((f) => [...f, { text: `⚽ ${ev.playerName}`, minute: ev.minute, color: isHome ? homeColor : awayColor, id: ++flashIdRef.current }]);
			} else if (ev.type === "yellowCard") {
				setFlashes((f) => [...f, { text: `🟨 ${ev.playerName}`, minute: ev.minute, color: "#f59e0b", id: ++flashIdRef.current }]);
			} else if (ev.type === "redCard") {
				setFlashes((f) => [...f, { text: `🟥 ${ev.playerName}`, minute: ev.minute, color: "#e02424", id: ++flashIdRef.current }]);
			} else if (ev.type === "injury") {
				setFlashes((f) => [...f, { text: `🤕 ${ev.playerName}`, minute: ev.minute, color: "#888", id: ++flashIdRef.current }]);
			}
		} else {
			// Random ball drift
			const rx = 0.15 + Math.random() * 0.7;
			const ry = 0.1 + Math.random() * 0.8;
			setBallTarget({ x: rx * W, y: ry * H });
		}
	}, [minute, events, result.homeTeamId, homeColor, awayColor]);

	// Animation frame: lerp ball and players toward targets
	useEffect(() => {
		let frameId: number;
		function tick() {
			setBall((b) => lerp(b, ballTarget, 0.05));
			setDots((ds) =>
				ds.map((d) => ({
					...d,
					pos: lerp(d.pos, d.target, 0.03),
				}))
			);
			frameId = requestAnimationFrame(tick);
		}
		frameId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frameId);
	}, [ballTarget]);

	// Update player targets based on ball position
	useEffect(() => {
		const bx = ball.x / W;
		const by = ball.y / H;
		setDots((ds) =>
			ds.map((d, i) => {
				const basePositions = d.isHome ? HOME_POSITIONS : AWAY_POSITIONS;
				const localIdx = d.isHome ? i : i - 11;
				const [fx, fy] = basePositions[localIdx] ?? [0.5, 0.5];
				const target = getAttackPos(fx, fy, bx, by, d.isHome, d.id);
				// Clamp inside pitch
				target.x = Math.max(16, Math.min(W - 16, target.x));
				target.y = Math.max(16, Math.min(H - 16, target.y));
				return { ...d, target };
			})
		);
	}, [ball]);

	// Remove flash after 2.5s
	useEffect(() => {
		if (flashes.length === 0) return;
		const id = setTimeout(() => setFlashes((f) => f.slice(1)), 2500);
		return () => clearTimeout(id);
	}, [flashes]);

	const progress = (minute / 90) * 100;

	return (
		<div style={{ fontFamily: "inherit" }}>
			{/* Scoreboard */}
			<div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 8 }}>
				<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
					<div style={{ width: 10, height: 10, borderRadius: "50%", background: homeColor }} />
					<span style={{ fontWeight: 600, fontSize: 13 }}>{homeShortName}</span>
				</div>
				<div style={{ fontSize: 22, fontWeight: 700, minWidth: 60, textAlign: "center" }}>
					{homeScore} – {awayScore}
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
					<span style={{ fontWeight: 600, fontSize: 13 }}>{awayShortName}</span>
					<div style={{ width: 10, height: 10, borderRadius: "50%", background: awayColor }} />
				</div>
			</div>

			{/* Minute + progress */}
			<div style={{ textAlign: "center", fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 6 }}>
				{done ? "Full time" : `${minute}'`}
			</div>
			<div style={{ height: 3, background: "var(--color-border-tertiary)", borderRadius: 2, marginBottom: 10, overflow: "hidden" }}>
				<div style={{ height: "100%", width: `${progress}%`, background: "var(--color-text-primary)", transition: "width 0.1s linear", borderRadius: 2 }} />
			</div>

			{/* Flash events */}
			<div style={{ minHeight: 24, marginBottom: 8, textAlign: "center" }}>
				{flashes[0] && (
					<span style={{ fontSize: 12, fontWeight: 600, color: flashes[0].color, padding: "2px 10px", background: "var(--color-background-secondary)", borderRadius: 99 }}>
						{flashes[0].text} {flashes[0].minute}'
					</span>
				)}
			</div>

			{/* SVG Pitch */}
			<div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #145523" }}>
				<svg viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%" }}>
					{/* Grass */}
					<rect width={W} height={H} fill="#1a6b2f" />

					{/* Grass stripes */}
					{Array.from({ length: 9 }, (_, i) => (
						<rect key={i} x={0} y={i * H / 9} width={W} height={H / 18} fill="rgba(0,0,0,0.04)" />
					))}

					{/* Pitch lines */}
					{/* Border */}
					<rect x={20} y={20} width={W - 40} height={H - 40} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
					{/* Halfway */}
					<line x1={20} y1={H / 2} x2={W - 20} y2={H / 2} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
					{/* Centre circle */}
					<circle cx={W / 2} cy={H / 2} r={50} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
					{/* Centre spot */}
					<circle cx={W / 2} cy={H / 2} r={3} fill="rgba(255,255,255,0.35)" />
					{/* Top penalty area */}
					<rect x={W * 0.22} y={20} width={W * 0.56} height={H * 0.15} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
					{/* Bottom penalty area */}
					<rect x={W * 0.22} y={H - 20 - H * 0.15} width={W * 0.56} height={H * 0.15} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
					{/* Top goal */}
					<rect x={W * 0.38} y={14} width={W * 0.24} height={10} fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
					{/* Bottom goal */}
					<rect x={W * 0.38} y={H - 24} width={W * 0.24} height={10} fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.35)" strokeWidth={1} />

					{/* Players */}
					{dots.map((d) => (
						<g key={d.id} transform={`translate(${d.pos.x},${d.pos.y})`}>
							<circle r={12} fill={d.color} stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} />
							<text textAnchor="middle" dominantBaseline="central" fontSize={8} fontWeight={700} fill="#fff">
								{d.label}
							</text>
						</g>
					))}

					{/* Ball */}
					<circle cx={ball.x} cy={ball.y} r={7} fill="#fff" stroke="rgba(0,0,0,0.4)" strokeWidth={1} />
					<circle cx={ball.x - 2} cy={ball.y - 2} r={2.5} fill="rgba(0,0,0,0.1)" />
				</svg>
			</div>
		</div>
	);
}
