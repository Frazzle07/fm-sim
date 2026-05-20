/**
 * /debug/match — thin harness over MatchPitchV2 + MatchSimulator.
 * Adjust speed/seed, hit Restart, and watch simulator changes live.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import type { SimFrame } from "#/domains/match/simulator";
import type { MatchResult } from "#/domains/match/types";
import { generateSquad } from "#/domains/player/generator";
import MatchPitchV2 from "./MatchPitchV2";

const HOME_COLOR = "#1a56db";
const AWAY_COLOR = "#e02424";

const FAKE_RESULT: MatchResult = {
		homeTeamId: "home",
		awayTeamId: "away",
		homeGoals: 2,
		awayGoals: 1,
		events: [
			{ minute: 23, type: "goal", teamId: "home", playerName: "J. Smith" },
			{
				minute: 41,
				type: "yellowCard",
				teamId: "away",
				playerName: "R. Costa",
			},
			{ minute: 67, type: "goal", teamId: "away", playerName: "M. Diaz" },
			{ minute: 82, type: "goal", teamId: "home", playerName: "T. Webb" },
	],
};

function makePlayers(isHome: boolean, seed: number) {
	const squad = generateSquad(72 + (seed % 10)).slice(0, 11);
	return squad.map((p) => ({
		id: isHome ? `h-${p.id}` : `a-${p.id}`,
		name: p.name,
	}));
}

// ─── Event log ────────────────────────────────────────────────────────────────

interface LogEntry {
	minute: number;
	text: string;
}

function EventLog({
	entries,
	phase,
	holder,
}: {
	entries: LogEntry[];
	phase: string;
	holder: string;
}) {
	return (
		<div
			style={{ fontSize: 11, display: "flex", flexDirection: "column", gap: 8 }}
		>
			<div
				style={{
					background: "rgba(255,255,255,0.06)",
					borderRadius: 8,
					padding: "8px 10px",
					display: "flex",
					flexDirection: "column",
					gap: 4,
				}}
			>
				<Row label="Phase" value={phase} highlight />
				<Row label="Ball" value={holder} />
			</div>
			<div
				style={{
					fontSize: 10,
					color: "rgba(255,255,255,0.45)",
					fontWeight: 600,
					textTransform: "uppercase",
					letterSpacing: "0.06em",
				}}
			>
				Event log
			</div>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: 2,
					maxHeight: 400,
					overflowY: "auto",
				}}
			>
				{entries.map((e, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: log entries are prepended; index is stable
						key={i}
						style={{
							display: "flex",
							gap: 8,
							padding: "3px 0",
							borderBottom: "0.5px solid rgba(255,255,255,0.07)",
							opacity: i === 0 ? 1 : Math.max(0.15, 0.6 - i * 0.01),
						}}
					>
						<span style={{ minWidth: 24, color: "rgba(255,255,255,0.4)" }}>
							{e.minute}'
						</span>
						<span>{e.text}</span>
					</div>
				))}
			</div>
		</div>
	);
}

function Row({
	label,
	value,
	highlight,
}: {
	label: string;
	value: string;
	highlight?: boolean;
}) {
	return (
		<div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
			<span style={{ color: "rgba(255,255,255,0.45)" }}>{label}</span>
			<span style={{ fontWeight: highlight ? 700 : 400 }}>{value}</span>
		</div>
	);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MatchDebugPage() {
	const [ticksPerFrame, setTicksPerFrame] = useState(1);
	const [seed, setSeed] = useState(42);
	const [key, setKey] = useState(0);
	const [showDebug, setShowDebug] = useState(true);

	const [phase, setPhase] = useState("—");
	const [holder, setHolder] = useState("—");
	const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
	const lastPhaseRef = useRef("");
	const logRef = useRef<LogEntry[]>([]);

	const handleFrame = useCallback((frame: SimFrame) => {
		if (frame.phase !== lastPhaseRef.current) {
			const entry = { minute: frame.minute, text: `→ ${frame.phase}` };
			logRef.current = [entry, ...logRef.current].slice(0, 60);
			setLogEntries([...logRef.current]);
			lastPhaseRef.current = frame.phase;
		}
		if (frame.firedEvent) {
			const ev = frame.firedEvent;
			const entry = { minute: ev.minute, text: `${ev.type}: ${ev.playerName}` };
			logRef.current = [entry, ...logRef.current].slice(0, 60);
			setLogEntries([...logRef.current]);
		}
		setPhase(frame.phase);
		const h = frame.players.find((p) => p.hasBall);
		setHolder(h ? `${h.role} · ${h.name.split(" ").at(-1)}` : "—");
	}, []);

	// Reset log state on restart/seed change
	function restart() {
		lastPhaseRef.current = "";
		logRef.current = [];
		setLogEntries([]);
		setPhase("—");
		setHolder("—");
		setKey((k) => k + 1);
	}

	const homePlayers = useMemo(() => makePlayers(true, seed), [seed]);
	const awayPlayers = useMemo(() => makePlayers(false, seed), [seed]);

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: 12,
				padding: 16,
				minHeight: "100vh",
				background: "var(--color-background-primary, #111)",
				color: "var(--color-text-primary, #fff)",
			}}
		>
			<MatchPitchV2
				key={key}
				result={FAKE_RESULT}
				homeColor={HOME_COLOR}
				awayColor={AWAY_COLOR}
				homeShortName="Home"
				awayShortName="Away"
				homePlayers={homePlayers}
				awayPlayers={awayPlayers}
				ticksPerFrame={ticksPerFrame}
				onFrame={handleFrame}
				showDebug={showDebug}
			/>

			<div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
				<div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1 }}>
					<div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
						<span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginRight: 2 }}>Speed</span>
						{[0.1, 0.25, 0.5, 1, 2, 5, 10].map((s) => (
							<button
								key={s}
								type="button"
								onClick={() => setTicksPerFrame(s)}
								style={{
									padding: "4px 10px",
									borderRadius: 6,
									border: "1px solid rgba(255,255,255,0.2)",
									background: ticksPerFrame === s ? "#fff" : "transparent",
									color: ticksPerFrame === s ? "#111" : "#fff",
									fontWeight: 700,
									fontSize: 11,
									cursor: "pointer",
								}}
							>
								{s}×
							</button>
						))}
					</div>

					<label style={{ fontSize: 12, whiteSpace: "nowrap" }}>
						Seed: {seed}
						<input
							type="range"
							min={1}
							max={200}
							value={seed}
							onChange={(e) => {
								setSeed(Number(e.target.value));
								restart();
							}}
							style={{ display: "block", width: 120, marginTop: 4 }}
						/>
					</label>

					<button
						type="button"
						onClick={() => setShowDebug((v) => !v)}
						style={{
							padding: "6px 20px",
							borderRadius: 8,
							border: "1px solid rgba(255,255,255,0.2)",
							background: showDebug ? "#fff" : "transparent",
							color: showDebug ? "#111" : "#fff",
							fontWeight: 700,
							fontSize: 13,
							cursor: "pointer",
							marginTop: 18,
						}}
					>
						Actions
					</button>

					<button
						type="button"
						onClick={restart}
						style={{
							padding: "6px 20px",
							borderRadius: 8,
							border: "none",
							background: "#fff",
							color: "#111",
							fontWeight: 700,
							fontSize: 13,
							cursor: "pointer",
							marginTop: 18,
						}}
					>
						Restart
					</button>
				</div>

				<div style={{ width: 320, flexShrink: 0 }}>
					<EventLog entries={logEntries} phase={phase} holder={holder} />
				</div>
			</div>
		</div>
	);
}
