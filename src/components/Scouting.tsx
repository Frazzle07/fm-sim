import { useState } from "react";
import { ageFromDob } from "#/domains/player/generator";
import type { Position } from "#/domains/player/types";
import type { ScoutingAssignment } from "#/domains/scouting/types";
import type { GameState } from "#/GameState";
import { fmt, PosBadge } from "./shared";

const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];
const MAX_ASSIGNMENTS = 3;

interface ScoutingProps {
	game: GameState;
	onCreateAssignment: (
		assignment: Omit<ScoutingAssignment, "id" | "scoutedPlayers">,
	) => void;
	onCancelAssignment: (id: string) => void;
}

function EmptySlot({
	onCreate,
}: {
	onCreate: (a: Omit<ScoutingAssignment, "id" | "scoutedPlayers">) => void;
}) {
	const [open, setOpen] = useState(false);
	const [position, setPosition] = useState<Position | "">("");
	const [minAge, setMinAge] = useState("");
	const [maxAge, setMaxAge] = useState("");
	const [maxWage, setMaxWage] = useState("");

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		onCreate({
			position: (position as Position) || null,
			minAge: minAge ? Number(minAge) : null,
			maxAge: maxAge ? Number(maxAge) : null,
			maxWage: maxWage ? Number(maxWage) * 1000 : null,
		});
		setOpen(false);
		setPosition("");
		setMinAge("");
		setMaxAge("");
		setMaxWage("");
	}

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				style={{
					width: "100%",
					padding: "14px 16px",
					border: "1px dashed var(--color-border-secondary)",
					borderRadius: 10,
					background: "transparent",
					color: "var(--color-text-secondary)",
					fontSize: 13,
					cursor: "pointer",
					textAlign: "left",
				}}
			>
				+ New assignment
			</button>
		);
	}

	return (
		<form
			onSubmit={handleSubmit}
			style={{
				padding: "14px 16px",
				border: "0.5px solid var(--color-border-secondary)",
				borderRadius: 10,
				background: "var(--color-background-primary)",
				display: "flex",
				flexDirection: "column",
				gap: 10,
			}}
		>
			<div style={{ fontWeight: 500, fontSize: 13 }}>New assignment</div>

			<label style={labelStyle}>
				<span style={labelTextStyle}>Position</span>
				<select
					value={position}
					onChange={(e) => setPosition(e.target.value as Position | "")}
					style={inputStyle}
				>
					<option value="">Any</option>
					{POSITIONS.map((p) => (
						<option key={p} value={p}>
							{p}
						</option>
					))}
				</select>
			</label>

			<div style={{ display: "flex", gap: 8 }}>
				<label style={{ ...labelStyle, flex: 1 }}>
					<span style={labelTextStyle}>Min age</span>
					<input
						type="number"
						min={15}
						max={45}
						placeholder="—"
						value={minAge}
						onChange={(e) => setMinAge(e.target.value)}
						style={inputStyle}
					/>
				</label>
				<label style={{ ...labelStyle, flex: 1 }}>
					<span style={labelTextStyle}>Max age</span>
					<input
						type="number"
						min={15}
						max={45}
						placeholder="—"
						value={maxAge}
						onChange={(e) => setMaxAge(e.target.value)}
						style={inputStyle}
					/>
				</label>
			</div>

			<label style={labelStyle}>
				<span style={labelTextStyle}>Max wage (£k/wk)</span>
				<input
					type="number"
					min={1}
					placeholder="—"
					value={maxWage}
					onChange={(e) => setMaxWage(e.target.value)}
					style={inputStyle}
				/>
			</label>

			<div style={{ display: "flex", gap: 8, marginTop: 2 }}>
				<button type="submit" style={primaryBtnStyle}>
					Start scouting
				</button>
				<button
					type="button"
					onClick={() => setOpen(false)}
					style={secondaryBtnStyle}
				>
					Cancel
				</button>
			</div>
		</form>
	);
}

function assignmentLabel(a: ScoutingAssignment): string {
	const parts: string[] = [];
	if (a.position) parts.push(a.position);
	else parts.push("Any position");
	if (a.minAge !== null && a.maxAge !== null)
		parts.push(`Age ${a.minAge}–${a.maxAge}`);
	else if (a.minAge !== null) parts.push(`Age ${a.minAge}+`);
	else if (a.maxAge !== null) parts.push(`Age ≤${a.maxAge}`);
	if (a.maxWage !== null) parts.push(`≤${fmt(a.maxWage)}/wk`);
	return parts.join(" · ");
}

