import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Player, Position } from "#/domains/player/types";
import { useGame } from "../GameContext";
import { FormDots, PosBadge } from "./shared";

const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];
const REQUIRED: Record<Position, number> = { GK: 1, DEF: 4, MID: 4, FWD: 2 };

const POS_COLOR: Record<Position, string> = {
	GK: "#9061f9",
	DEF: "#0e9f6e",
	MID: "#1a56db",
	FWD: "#e02424",
};

function posCount(players: Player[], pos: Position) {
	return players.filter((p) => p.position === pos).length;
}

function isValidLineup(players: Player[]) {
	if (players.length !== 11) return false;
	return POSITIONS.every((pos) => posCount(players, pos) >= REQUIRED[pos]);
}

// Pitch rows from top (attack) to bottom (keeper)
const PITCH_ROWS: Position[] = ["FWD", "MID", "DEF", "GK"];

function PitchView({
	selected,
	onRemove,
	teamColor,
}: {
	selected: Player[];
	onRemove: (player: Player) => void;
	teamColor: string;
}) {
	return (
		<div
			style={{
				position: "relative",
				width: "100%",
				aspectRatio: "2/3",
				background: "#1a6b2f",
				borderRadius: 10,
				overflow: "hidden",
				border: "1px solid #145523",
			}}
		>
			{/* Pitch markings */}
			<PitchMarkings />

			{/* Players arranged by row */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					display: "flex",
					flexDirection: "column",
					justifyContent: "space-evenly",
					padding: "16px 8px",
				}}
			>
				{PITCH_ROWS.map((pos) => {
					const rowPlayers = selected.filter((p) => p.position === pos);
					return (
						<div
							key={pos}
							style={{
								display: "flex",
								justifyContent: "space-evenly",
								gap: 0,
								flexWrap: "wrap",
							}}
						>
							{rowPlayers.map((player) => (
								<PitchPlayer
									key={player.id}
									player={player}
									color={teamColor}
									onRemove={onRemove}
								/>
							))}
							{/* Empty slots */}
							{Array.from({
								length: Math.max(0, REQUIRED[pos] - rowPlayers.length),
							}).map((_, i) => (
								<EmptySlot
									// biome-ignore lint/suspicious/noArrayIndexKey: positional empty slots
									key={i}
									pos={pos}
								/>
							))}
						</div>
					);
				})}
			</div>
		</div>
	);
}

function PitchMarkings() {
	return (
		<>
			{/* Centre circle */}
			<div
				style={{
					position: "absolute",
					top: "50%",
					left: "50%",
					transform: "translate(-50%, -50%)",
					width: "30%",
					aspectRatio: "1",
					borderRadius: "50%",
					border: "1px solid rgba(255,255,255,0.15)",
				}}
			/>
			{/* Halfway line */}
			<div
				style={{
					position: "absolute",
					top: "50%",
					left: "5%",
					right: "5%",
					height: 1,
					background: "rgba(255,255,255,0.15)",
				}}
			/>
			{/* Penalty areas */}
			<div
				style={{
					position: "absolute",
					top: "5%",
					left: "20%",
					right: "20%",
					height: "18%",
					border: "1px solid rgba(255,255,255,0.15)",
					borderTop: "none",
				}}
			/>
			<div
				style={{
					position: "absolute",
					bottom: "5%",
					left: "20%",
					right: "20%",
					height: "18%",
					border: "1px solid rgba(255,255,255,0.15)",
					borderBottom: "none",
				}}
			/>
		</>
	);
}

function PitchPlayer({
	player,
	color,
	onRemove,
}: { player: Player; color: string; onRemove: (p: Player) => void }) {
	const [hovered, setHovered] = useState(false);
	const lastName = player.name.split(" ").slice(-1)[0];
	return (
		<button
			type="button"
			onClick={() => onRemove(player)}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			title={`${player.name} — click to remove`}
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: 3,
				background: "none",
				border: "none",
				cursor: "pointer",
				padding: 2,
				opacity: hovered ? 0.7 : 1,
				transition: "opacity 0.1s",
			}}
		>
			<div
				style={{
					width: 38,
					height: 38,
					borderRadius: "50%",
					background: color,
					border: "2px solid rgba(255,255,255,0.85)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontSize: 11,
					fontWeight: 700,
					color: "#fff",
				}}
			>
				{player.ca}
			</div>
			<div
				style={{
					fontSize: 10,
					color: "#fff",
					fontWeight: 600,
					textShadow: "0 1px 2px rgba(0,0,0,0.8)",
					maxWidth: 52,
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
					textAlign: "center",
				}}
			>
				{lastName}
			</div>
		</button>
	);
}

