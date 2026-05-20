/**
 * DribblePlayground — isolated testbed for tuning player and ball movement.
 *
 * Physics model:
 *   - Players move at a fixed max speed (pitch-fractions/tick) toward their target.
 *   - Carrier moves slightly slower than an outfield player without the ball.
 *   - Ball is pinned to the carrier while dribbling.
 *   - On a pass the ball gets an initial speed and decelerates by a friction
 *     multiplier each tick until it reaches the receiver.
 */

import { useEffect, useRef, useState } from "react";

// ─── Pitch dimensions ─────────────────────────────────────────────────────────

const W = 360;
const H = 540;
const PAD = 20;

function simToScreen(sx: number, sy: number): { px: number; py: number } {
	return {
		px: PAD + sx * (W - PAD * 2),
		py: PAD + sy * (H - PAD * 2),
	};
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dist(ax: number, ay: number, bx: number, by: number) {
	return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

function stepToward(
	x: number, y: number,
	tx: number, ty: number,
	maxStep: number,
): { x: number; y: number } {
	const d = dist(x, y, tx, ty);
	if (d <= maxStep) return { x: tx, y: ty };
	const r = maxStep / d;
	return { x: x + (tx - x) * r, y: y + (ty - y) * r };
}

// ─── Seeded RNG (mulberry32) ──────────────────────────────────────────────────

function makeRng(seed: number) {
	let s = seed;
	return () => {
		s |= 0;
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// ─── State ────────────────────────────────────────────────────────────────────

interface Player {
	x: number; y: number;
	targetX: number; targetY: number;
}

interface Ball {
	x: number; y: number;
	speed: number;
	targetX: number; targetY: number;
	inFlight: boolean;
}

interface SimState {
	carrier: Player;
	defender: Player;
	ball: Ball;
	action: string;
	reason: string;
}

function initialState(): SimState {
	return {
		carrier:  { x: 0.5,  y: 0.65, targetX: 0.5,  targetY: 0.65 },
		defender: { x: 0.52, y: 0.42, targetX: 0.52, targetY: 0.42 },
		ball: { x: 0.5, y: 0.65, speed: 0, targetX: 0.5, targetY: 0.65, inFlight: false },
		action: "idle",
		reason: "",
	};
}

// ─── Dribble decision ─────────────────────────────────────────────────────────

interface DribbleParams {
	dribbleStride: number;
	spaceThreshold: number;
	pressureRadius: number;
}

function decideDribble(
	carrier: Player,
	defender: Player,
	rng: () => number,
	p: DribbleParams,
): { targetX: number; targetY: number; action: string; reason: string } {
	const probeY    = Math.max(0.05, Math.min(0.95, carrier.y - 0.15));
	const spaceAhead = Math.min(1, dist(carrier.x, probeY, defender.x, defender.y));
	const nearDef   = dist(carrier.x, carrier.y, defender.x, defender.y);
	const hasSpace      = spaceAhead > p.spaceThreshold;
	const underPressure = nearDef < p.pressureRadius;

	const strideScale = hasSpace ? 1 : underPressure ? 0.3 : 0.6;
	const stride  = -p.dribbleStride * strideScale;
	const jitterX = (rng() - 0.5) * (hasSpace ? 0.02 : 0.008);

	return {
		targetX: Math.max(0.05, Math.min(0.95, carrier.x + jitterX)),
		targetY: Math.max(0.05, Math.min(0.95, carrier.y + stride)),
		action: hasSpace ? "run" : underPressure ? "shield" : "slow carry",
		reason: hasSpace
			? `space=${spaceAhead.toFixed(2)}, running`
			: underPressure
				? `under pressure (def=${nearDef.toFixed(2)}), shielding`
				: `limited space=${spaceAhead.toFixed(2)}, slow carry`,
	};
}

// ─── Params ───────────────────────────────────────────────────────────────────

interface Params {
	playerSpeed: number;      // outfield player without ball (pitch-fractions/tick)
	carrierSpeed: number;     // carrier is slower due to dribbling
	defenderSpeed: number;
	ballInitialSpeed: number; // speed when a pass is first kicked
	ballFriction: number;     // multiplied each tick while in flight
	dribbleStride: number;
	spaceThreshold: number;
	pressureRadius: number;
	ticksPerFrame: number;
}

const DEFAULTS: Params = {
	playerSpeed:      0.006,
	carrierSpeed:     0.005,
	defenderSpeed:    0.006,
	ballInitialSpeed: 0.020,
	ballFriction:     0.976,
	dribbleStride:    0.025,
	spaceThreshold:   0.25,
	pressureRadius:   0.15,
	ticksPerFrame:    1,
};

// ─── Tick ─────────────────────────────────────────────────────────────────────

function tick(s: SimState, p: Params, rng: () => number) {
	// ── Ball in flight (pass) ─────────────────────────────────────────────────
	if (s.ball.inFlight) {
		const d = dist(s.ball.x, s.ball.y, s.ball.targetX, s.ball.targetY);
		if (d <= s.ball.speed || s.ball.speed < 0.001) {
			// Arrived — carrier takes possession at receiving position
			s.ball.x = s.ball.targetX;
			s.ball.y = s.ball.targetY;
			s.ball.inFlight = false;
			s.ball.speed = 0;
			s.carrier.x = s.ball.x;
			s.carrier.y = s.ball.y;
			s.carrier.targetX = s.carrier.x;
			s.carrier.targetY = s.carrier.y;
		} else {
			const r = s.ball.speed / d;
			s.ball.x += (s.ball.targetX - s.ball.x) * r;
			s.ball.y += (s.ball.targetY - s.ball.y) * r;
			s.ball.speed *= p.ballFriction;
		}
		return;
	}

	// ── Dribble ───────────────────────────────────────────────────────────────
	const drib = decideDribble(s.carrier, s.defender, rng, p);
	s.carrier.targetX = drib.targetX;
	s.carrier.targetY = drib.targetY;
	s.action = drib.action;
	s.reason = drib.reason;

	const cm = stepToward(s.carrier.x, s.carrier.y, s.carrier.targetX, s.carrier.targetY, p.carrierSpeed);
	s.carrier.x = cm.x;
	s.carrier.y = cm.y;

	// Ball pinned to carrier
	s.ball.x = s.carrier.x;
	s.ball.y = s.carrier.y;
	s.ball.targetX = s.carrier.x;
	s.ball.targetY = s.carrier.y;

	// ── Defender closes in ────────────────────────────────────────────────────
	const interceptY = Math.max(0.05, s.carrier.y - 0.08);
	const interceptX = s.carrier.x + (s.defender.x < s.carrier.x ? 0.04 : -0.04);
	const dm = stepToward(s.defender.x, s.defender.y, interceptX, interceptY, p.defenderSpeed);
	s.defender.x = dm.x;
	s.defender.y = dm.y;

	// ── Carrier reaches top → pass back to reset ──────────────────────────────
	if (s.carrier.y < 0.18) {
		const newX = 0.35 + rng() * 0.3;
		const newY = 0.82;
		s.ball.inFlight = true;
		s.ball.speed = p.ballInitialSpeed;
		s.ball.targetX = newX;
		s.ball.targetY = newY;
		s.defender.x = newX + 0.08;
		s.defender.y = newY - 0.22;
		s.action = "pass";
		s.reason = "reached top, resetting";
	}
}

// ─── Slider ───────────────────────────────────────────────────────────────────

function Slider({
	label, value, min, max, step, onChange, defaultValue,
}: {
	label: string; value: number; min: number; max: number;
	step: number; onChange: (v: number) => void; defaultValue: number;
}) {
	return (
		<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
			<span style={{ width: 152, fontSize: 11, color: "#ccc", flexShrink: 0 }}>{label}</span>
			<input
				type="range" min={min} max={max} step={step} value={value}
				onChange={(e) => onChange(Number(e.target.value))}
				style={{ flex: 1, accentColor: "#4ade80" }}
			/>
			<span style={{ width: 44, fontSize: 11, color: "#fff", textAlign: "right" }}>
				{value.toFixed(step < 0.01 ? 3 : step < 0.1 ? 2 : 0)}
			</span>
			{value !== defaultValue && (
				<button
					type="button"
					onClick={() => onChange(defaultValue)}
					style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, border: "1px solid #444", background: "transparent", color: "#666", cursor: "pointer" }}
				>
					↺
				</button>
			)}
		</div>
	);
}

// ─── Pitch SVG ────────────────────────────────────────────────────────────────

function MiniPitch() {
	return (
		<>
			<rect width={W} height={H} fill="#1a6b2f" />
			{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
				<rect key={`s${i}`} x={0} y={(i * H) / 8} width={W} height={H / 16} fill="rgba(0,0,0,0.05)" />
			))}
			<rect x={PAD} y={PAD} width={W - PAD * 2} height={H - PAD * 2} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />
			<line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />
			<circle cx={W / 2} cy={H / 2} r={50} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />
			<rect x={W * 0.2} y={PAD} width={W * 0.6} height={H * 0.16} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />
			<rect x={W * 0.38} y={14} width={W * 0.24} height={8} fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.5)" strokeWidth={1} />
			<rect x={W * 0.2} y={H - PAD - H * 0.16} width={W * 0.6} height={H * 0.16} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />
		</>
	);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DribblePlayground() {
	const [params, setParams] = useState<Params>(DEFAULTS);

	const stateRef  = useRef<SimState>(initialState());
	const rngRef    = useRef(makeRng(42));
	const rafRef    = useRef(0);
	const paramsRef = useRef<Params>(DEFAULTS);
	const [view, setView] = useState<SimState>(initialState());

	useEffect(() => { paramsRef.current = params; }, [params]);

	useEffect(() => {
		function loop() {
			const p = paramsRef.current;
			for (let i = 0; i < p.ticksPerFrame; i++) tick(stateRef.current, p, rngRef.current);
			setView({ ...stateRef.current, ball: { ...stateRef.current.ball } });
			rafRef.current = requestAnimationFrame(loop);
		}
		rafRef.current = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(rafRef.current);
	}, []);

	function set<K extends keyof Params>(key: K, value: Params[K]) {
		setParams((p) => ({ ...p, [key]: value }));
	}

	const cs = simToScreen(view.carrier.x,  view.carrier.y);
	const ds = simToScreen(view.defender.x, view.defender.y);
	const bs = simToScreen(view.ball.x,     view.ball.y);

	return (
		<div style={{ display: "flex", gap: 24, padding: 24, fontFamily: "monospace", background: "#111", minHeight: "100vh" }}>

			{/* Pitch */}
			<div style={{ flexShrink: 0 }}>
				<div style={{ marginBottom: 8, fontSize: 12, color: "#888" }}>
					action: <span style={{ color: "#4ade80", fontWeight: 700 }}>{view.action}</span>
					<br />
					<span style={{ fontSize: 10, color: "#555" }}>{view.reason}</span>
				</div>
				<div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid #145523" }}>
					<svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Dribble playground pitch">
						<MiniPitch />

						{/* Pressure radius ring */}
						<circle
							cx={ds.px} cy={ds.py}
							r={params.pressureRadius * (W - PAD * 2)}
							fill="none" stroke="rgba(248,113,113,0.3)" strokeWidth={1} strokeDasharray="4 3"
						/>

						{/* Carrier target line */}
						{!view.ball.inFlight && (() => {
							const t = simToScreen(view.carrier.targetX, view.carrier.targetY);
							return <line x1={cs.px} y1={cs.py} x2={t.px} y2={t.py} stroke="rgba(251,191,36,0.35)" strokeWidth={1} strokeDasharray="3 3" />;
						})()}

						{/* Ball flight trail */}
						{view.ball.inFlight && (() => {
							const t = simToScreen(view.ball.targetX, view.ball.targetY);
							return <line x1={bs.px} y1={bs.py} x2={t.px} y2={t.py} stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="2 4" />;
						})()}

						{/* Defender */}
						<g transform={`translate(${ds.px},${ds.py})`}>
							<ellipse rx={6} ry={2.5} cy={8} fill="rgba(0,0,0,0.25)" />
							<circle r={7} fill="#ef4444" stroke="rgba(255,255,255,0.85)" strokeWidth={1} />
							<text y={16} textAnchor="middle" fontSize={6} fontWeight={600} fill="rgba(255,255,255,0.9)" style={{ pointerEvents: "none", userSelect: "none" }}>DEF</text>
						</g>

						{/* Carrier */}
						<g transform={`translate(${cs.px},${cs.py})`}>
							<ellipse rx={6} ry={2.5} cy={8} fill="rgba(0,0,0,0.25)" />
							<circle r={7} fill="#22c55e" stroke="rgba(255,255,255,0.85)" strokeWidth={1} />
							<text y={16} textAnchor="middle" fontSize={6} fontWeight={600} fill="rgba(255,255,255,0.9)" style={{ pointerEvents: "none", userSelect: "none" }}>CAR</text>
							<rect x={-16} y={-20} width={32} height={9} rx={3} fill="rgba(251,191,36,0.9)" />
							<text y={-13} textAnchor="middle" fontSize={5} fontWeight={700} fill="#111" style={{ pointerEvents: "none", userSelect: "none" }}>{view.action}</text>
						</g>

						{/* Ball */}
						<g transform={`translate(${bs.px},${bs.py})`}>
							<ellipse rx={4} ry={1.5} cy={5} fill="rgba(0,0,0,0.3)" />
							<circle r={4} fill="#f5f0e0" stroke="#888" strokeWidth={0.8} />
						</g>
					</svg>
				</div>
			</div>

			{/* Controls */}
			<div style={{ flex: 1, minWidth: 300 }}>
				<div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Dribble Playground</div>
				<div style={{ fontSize: 10, color: "#555", marginBottom: 20 }}>speeds in pitch-fractions/tick · friction is a per-tick multiplier</div>

				<div style={{ fontSize: 11, color: "#666", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Players</div>
				<Slider label="playerSpeed (no ball)" value={params.playerSpeed}    min={0.002} max={0.03}  step={0.001} defaultValue={DEFAULTS.playerSpeed}    onChange={(v) => set("playerSpeed", v)} />
				<Slider label="carrierSpeed (w/ ball)" value={params.carrierSpeed}   min={0.002} max={0.03}  step={0.001} defaultValue={DEFAULTS.carrierSpeed}   onChange={(v) => set("carrierSpeed", v)} />
				<Slider label="defenderSpeed"          value={params.defenderSpeed}  min={0.002} max={0.03}  step={0.001} defaultValue={DEFAULTS.defenderSpeed}  onChange={(v) => set("defenderSpeed", v)} />

				<div style={{ fontSize: 11, color: "#666", marginBottom: 8, marginTop: 16, textTransform: "uppercase", letterSpacing: 1 }}>Ball</div>
				<Slider label="ballInitialSpeed"  value={params.ballInitialSpeed} min={0.01}  max={0.15}  step={0.005} defaultValue={DEFAULTS.ballInitialSpeed} onChange={(v) => set("ballInitialSpeed", v)} />
				<Slider label="ballFriction"      value={params.ballFriction}     min={0.80}  max={0.999} step={0.001} defaultValue={DEFAULTS.ballFriction}     onChange={(v) => set("ballFriction", v)} />

				<div style={{ fontSize: 11, color: "#666", marginBottom: 8, marginTop: 16, textTransform: "uppercase", letterSpacing: 1 }}>Dribble logic</div>
				<Slider label="dribbleStride"   value={params.dribbleStride}   min={0.005} max={0.08} step={0.001} defaultValue={DEFAULTS.dribbleStride}   onChange={(v) => set("dribbleStride", v)} />
				<Slider label="spaceThreshold"  value={params.spaceThreshold}  min={0.05}  max={0.6}  step={0.01}  defaultValue={DEFAULTS.spaceThreshold}  onChange={(v) => set("spaceThreshold", v)} />
				<Slider label="pressureRadius"  value={params.pressureRadius}  min={0.05}  max={0.4}  step={0.01}  defaultValue={DEFAULTS.pressureRadius}  onChange={(v) => set("pressureRadius", v)} />

				<div style={{ fontSize: 11, color: "#666", marginBottom: 8, marginTop: 16, textTransform: "uppercase", letterSpacing: 1 }}>Simulation</div>
				<Slider label="ticksPerFrame" value={params.ticksPerFrame} min={1} max={10} step={1} defaultValue={DEFAULTS.ticksPerFrame} onChange={(v) => set("ticksPerFrame", v)} />

				<div style={{ marginTop: 20, padding: 12, background: "#1a1a1a", borderRadius: 6, fontSize: 10, color: "#555", lineHeight: 1.8 }}>
					<div style={{ color: "#777", marginBottom: 4 }}>Live state</div>
					carrier:  ({view.carrier.x.toFixed(3)}, {view.carrier.y.toFixed(3)})<br />
					defender: ({view.defender.x.toFixed(3)}, {view.defender.y.toFixed(3)})<br />
					ball:     ({view.ball.x.toFixed(3)}, {view.ball.y.toFixed(3)})
					{view.ball.inFlight && (
						<><br /><span style={{ color: "#f59e0b" }}>in flight · speed {view.ball.speed.toFixed(4)}</span></>
					)}
				</div>
			</div>
		</div>
	);
}
