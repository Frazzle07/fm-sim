import { useState } from "react";
import { generateLeague } from "#/domains/team/generator";
import type { Team } from "#/domains/team/types";
import type { GameState } from "#/GameState";
import { listSaves, loadGame, type SaveMeta } from "#/persistence";

interface SetupScreenProps {
	onStart: (teams: Team[], playerTeamIndex: number) => void;
	onLoad: (state: GameState) => void;
}

export default function SetupScreen({ onStart, onLoad }: SetupScreenProps) {
	const [teams] = useState<Team[]>(generateLeague);
	const [selected, setSelected] = useState<number | null>(null);
	const [saves] = useState<(SaveMeta | null)[]>(listSaves);

	const occupiedSaves = saves.filter(Boolean) as SaveMeta[];

	const handleLoad = (slot: number) => {
		const state = loadGame(slot);
		if (state) onLoad(state);
	};

	return (
		<div
			style={{
				maxWidth: 480,
				margin: "0 auto",
				padding: "40px 16px",
				fontFamily: "var(--font-sans)",
			}}
		>
			<div style={{ marginBottom: 32, textAlign: "center" }}>
				<div style={{ fontSize: 28, fontWeight: 600, marginBottom: 6 }}>
					FM-SIM
				</div>
				<div style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
					Choose your club to begin Season 1
				</div>
			</div>

			{occupiedSaves.length > 0 && (
				<div style={{ marginBottom: 32 }}>
					<div
						style={{
							fontSize: 11,
							fontWeight: 600,
							textTransform: "uppercase",
							letterSpacing: "0.06em",
							color: "var(--color-text-secondary)",
							marginBottom: 8,
						}}
					>
						Continue saved game
					</div>
					<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
						{occupiedSaves.map((meta) => (
							<button
								type="button"
								key={meta.slot}
								onClick={() => handleLoad(meta.slot)}
								style={{
									display: "flex",
									alignItems: "center",
									gap: 12,
									padding: "12px 14px",
									border: "0.5px solid var(--color-border-tertiary)",
									borderRadius: 10,
									background: "var(--color-background-primary)",
									cursor: "pointer",
									textAlign: "left",
									width: "100%",
								}}
							>
								<div
									style={{
										width: 28,
										height: 28,
										borderRadius: "50%",
										background: meta.teamColor,
										flexShrink: 0,
									}}
								/>
								<div style={{ flex: 1 }}>
									<div style={{ fontWeight: 500, fontSize: 13 }}>
										{meta.teamName}
									</div>
									<div
										style={{
											fontSize: 11,
											color: "var(--color-text-secondary)",
										}}
									>
										Season {meta.season} · Week {meta.week}
									</div>
								</div>
								<div
									style={{ fontSize: 11, color: "var(--color-text-secondary)" }}
								>
									{new Date(meta.savedAt).toLocaleString("en-GB", {
										day: "numeric",
										month: "short",
										hour: "2-digit",
										minute: "2-digit",
									})}
								</div>
							</button>
						))}
					</div>
				</div>
			)}

			<div
				style={{
					fontSize: 11,
					fontWeight: 600,
					textTransform: "uppercase",
					letterSpacing: "0.06em",
					color: "var(--color-text-secondary)",
					marginBottom: 8,
				}}
			>
				New game
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
				{teams.map((team, i) => {
					const isSelected = selected === i;
					return (
						<button
							type="button"
							key={team.id}
							onClick={() => setSelected(i)}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 14,
								padding: "14px 16px",
								border: isSelected
									? `1.5px solid ${team.color}`
									: "0.5px solid var(--color-border-tertiary)",
								borderRadius: 10,
								background: isSelected
									? `${team.color}11`
									: "var(--color-background-primary)",
								cursor: "pointer",
								textAlign: "left",
								width: "100%",
							}}
						>
							<div
								style={{
									width: 36,
									height: 36,
									borderRadius: "50%",
									background: team.color,
									flexShrink: 0,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									color: "#fff",
									fontSize: 11,
									fontWeight: 600,
								}}
							>
								{team.shortName}
							</div>
							<div style={{ flex: 1 }}>
								<div style={{ fontWeight: 500, fontSize: 14 }}>{team.name}</div>
								<div
									style={{ fontSize: 12, color: "var(--color-text-secondary)" }}
								>
									Reputation {team.reputation} · Squad {team.players.length}{" "}
									players
								</div>
							</div>
							<div style={{ textAlign: "right" }}>
								<div
									style={{ fontSize: 12, color: "var(--color-text-secondary)" }}
								>
									Rating
								</div>
								<div
									style={{
										fontSize: 16,
										fontWeight: 600,
										color:
											team.reputation >= 75
												? "#0e9f6e"
												: team.reputation >= 65
													? "#1a56db"
													: "#6b7280",
									}}
								>
									{team.reputation}
								</div>
							</div>
						</button>
					);
				})}
			</div>

			<button
				type="button"
				onClick={() => selected !== null && onStart(teams, selected)}
				disabled={selected === null}
				style={{
					marginTop: 24,
					width: "100%",
					padding: "13px",
					fontSize: 15,
					fontWeight: 500,
					background:
						selected !== null ? "#1a56db" : "var(--color-background-secondary)",
					color: selected !== null ? "#fff" : "var(--color-text-secondary)",
					border: "none",
					borderRadius: 8,
					cursor: selected !== null ? "pointer" : "not-allowed",
				}}
			>
				{selected !== null
					? `Start with ${teams[selected].name} →`
					: "Select a club to continue"}
			</button>
		</div>
	);
}
