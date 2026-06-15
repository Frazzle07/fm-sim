import { useEffect, useRef, useState } from "react";

const W = 360;
const H = 540;
const PAD = 20;

function simToScreen(sx: number, sy: number) {
	return {
		px: PAD + sx * (W - PAD * 2),
		py: PAD + sy * (H - PAD * 2),
	};
}

function dist(ax: number, ay: number, bx: number, by: number) {
	return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

function stepToward(x: number, y: number, tx: number, ty: number, maxStep: number) {
	const d = dist(x, y, tx, ty);
	if (d <= maxStep) return { x: tx, y: ty };
	const r = maxStep / d;
	return { x: x + (tx - x) * r, y: y + (ty - y) * r };
}

// ─── Params ───────────────────────────────────────────────────────────────────

interface Params {
	playerSpeed: number;
	overshoot: number;     // how far PAST the receiver the ball is aimed (pitch fraction)
	collectRadius: number;
	ticksPerFrame: number;
}

const DEFAULTS: Params = {
	playerSpeed: 0.006,
	overshoot: 0.18,
	collectRadius: 0.035,
	ticksPerFrame: 1,
};

// ─── Sim state ────────────────────────────────────────────────────────────────

interface PlayerState {
	x: number; y: number;
	targetX: number; targetY: number;
}

type BallState =
	| { phase: "held"; holderId: 0 | 1 }
	// Flight aims at an overshoot point PAST the receiver. The ball eases toward
	// that point with the original deceleration curve; the receiver controls it
	// (stops it dead) when the ball reaches them — mid-flight, still moving.
	| {
			phase: "flight";
			fromX: number; fromY: number;
			toX: number; toY: number;        // overshoot target (the "X")
			recvX: number; recvY: number;     // where the receiver actually is
			receiverId: 0 | 1;
			startTick: number;
			durationTicks: number;
			easing: number;
		};

interface SimState {
	players: [PlayerState, PlayerState];
	ball: { x: number; y: number };
	ballState: BallState;
	tick: number;
	log: string;
}

// Player home positions
const HOME: [{ x: number; y: number }, { x: number; y: number }] = [
	{ x: 0.35, y: 0.75 },
	{ x: 0.65, y: 0.30 },
];

function initialState(): SimState {
	return {
		players: [
			{ x: HOME[0].x, y: HOME[0].y, targetX: HOME[0].x, targetY: HOME[0].y },
			{ x: HOME[1].x, y: HOME[1].y, targetX: HOME[1].x, targetY: HOME[1].y },
		],
		ball: { x: HOME[0].x, y: HOME[0].y },
		ballState: { phase: "held", holderId: 0 },
		tick: 0,
		log: "Player 0 has the ball",
	};
}

function tick(s: SimState, p: Params): SimState {
	const next: SimState = {
		...s,
		players: [{ ...s.players[0] }, { ...s.players[1] }],
		ball: { ...s.ball },
		tick: s.tick + 1,
		log: s.log,
	};

	const bs = s.ballState;

	// ── Held: carrier waits, then passes after a short dwell ─────────────────
	if (bs.phase === "held") {
		const holderId = bs.holderId;
		const receiverId: 0 | 1 = holderId === 0 ? 1 : 0;
		const carrier = next.players[holderId];
		const receiver = next.players[receiverId];

		// Ball sticks to carrier
		next.ball = { x: carrier.x, y: carrier.y };

		// Carrier drifts slightly toward centre for visual interest
		const cm = stepToward(carrier.x, carrier.y, HOME[holderId].x, HOME[holderId].y, p.playerSpeed * 0.5);
		carrier.x = cm.x; carrier.y = cm.y;

		// Receiver wanders back to their home spot
		const rm = stepToward(receiver.x, receiver.y, HOME[receiverId].x, HOME[receiverId].y, p.playerSpeed);
		receiver.x = rm.x; receiver.y = rm.y;

		// Pass once carrier is settled near home and receiver is near their spot
		const carrierReady = dist(carrier.x, carrier.y, HOME[holderId].x, HOME[holderId].y) < 0.015;
		const receiverReady = dist(receiver.x, receiver.y, HOME[receiverId].x, HOME[receiverId].y) < 0.04;

		if (carrierReady && receiverReady) {
			// Aim PAST the receiver: the overshoot point is the receiver's
			// position extended along the pass direction by `overshoot`. The ball
			// eases toward THIS point; the receiver controls it on the way.
			const dx = receiver.x - carrier.x;
			const dy = receiver.y - carrier.y;
			const d = Math.sqrt(dx * dx + dy * dy) || 1;
			const ux = dx / d, uy = dy / d;          // unit vector passer→receiver
			const toX = receiver.x + ux * p.overshoot;
			const toY = receiver.y + uy * p.overshoot;

			// Duration & easing computed against the OVERSHOOT distance, using the
			// original simulator formula so the deceleration curve is unchanged.
			const overD = Math.sqrt((toX - carrier.x) ** 2 + (toY - carrier.y) ** 2);
			const speedFactor = 0.9 + Math.random() * 0.4;
			const durationTicks = Math.round((18 + overD * 130) * speedFactor);
			const easing = 2 + overD * 6;

			next.ballState = {
				phase: "flight",
				fromX: carrier.x, fromY: carrier.y,
				toX, toY,
				recvX: receiver.x, recvY: receiver.y,
				receiverId,
				startTick: next.tick,
				durationTicks,
				easing,
			};
			next.log = `Pass: P${holderId} → P${receiverId} (aimed past, ${durationTicks}t)`;
		}
		return next;
	}

	// ── In flight ─────────────────────────────────────────────────────────────
	if (bs.phase === "flight") {
		const { fromX, fromY, toX, toY, recvX, recvY, receiverId, startTick, durationTicks, easing } = bs;
		const t = Math.min((next.tick - startTick) / durationTicks, 1);
		// ORIGINAL easing — accelerate off the boot, decelerate toward the
		// overshoot point. The receiver sits before that point, so the ball is
		// still moving with pace when it reaches them.
		const eased = 1 - (1 - t) ** easing;

		next.ball = {
			x: fromX + (toX - fromX) * eased,
			y: fromY + (toY - fromY) * eased,
		};

		// Receiver holds their receiving spot, waiting to control the ball.
		const receiver = next.players[receiverId];
		const rm = stepToward(receiver.x, receiver.y, recvX, recvY, p.playerSpeed);
		receiver.x = rm.x; receiver.y = rm.y;

		// Control: when the ball reaches the receiver, they stop it dead.
		const dToBall = dist(receiver.x, receiver.y, next.ball.x, next.ball.y);
		if (dToBall < p.collectRadius) {
			next.ball = { x: receiver.x, y: receiver.y };
			next.ballState = { phase: "held", holderId: receiverId };
			next.log = `P${receiverId} controlled it (t=${t.toFixed(2)} — ball still moving)`;
		} else if (t >= 1) {
			// Safety: ball reached the overshoot point untouched — it's now at rest
			// there. Receiver collects on arrival (rare; means the pass missed).
			next.ball = { x: toX, y: toY };
			next.ballState = { phase: "held", holderId: receiverId };
			next.log = `Ball reached overshoot point untouched`;
		} else {
			next.ballState = { ...bs };
		}
		return next;
	}

	return next;
}

// ─── Slider ───────────────────────────────────────────────────────────────────

function Slider({ label, value, min, max, step, onChange, defaultValue }: {
	label: string; value: number; min: number; max: number;
	step: number; onChange: (v: number) => void; defaultValue: number;
}) {
	return (
		<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
			<span style={{ width: 160, fontSize: 11, color: "#ccc", flexShrink: 0 }}>{label}</span>
			<input type="range" min={min} max={max} step={step} value={value}
				onChange={(e) => onChange(Number(e.target.value))}
				style={{ flex: 1, accentColor: "#4ade80" }} />
			<span style={{ width: 48, fontSize: 11, color: "#fff", textAlign: "right" }}>
				{value.toFixed(step < 0.01 ? 3 : step < 0.1 ? 2 : 0)}
			</span>
			{value !== defaultValue && (
				<button type="button" onClick={() => onChange(defaultValue)}
					style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, border: "1px solid #444", background: "transparent", color: "#666", cursor: "pointer" }}>
					↺
				</button>
			)}
		</div>
	);
}

