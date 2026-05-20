import type { Team } from "#/domains/team/types";
import type { GameState } from "#/GameState";

interface ScheduleProps {
	game: GameState;
	teamMap: Record<string, Team>;
}

function formatDate(iso: string) {
	return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
		weekday: "short",
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
}

export default function Schedule({ game, teamMap }: ScheduleProps) {
	const playerFixtures = game.fixtures
		.filter(
			(f) =>
				f.homeTeamId === game.playerTeamId ||
				f.awayTeamId === game.playerTeamId,
		)
		.sort((a, b) => a.week - b.week);

	const weeks = Array.from(new Set(playerFixtures.map((f) => f.week)));

	return (
		<div>
			{weeks.map((week) => {
				const fixture = playerFixtures.find((f) => f.week === week)!;
				const isHome = fixture.homeTeamId === game.playerTeamId;
				const opponent =
					teamMap[isHome ? fixture.awayTeamId : fixture.homeTeamId];
				const isPast = fixture.played;
				const isCurrent = !fixture.played && week === game.week;

				let resultLabel: string | null = null;
				let resultColor = "inherit";
				if (isPast && fixture.result) {
					const playerGoals = isHome
						? fixture.result.homeGoals
						: fixture.result.awayGoals;
					const oppGoals = isHome
						? fixture.result.awayGoals
						: fixture.result.homeGoals;
					if (playerGoals > oppGoals) {
						resultLabel = `W ${playerGoals}–${oppGoals}`;
						resultColor = "#0e9f6e";
					} else if (playerGoals < oppGoals) {
						resultLabel = `L ${playerGoals}–${oppGoals}`;
						resultColor = "#e02424";
					} else {
						resultLabel = `D ${playerGoals}–${oppGoals}`;
						resultColor = "#6b7280";
					}
				}

				return (
					<div
						key={fixture.id}
						style={{
							display: "flex",
							alignItems: "center",
							padding: "10px 0",
							borderBottom: "0.5px solid var(--color-border-tertiary)",
							gap: 12,
							opacity: isPast ? 0.6 : 1,
						}}
					>
						<div
							style={{
								width: 28,
								textAlign: "center",
								flexShrink: 0,
								fontSize: 11,
								fontWeight: 500,
								color: isCurrent
									? "var(--color-primary)"
									: "var(--color-text-secondary)",
							}}
						>
							{isCurrent ? "►" : `W${week}`}
						</div>

						<div style={{ flex: 1, minWidth: 0 }}>
							<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
								<div
									style={{
										width: 8,
										height: 8,
										borderRadius: "50%",
										background: opponent?.color,
										flexShrink: 0,
									}}
								/>
								<span
									style={{
										fontSize: 13,
										fontWeight: isCurrent ? 600 : 400,
										whiteSpace: "nowrap",
										overflow: "hidden",
										textOverflow: "ellipsis",
									}}
								>
									{isHome ? "vs" : "@"} {opponent?.name}
								</span>
							</div>
							<div
								style={{
									fontSize: 11,
									color: "var(--color-text-secondary)",
									marginTop: 1,
								}}
							>
								{formatDate(fixture.date)} · {isHome ? "Home" : "Away"}
							</div>
						</div>

						<div
							style={{
								fontSize: 12,
								fontWeight: 600,
								color: resultColor,
								flexShrink: 0,
								minWidth: 50,
								textAlign: "right",
							}}
						>
							{resultLabel ?? (isCurrent ? "Next up" : "–")}
						</div>
					</div>
				);
			})}
		</div>
	);
}