export default function Scouting({
	game,
	onCreateAssignment,
	onCancelAssignment,
}: ScoutingProps) {
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const assignments = game.scoutingAssignments;
	const selected =
		assignments.find((a) => a.id === selectedId) ?? assignments[0] ?? null;

	// Build a player lookup across all teams
	const playerMap = Object.fromEntries(
		game.teams.flatMap((t) =>
			t.players.map((p) => [p.id, { player: p, team: t }]),
		),
	);

	const emptySlots = MAX_ASSIGNMENTS - assignments.length;

	return (
		<div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
			{/* Left column: assignment list */}
			<div
				style={{
					width: 220,
					flexShrink: 0,
					display: "flex",
					flexDirection: "column",
					gap: 8,
				}}
			>
				{assignments.map((a) => {
					const isActive = (selected?.id ?? null) === a.id;
					return (
						<div
							key={a.id}
							style={{
								padding: "12px 14px",
								borderRadius: 10,
								border: `0.5px solid ${isActive ? "var(--color-text-primary)" : "var(--color-border-tertiary)"}`,
								background: isActive
									? "var(--color-background-secondary)"
									: "var(--color-background-primary)",
							}}
						>
							<button
								type="button"
								onClick={() => setSelectedId(a.id)}
								style={{
									display: "block",
									width: "100%",
									textAlign: "left",
									background: "none",
									border: "none",
									padding: 0,
									cursor: "pointer",
									marginBottom: 8,
								}}
							>
								<div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>
									{a.position ?? "Any position"}
								</div>
								<div
									style={{
										fontSize: 11,
										color: "var(--color-text-secondary)",
									}}
								>
									{a.scoutedPlayers.length} player
									{a.scoutedPlayers.length !== 1 ? "s" : ""} found
								</div>
							</button>
							<button
								type="button"
								onClick={() => {
									onCancelAssignment(a.id);
									if (selectedId === a.id) setSelectedId(null);
								}}
								style={{
									fontSize: 11,
									color: "var(--color-text-secondary)",
									background: "none",
									border: "none",
									padding: 0,
									cursor: "pointer",
									textDecoration: "underline",
								}}
							>
								Cancel
							</button>
						</div>
					);
				})}

				{Array.from({ length: emptySlots }, (_, i) => (
					<EmptySlot
						// biome-ignore lint/suspicious/noArrayIndexKey: slots are positional
						key={`empty-${i}`}
						onCreate={onCreateAssignment}
					/>
				))}
			</div>

			{/* Right column: report */}
			<div style={{ flex: 1, minWidth: 0 }}>
				{selected === null ? (
					<div
						style={{
							padding: "40px 0",
							textAlign: "center",
							color: "var(--color-text-secondary)",
							fontSize: 14,
						}}
					>
						Create an assignment to start scouting.
					</div>
				) : (
					<>
						<div style={{ marginBottom: 12 }}>
							<div style={{ fontWeight: 600, fontSize: 15 }}>
								{assignmentLabel(selected)}
							</div>
							<div
								style={{ fontSize: 12, color: "var(--color-text-secondary)" }}
							>
								{selected.scoutedPlayers.length === 0
									? "No players discovered yet — advance the day to let your scout attend fixtures."
									: `${selected.scoutedPlayers.length} player${selected.scoutedPlayers.length !== 1 ? "s" : ""} discovered`}
							</div>
						</div>

						{selected.scoutedPlayers.length > 0 && (
							<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
								<div
									style={{
										display: "grid",
										gridTemplateColumns: "1fr 48px 48px 80px 80px 60px",
										gap: 8,
										padding: "4px 14px",
										fontSize: 11,
										color: "var(--color-text-secondary)",
										fontWeight: 500,
									}}
								>
									<span>Player</span>
									<span>Age</span>
									<span>Seen</span>
									<span>Wage</span>
									<span style={{ textAlign: "right" }}>PA estimate</span>
									<span />
								</div>

								{selected.scoutedPlayers.map((sp) => {
									const entry = playerMap[sp.playerId];
									if (!entry) return null;
									const { player, team } = entry;
									const age = ageFromDob(player.dateOfBirth, game.currentDate);
									return (
										<div
											key={sp.playerId}
											style={{
												display: "grid",
												gridTemplateColumns: "1fr 48px 48px 80px 80px 60px",
												gap: 8,
												alignItems: "center",
												padding: "10px 14px",
												border: "0.5px solid var(--color-border-tertiary)",
												borderRadius: 10,
												background: "var(--color-background-primary)",
												fontSize: 13,
											}}
										>
											<div>
												<div style={{ fontWeight: 500 }}>{player.name}</div>
												<div
													style={{
														fontSize: 11,
														color: "var(--color-text-secondary)",
														display: "flex",
														alignItems: "center",
														gap: 4,
														marginTop: 1,
													}}
												>
													<PosBadge pos={player.position} />
													{team.shortName}
												</div>
											</div>
											<span>{age}</span>
											<span
												style={{
													color: "var(--color-text-secondary)",
												}}
											>
												{sp.sightings}×
											</span>
											<span>{fmt(player.wage)}/wk</span>
											<span
												style={{
													textAlign: "right",
													fontVariantNumeric: "tabular-nums",
												}}
											>
												{sp.paEstimateLow}–{sp.paEstimateHigh}
											</span>
											<span />
										</div>
									);
								})}
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}

const labelStyle: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 4,
};

const labelTextStyle: React.CSSProperties = {
	fontSize: 11,
	color: "var(--color-text-secondary)",
	fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
	padding: "5px 8px",
	borderRadius: 6,
	border: "0.5px solid var(--color-border-secondary)",
	background: "var(--color-background-primary)",
	fontSize: 13,
	color: "var(--color-text-primary)",
	width: "100%",
};

const primaryBtnStyle: React.CSSProperties = {
	padding: "5px 12px",
	background: "#1a56db",
	color: "#fff",
	border: "none",
	borderRadius: 6,
	cursor: "pointer",
	fontSize: 12,
	fontWeight: 500,
};

const secondaryBtnStyle: React.CSSProperties = {
	padding: "5px 12px",
	border: "0.5px solid var(--color-border-secondary)",
	borderRadius: 6,
	cursor: "pointer",
	fontSize: 12,
	background: "transparent",
	color: "var(--color-text-primary)",
};
