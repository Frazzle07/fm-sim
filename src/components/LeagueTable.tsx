import type { Team } from "#/domains/team/types";
import type { GameState } from "#/GameState";
import { sortedStandings } from "#/game";

interface LeagueTableProps {
	game: GameState;
	teamMap: Record<string, Team>;
}

const headers = ["#", "Team", "P", "W", "D", "L", "GD", "Pts"];

export default function LeagueTable({ game, teamMap }: LeagueTableProps) {
	const sorted = sortedStandings(game.standings);

	return (
		<div>
			<table
				style={{
					width: "100%",
					borderCollapse: "collapse",
					fontSize: 13,
					tableLayout: "fixed",
				}}
			>
				<thead>
					<tr
						style={{
							color: "var(--color-text-secondary)",
							borderBottom: "0.5px solid var(--color-border-tertiary)",
						}}
					>
						{headers.map((h) => (
							<th
								key={h}
								style={{
									padding: "6px 4px",
									fontWeight: 500,
									textAlign: h === "Team" ? "left" : "center",
								}}
							>
								{h}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{sorted.map((s, i) => {
						const team = teamMap[s.teamId];
						const isPlayer = s.teamId === game.playerTeamId;
						const gd = s.goalsFor - s.goalsAgainst;
						return (
							<tr
								key={s.teamId}
								style={{
									borderBottom: "0.5px solid var(--color-border-tertiary)",
									background: isPlayer
										? "var(--color-background-info)"
										: "transparent",
								}}
							>
								<td
									style={{
										padding: "8px 4px",
										textAlign: "center",
										color: "var(--color-text-secondary)",
									}}
								>
									{i + 1}
								</td>
								<td style={{ padding: "8px 4px" }}>
									<div
										style={{ display: "flex", alignItems: "center", gap: 6 }}
									>
										<div
											style={{
												width: 8,
												height: 8,
												borderRadius: "50%",
												background: team?.color,
												flexShrink: 0,
											}}
										/>
										<span
											style={{
												fontWeight: isPlayer ? 500 : 400,
												whiteSpace: "nowrap",
												overflow: "hidden",
												textOverflow: "ellipsis",
											}}
										>
											{team?.name}
										</span>
									</div>
								</td>
								<td style={{ padding: "8px 4px", textAlign: "center" }}>
									{s.played}
								</td>
								<td style={{ padding: "8px 4px", textAlign: "center" }}>
									{s.won}
								</td>
								<td style={{ padding: "8px 4px", textAlign: "center" }}>
									{s.drawn}
								</td>
								<td style={{ padding: "8px 4px", textAlign: "center" }}>
									{s.lost}
								</td>
								<td
									style={{
										padding: "8px 4px",
										textAlign: "center",
										color: gd >= 0 ? "#0e9f6e" : "#e02424",
									}}
								>
									{gd > 0 ? "+" : ""}
									{gd}
								</td>
								<td
									style={{
										padding: "8px 4px",
										textAlign: "center",
										fontWeight: 600,
									}}
								>
									{s.points}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