// ─── Pitch ────────────────────────────────────────────────────────────────────

function MiniPitch() {
	return (
		<>
			<rect width={W} height={H} fill="#1a6b2f" />
			{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
				<rect key={i} x={0} y={(i * H) / 8} width={W} height={H / 16} fill="rgba(0,0,0,0.05)" />
			))}
			<rect x={PAD} y={PAD} width={W - PAD * 2} height={H - PAD * 2} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} />
			<line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} stroke="rgba(255,255,255,0.4)" strokeWidth={1} />
			<circle cx={W / 2} cy={H / 2} r={50} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
		</>
	);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const COLORS = ["#22c55e", "#3b82f6"];
const LABELS = ["P0", "P1"];

export default function PassPlayground() {
	const [params, setParams] = useState<Params>(DEFAULTS);
	const stateRef = useRef<SimState>(initialState());
	const paramsRef = useRef<Params>(DEFAULTS);
	const rafRef = useRef(0);
	const [view, setView] = useState<SimState>(initialState());

	useEffect(() => { paramsRef.current = params; }, [params]);

	useEffect(() => {
		function loop() {
			const p = paramsRef.current;
			for (let i = 0; i < p.ticksPerFrame; i++) {
				stateRef.current = tick(stateRef.current, p);
			}
			setView({ ...stateRef.current });
			rafRef.current = requestAnimationFrame(loop);
		}
		rafRef.current = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(rafRef.current);
	}, []);

	function set<K extends keyof Params>(key: K, val: Params[K]) {
		setParams((p) => ({ ...p, [key]: val }));
	}

	function reset() {
		stateRef.current = initialState();
	}

	const bs = simToScreen(view.ball.x, view.ball.y);
	const inFlight = view.ballState.phase === "flight";
	const flight = inFlight
		? (view.ballState as Extract<typeof view.ballState, { phase: "flight" }>)
		: null;

	return (
		<div style={{ display: "flex", gap: 24, padding: 24, fontFamily: "monospace", background: "#111", minHeight: "100vh" }}>

			{/* Pitch */}
			<div style={{ flexShrink: 0 }}>
				<div style={{ marginBottom: 8, fontSize: 11, color: "#888", height: 28 }}>
					<span style={{ color: inFlight ? "#a78bfa" : "#4ade80", fontWeight: 700 }}>
						{inFlight ? "IN FLIGHT" : "HELD"}
					</span>
					{"  "}
					<span style={{ fontSize: 10, color: "#555" }}>{view.log}</span>
				</div>

				<div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid #145523" }}>
					<svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Pass playground pitch">
						<MiniPitch />

						{/* Collect radius ring around ball */}
						<circle
							cx={bs.px} cy={bs.py}
							r={params.collectRadius * (W - PAD * 2)}
							fill="none" stroke="rgba(248,113,113,0.25)" strokeWidth={1} strokeDasharray="3 3"
						/>

						{/* Flight line to the OVERSHOOT point + the "X" marker */}
						{flight && (() => {
							const t = simToScreen(flight.toX, flight.toY);
							const r = simToScreen(flight.recvX, flight.recvY);
							return (
								<>
									{/* full intended line: passer → overshoot */}
									<line x1={bs.px} y1={bs.py} x2={t.px} y2={t.py} stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="2 4" />
									{/* the X — where the ball would go if uncontrolled */}
									<line x1={t.px - 6} y1={t.py - 6} x2={t.px + 6} y2={t.py + 6} stroke="rgba(239,68,68,0.7)" strokeWidth={1.5} />
									<line x1={t.px - 6} y1={t.py + 6} x2={t.px + 6} y2={t.py - 6} stroke="rgba(239,68,68,0.7)" strokeWidth={1.5} />
									{/* receiver control point */}
									<circle cx={r.px} cy={r.py} r={2} fill="rgba(255,255,255,0.5)" />
								</>
							);
						})()}

						{/* Players */}
						{view.players.map((pl, i) => {
							const ps = simToScreen(pl.x, pl.y);
							const hs = simToScreen(HOME[i].x, HOME[i].y);
							const hasBall = view.ballState.phase === "held" && (view.ballState as Extract<typeof view.ballState, {phase:"held"}>).holderId === i;
							const isReceiver = flight !== null && flight.receiverId === i;
							return (
								<g key={i}>
									{/* Home position marker */}
									<circle cx={hs.px} cy={hs.py} r={3} fill="none" stroke={COLORS[i]} strokeWidth={0.5} opacity={0.3} />
									{/* Player shadow */}
									<ellipse cx={ps.px} cy={ps.py + 8} rx={6} ry={2.5} fill="rgba(0,0,0,0.25)" />
									{/* Player circle */}
									<circle cx={ps.px} cy={ps.py} r={8}
										fill={COLORS[i]}
										stroke={isReceiver ? "#fff" : "rgba(255,255,255,0.6)"}
										strokeWidth={isReceiver ? 2 : 1}
									/>
									{hasBall && <circle cx={ps.px} cy={ps.py} r={11} fill="none" stroke="rgba(251,191,36,0.8)" strokeWidth={1.5} />}
									<text x={ps.px} y={ps.py + 4} textAnchor="middle" fontSize={6} fontWeight={700} fill="#fff" style={{ pointerEvents: "none", userSelect: "none" }}>{LABELS[i]}</text>
								</g>
							);
						})}

						{/* Ball */}
						<g transform={`translate(${bs.px},${bs.py})`}>
							<ellipse rx={4} ry={1.5} cy={5} fill="rgba(0,0,0,0.3)" />
							<circle r={4} fill={inFlight ? "#fbbf24" : "#f5f0e0"} stroke="#888" strokeWidth={0.8} />
						</g>
					</svg>
				</div>
			</div>

			{/* Controls */}
			<div style={{ flex: 1, minWidth: 280 }}>
				<div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>Pass Playground</div>
				<div style={{ fontSize: 10, color: "#555", marginBottom: 16 }}>
					Two players passing back and forth. The ball is aimed at the red <b>X</b> — a point
					<i> past</i> the receiver. It eases toward the X with the original curve, but the
					receiver controls it (stops it dead) while it's still moving.<br />
					White ring = receiver. Raise <b>overshoot</b> to make the ball arrive with more pace.
				</div>

				<div style={{ fontSize: 11, color: "#666", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Players</div>
				<Slider label="playerSpeed" value={params.playerSpeed} min={0.002} max={0.02} step={0.001} defaultValue={DEFAULTS.playerSpeed} onChange={(v) => set("playerSpeed", v)} />

				<div style={{ fontSize: 11, color: "#666", marginBottom: 8, marginTop: 16, textTransform: "uppercase", letterSpacing: 1 }}>Ball physics</div>
				<Slider label="overshoot (past receiver)" value={params.overshoot} min={0} max={0.5} step={0.01} defaultValue={DEFAULTS.overshoot} onChange={(v) => set("overshoot", v)} />
				<Slider label="collectRadius" value={params.collectRadius} min={0.01} max={0.1} step={0.005} defaultValue={DEFAULTS.collectRadius} onChange={(v) => set("collectRadius", v)} />

				<div style={{ fontSize: 11, color: "#666", marginBottom: 8, marginTop: 16, textTransform: "uppercase", letterSpacing: 1 }}>Simulation</div>
				<Slider label="ticksPerFrame" value={params.ticksPerFrame} min={1} max={8} step={1} defaultValue={DEFAULTS.ticksPerFrame} onChange={(v) => set("ticksPerFrame", v)} />

				<button type="button" onClick={reset}
					style={{ marginTop: 16, padding: "6px 14px", borderRadius: 4, border: "1px solid #444", background: "transparent", color: "#aaa", fontSize: 11, cursor: "pointer" }}>
					Reset
				</button>

				{/* Live readout */}
				<div style={{ marginTop: 16, padding: 12, background: "#1a1a1a", borderRadius: 6, fontSize: 10, color: "#555", lineHeight: 2 }}>
					<div style={{ color: "#777", marginBottom: 4 }}>Live state (tick {view.tick})</div>
					{view.players.map((pl, i) => (
						<div key={i}>P{i}: ({pl.x.toFixed(3)}, {pl.y.toFixed(3)})</div>
					))}
					<div>ball: ({view.ball.x.toFixed(3)}, {view.ball.y.toFixed(3)})</div>
					{flight && (() => {
						const elapsed = view.tick - flight.startTick;
						const t = Math.min(elapsed / flight.durationTicks, 1);
						// instantaneous ball speed (derivative of easing × overshoot dist)
						const overD = Math.sqrt((flight.toX - flight.fromX) ** 2 + (flight.toY - flight.fromY) ** 2);
						const dEased = flight.easing * (1 - t) ** (flight.easing - 1) / flight.durationTicks;
						const speed = dEased * overD;
						return (
							<>
								<div style={{ color: "#a78bfa" }}>t: {t.toFixed(2)} ({elapsed}/{flight.durationTicks} ticks)</div>
								<div style={{ color: "#fbbf24" }}>ball speed: {speed.toFixed(4)} /tick</div>
							</>
						);
					})()}
				</div>
			</div>
		</div>
	);
}