function EmptySlot({ pos }: { pos: Position }) {
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: 3,
				padding: 2,
			}}
		>
			<div
				style={{
					width: 38,
					height: 38,
					borderRadius: "50%",
					border: `2px dashed ${POS_COLOR[pos]}88`,
					background: "rgba(0,0,0,0.2)",
				}}
			/>
			<div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>
				{pos}
			</div>
		</div>
	);
}

export default function TeamSelection() {
	const { game, onConfirmLineup, setPendingAction } = useGame();
	const navigate = useNavigate();

	const playerTeam = game.teams.find((t) => t.id === game.playerTeamId);
	const fixture = game.fixtures.find((f) => f.id === game.pendingFixtureId);
	const opponentId =
		fixture?.homeTeamId === game.playerTeamId
			? fixture?.awayTeamId
			: fixture?.homeTeamId;
	const opponent = game.teams.find((t) => t.id === opponentId);
	const isHome = fixture?.homeTeamId === game.playerTeamId;

	const available = (playerTeam?.players ?? [])
		.filter((p) => !p.injured)
		.sort((a, b) => {
			const posOrder =
				POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position);
			return posOrder !== 0 ? posOrder : b.ca - a.ca;
		});

	const [selected, setSelected] = useState<Player[]>(() => {
		const picks: Player[] = [];
		for (const pos of POSITIONS) {
			const candidates = available
				.filter((p) => p.position === pos)
				.slice(0, REQUIRED[pos]);
			picks.push(...candidates);
		}
		return picks;
	});

	const valid = isValidLineup(selected);

	useEffect(() => {
		if (!fixture || !playerTeam) return;
		setPendingAction({
			label: valid ? "Confirm lineup →" : "Pick your team",
			disabled: !valid,
			onConfirm: () => {
				onConfirmLineup(selected);
				navigate({ to: "/match/result", search: { fixtureId: fixture.id } });
			},
		});
		return () => setPendingAction(null);
	}, [
		selected,
		valid,
		fixture,
		playerTeam,
		onConfirmLineup,
		setPendingAction,
		navigate,
	]);

	function toggle(player: Player) {
		const isSelected = selected.some((p) => p.id === player.id);
		if (isSelected) {
			setSelected(selected.filter((p) => p.id !== player.id));
		} else if (selected.length < 11) {
			setSelected([...selected, player]);
		}
	}

	const counts = Object.fromEntries(
		POSITIONS.map((pos) => [pos, posCount(selected, pos)]),
	) as Record<Position, number>;

	if (!fixture || !playerTeam || !opponent) return null;

	// Player list: selected first, then unselected, within each group sorted by position then CA
	const selectedIds = new Set(selected.map((p) => p.id));
	const listPlayers = [
		...available.filter((p) => selectedIds.has(p.id)),
		...available.filter((p) => !selectedIds.has(p.id)),
	];

	return (
		<div>
			{/* Match header */}
			<div
				style={{
					border: "0.5px solid var(--color-border-tertiary)",
					borderRadius: 12,
					padding: "16px 20px",
					marginBottom: 16,
					textAlign: "center",
				}}
			>
				<div
					style={{
						fontSize: 11,
						color: "var(--color-text-secondary)",
						marginBottom: 10,
						textTransform: "uppercase",
						letterSpacing: "0.05em",
					}}
				>
					Week {fixture.week} · {isHome ? "Home" : "Away"}
				</div>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						gap: 24,
					}}
				>
					<div style={{ textAlign: "center" }}>
						<div
							style={{
								width: 14,
								height: 14,
								borderRadius: "50%",
								background: isHome ? playerTeam.color : opponent.color,
								margin: "0 auto 6px",
							}}
						/>
						<div style={{ fontWeight: 600, fontSize: 15 }}>
							{isHome ? playerTeam.shortName : opponent.shortName}
						</div>
					</div>
					<div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
						vs
					</div>
					<div style={{ textAlign: "center" }}>
						<div
							style={{
								width: 14,
								height: 14,
								borderRadius: "50%",
								background: isHome ? opponent.color : playerTeam.color,
								margin: "0 auto 6px",
							}}
						/>
						<div style={{ fontWeight: 600, fontSize: 15 }}>
							{isHome ? opponent.shortName : playerTeam.shortName}
						</div>
					</div>
				</div>
			</div>

			{/* Two-column layout */}
			<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
				{/* Left: Pitch — sticky so it stays in view while right side scrolls */}
				<div style={{ position: "sticky", top: 16 }}>
					<PitchView
						selected={selected}
						onRemove={toggle}
						teamColor={playerTeam.color}
					/>
				</div>

				{/* Right: Player list */}
				<div>
					{/* Status bar */}
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							marginBottom: 8,
						}}
					>
						<div style={{ fontSize: 13, fontWeight: 600 }}>
							Starting 11
						</div>
						<div style={{ display: "flex", gap: 8, fontSize: 11, color: "var(--color-text-secondary)" }}>
							{POSITIONS.map((pos) => (
								<span
									key={pos}
									style={{
										color:
											counts[pos] < REQUIRED[pos]
												? "var(--color-text-secondary)"
												: counts[pos] > REQUIRED[pos]
													? "#e02424"
													: "#0e9f6e",
									}}
								>
									{pos} {counts[pos]}/{REQUIRED[pos]}
								</span>
							))}
							<span
								style={{
									fontWeight: 600,
									color: valid ? "#0e9f6e" : "var(--color-text-secondary)",
								}}
							>
								{selected.length}/11
							</span>
						</div>
					</div>

					{!valid && selected.length === 11 && (
						<div style={{ fontSize: 11, color: "#e02424", marginBottom: 8 }}>
							Need at least 1 GK, 4 DEF, 4 MID, 2 FWD
						</div>
					)}

					{/* Scrollable player list */}
					<div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
						{listPlayers.map((player, i) => {
							const isSelected = selectedIds.has(player.id);
							const prevIsSelected = i > 0 && selectedIds.has(listPlayers[i - 1].id);
							const showDivider = !isSelected && (i === 0 || prevIsSelected);
							return (
								<div key={player.id}>
									{showDivider && i > 0 && (
										<div
											style={{
												fontSize: 10,
												fontWeight: 600,
												color: "var(--color-text-secondary)",
												textTransform: "uppercase",
												letterSpacing: "0.05em",
												padding: "6px 0 3px",
												borderTop: "0.5px solid var(--color-border-tertiary)",
												marginTop: 3,
											}}
										>
											Bench
										</div>
									)}
									<button
										type="button"
										onClick={() => toggle(player)}
										style={{
											display: "flex",
											alignItems: "center",
											gap: 8,
											padding: "10px 12px",
											border: isSelected
												? "0.5px solid var(--color-border-secondary)"
												: "0.5px solid var(--color-border-tertiary)",
											borderRadius: 8,
											background: isSelected
												? "var(--color-background-secondary)"
												: "var(--color-background-primary)",
											cursor: "pointer",
											width: "100%",
											textAlign: "left",
											opacity: !isSelected && selected.length >= 11 ? 0.45 : 1,
										}}
									>
										<PosBadge pos={player.position} />
										<div style={{ flex: 1, minWidth: 0 }}>
											<div
												style={{
													fontWeight: 500,
													fontSize: 13,
													whiteSpace: "nowrap",
													overflow: "hidden",
													textOverflow: "ellipsis",
												}}
											>
												{player.name}
											</div>
										</div>
										<FormDots form={player.form} />
										<span
											style={{
												fontSize: 11,
												fontWeight: 600,
												color: isSelected ? "#0e9f6e" : "transparent",
												minWidth: 14,
												textAlign: "right",
											}}
										>
											✓
										</span>
									</button>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}
