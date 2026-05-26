import { useMemo, useState } from "react";
import type { PlayerSeed } from "#/domains/match/simulator";
import type { SimFrame } from "#/domains/match/types";
import { generateSquad } from "#/domains/player/generator";
import MatchPitch from "./MatchPitch";

const HOME_COLOR = "#1a56db";
const AWAY_COLOR = "#e02424";

function makePlayers(isHome: boolean, seed: number): PlayerSeed[] {
	const squad = generateSquad(72 + (seed % 10));
	const pick = (pos: PlayerSeed["position"], n: number) =>
		squad.filter((p) => p.position === pos).slice(0, n);
	const xi = [
		...pick("GK", 1),
		...pick("DEF", 4),
		...pick("MID", 4),
		...pick("FWD", 2),
	];
	return xi.map((p) => ({
		id: isHome ? `h-${p.id}` : `a-${p.id}`,
		name: p.name,
		position: p.position,
	}));
}

export default function MatchDebugPage() {
	const [seed, setSeed] = useState(42);
	const [key, setKey] = useState(0);
	const [frame, setFrame] = useState<SimFrame | null>(null);
	const [showLanes, setShowLanes] = useState(false);
	const [showZones, setShowZones] = useState(false);

	const homePlayers = useMemo(() => makePlayers(true, seed), [seed]);
	const awayPlayers = useMemo(() => makePlayers(false, seed), [seed]);

	function restart() {
		setFrame(null);
		setKey((k) => k + 1);
	}

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
			<MatchPitch
				key={key}
				homePlayers={homePlayers}
				awayPlayers={awayPlayers}
				homeColor={HOME_COLOR}
				awayColor={AWAY_COLOR}
				showLanes={showLanes}
				showZones={showZones}
				onFrame={setFrame}
			/>

			<div style={{ display: "flex", gap: 12, alignItems: "center" }}>
				<label style={{ fontSize: 12 }}>
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
					}}
				>
					Restart
				</button>

				<button
					type="button"
					onClick={() => setShowLanes((v) => !v)}
					style={{
						padding: "6px 20px",
						borderRadius: 8,
						border: "1px solid rgba(255,255,255,0.2)",
						background: showLanes ? "rgba(60,220,100,0.2)" : "transparent",
						color: "#fff",
						fontWeight: 700,
						fontSize: 13,
						cursor: "pointer",
					}}
				>
					{showLanes ? "Lanes: on" : "Lanes: off"}
				</button>

				<button
					type="button"
					onClick={() => setShowZones((v) => !v)}
					style={{
						padding: "6px 20px",
						borderRadius: 8,
						border: "1px solid rgba(255,255,255,0.2)",
						background: showZones ? "rgba(255,160,50,0.2)" : "transparent",
						color: "#fff",
						fontWeight: 700,
						fontSize: 13,
						cursor: "pointer",
					}}
				>
					{showZones ? "Zones: on" : "Zones: off"}
				</button>

				{frame && (
					<div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
						tick {frame.tick} · {frame.players.length} players
					</div>
				)}
			</div>
		</div>
	);
}
