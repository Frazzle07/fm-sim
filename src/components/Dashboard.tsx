import type { Fixture } from "#/domains/match/types";
import type { Team } from "#/domains/team/types";
import type { GameState } from "#/GameState";
import { sortedStandings } from "#/game";
import { fmt } from "./shared";

interface DashboardProps {
	game: GameState;
	teamMap: Record<string, Team>;
}

function ordinal(n: number): string {
	if (n === 1) return "st";
	if (n === 2) return "nd";
	if (n === 3) return "rd";
	return "th";
}

export default function Dashboard({ game, teamMap }: DashboardProps) {
	const playerTeam = teamMap[game.playerTeamId];
	const sorted = sortedStandings(game.standings);
	const myStanding = sorted.find((s) => s.teamId === game.playerTeamId);
	const myPos = sorted.findIndex((s) => s.teamId === game.playerTeamId) + 1;
	const nextFixture = game.fixtures.find(
		(f) =>
			!f.played &&
			(f.homeTeamId === game.playerTeamId ||
				f.awayTeamId === game.playerTeamId),
	);

	const lastResults: Fixture[] = game.fixtures
		.filter((f) => f.played && f.week === game.week - 1)
		.sort((a, b) => {
			// player's match first
			const aIsPlayer =
				a.homeTeamId === game.playerTeamId ||
				a.awayTeamId === game.playerTeamId;
			const bIsPlayer =
				b.homeTeamId === game.playerTeamId ||
				b.awayTeamId === game.playerTeamId;
			return Number(bIsPlayer) - Number(aIsPlayer);
		});

	const statCards: [string, string][] = [
		["Week", `${game.week}`],
		["Position", `${myPos}${ordinal(myPos)} place`],
		["Points", `${myStanding?.points ?? 0} pts`],
		["Budget", fmt(playerTeam?.budget ?? 0)],
	];

	return (
		<div>
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
					gap: 12,
					marginBottom: 20,
				}}
			>
				{statCards.map(([label, val]) => (
					<div
						key={label}
						style={{
							background: "var(--color-background-secondary)",
							borderRadius: 8,
							padding: "12px 16px",
						}}
					>
						<div
							style={{
								fontSize: 12,
								color: "var(--color-text-secondary)",
								marginBottom: 4,
							}}
						>
							{label}
						</div>
						<div style={{ fontSize: 20, fontWeight: 500 }}>{val}</div>
					</div>
				))}
			</div>

			{nextFixture && (
				<div
					style={{
						border: "0.5px solid var(--color-border-tertiary)",
						borderRadius: 12,
						padding: "16px 20px",
						marginBottom: 20,
					}}
				>
					<div
						style={{
							fontSize: 12,
							color: "var(--color-text-secondary)",
							marginBottom: 8,
						}}
					>
						Next match — Week {nextFixture.week}
					</div>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 16,
							justifyContent: "center",
						}}
					>
						{[nextFixture.homeTeamId, nextFixture.awayTeamId].map((tid) => (
							<div key={tid} style={{ textAlign: "center" }}>
								<div
									style={{
										width: 12,
										height: 12,
										borderRadius: "50%",
										background: teamMap[tid]?.color,
										margin: "0 auto 4px",
									}}
								/>
								<div style={{ fontWeight: 500, fontSize: 14 }}>
									{teamMap[tid]?.name}
								</div>
							</div>
						))}
					</div>
					<div
						style={{
							textAlign: "center",
							fontSize: 18,
							color: "var(--color-text-secondary)",
							marginTop: -28,
						}}
					>
						vs
					</div>
				</div>
			)}

			{lastResults.length > 0 && (
				<div style={{ marginBottom: 20 }}>
					<div
						style={{
							fontSize: 13,
							fontWeight: 500,
							marginBottom: 10,
							color: "var(--color-text-secondary)",
						}}
					>
						Last week results
					</div>
					<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
						{lastResults.map((f) => {
							const hT = teamMap[f.homeTeamId];
							const aT = teamMap[f.awayTeamId];
							const isPlayer =
								f.homeTeamId === game.playerTeamId ||
								f.awayTeamId === game.playerTeamId;
							return (
								<div
									key={f.id}
									style={{
										display: "flex",
										alignItems: "center",
										gap: 8,
										padding: "8px 12px",
										borderRadius: 8,
										background: isPlayer
											? "var(--color-background-info)"
											: "var(--color-background-secondary)",
										fontSize: 13,
									}}
								>
									<span
										style={{
											flex: 1,
											textAlign: "right",
											fontWeight: isPlayer ? 500 : 400,
										}}
									>
										{hT?.shortName}
									</span>
									<span
										style={{
											fontWeight: 600,
											padding: "2px 10px",
											background: "var(--color-background-primary)",
											border: "0.5px solid var(--color-border-tertiary)",
											borderRadius: 6,
											minWidth: 48,
											textAlign: "center",
										}}
									>
										{f.result?.homeGoals} – {f.result?.awayGoals}
									</span>
									<span style={{ flex: 1, fontWeight: isPlayer ? 500 : 400 }}>
										{aT?.shortName}
									</span>
								</div>
							);
						})}
					</div>
				</div>
			)}

			<div style={{ marginBottom: 20 }}>
				<div
					style={{
						fontSize: 13,
						fontWeight: 500,
						marginBottom: 10,
						color: "var(--color-text-secondary)",
					}}
				>
					News
				</div>
				<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
					{game.news.slice(0, 5).map((n, i) => (
						<div
							key={i}
							style={{
								fontSize: 13,
								color: "var(--color-text-secondary)",
								padding: "6px 0",
								borderBottom: "0.5px solid var(--color-border-tertiary)",
							}}
						>
							{n}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
