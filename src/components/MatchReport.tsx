import type { Fixture, MatchEventType } from "#/domains/match/types";
import type { Team } from "#/domains/team/types";

interface MatchReportProps {
	fixture: Fixture;
	teamMap: Record<string, Team>;
}

const eventIcon: Record<MatchEventType, string> = {
	goal: "⚽",
	yellowCard: "🟨",
	redCard: "🟥",
	substitution: "🔄",
	save: "🧤",
	injury: "🤕",
};

export default function MatchReport({ fixture, teamMap }: MatchReportProps) {
	if (!fixture.result) return null;
	const hT = teamMap[fixture.homeTeamId];
	const aT = teamMap[fixture.awayTeamId];
	const { homeGoals, awayGoals, events } = fixture.result;
	const winner = homeGoals > awayGoals ? hT : awayGoals > homeGoals ? aT : null;

	return (
		<div>
			<div style={{ textAlign: "center", padding: "20px 0 24px" }}>
				<div
					style={{
						fontSize: 12,
						color: "var(--color-text-secondary)",
						marginBottom: 12,
					}}
				>
					Full time
				</div>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						gap: 20,
					}}
				>
					<div style={{ textAlign: "center" }}>
						<div
							style={{
								width: 14,
								height: 14,
								borderRadius: "50%",
								background: hT?.color,
								margin: "0 auto 6px",
							}}
						/>
						<div style={{ fontWeight: 500 }}>{hT?.shortName}</div>
					</div>
					<div style={{ fontSize: 36, fontWeight: 600, padding: "0 16px" }}>
						{homeGoals} – {awayGoals}
					</div>
					<div style={{ textAlign: "center" }}>
						<div
							style={{
								width: 14,
								height: 14,
								borderRadius: "50%",
								background: aT?.color,
								margin: "0 auto 6px",
							}}
						/>
						<div style={{ fontWeight: 500 }}>{aT?.shortName}</div>
					</div>
				</div>
				{winner && (
					<div
						style={{
							marginTop: 10,
							fontSize: 13,
							color: "var(--color-text-secondary)",
						}}
					>
						{winner.name} win!
					</div>
				)}
			</div>

			<div
				style={{
					borderTop: "0.5px solid var(--color-border-tertiary)",
					paddingTop: 16,
				}}
			>
				{events.map((e, i) => {
					const isHome = e.teamId === fixture.homeTeamId;
					return (
						<div
							key={i}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 8,
								padding: "6px 0",
								borderBottom: "0.5px solid var(--color-border-tertiary)",
								justifyContent: isHome ? "flex-start" : "flex-end",
								fontSize: 13,
							}}
						>
							{isHome ? (
								<>
									<span
										style={{
											color: "var(--color-text-secondary)",
											minWidth: 28,
										}}
									>
										{e.minute}'
									</span>
									<span>{eventIcon[e.type]}</span>
									<span>{e.playerName}</span>
								</>
							) : (
								<>
									<span>{e.playerName}</span>
									<span>{eventIcon[e.type]}</span>
									<span
										style={{
											color: "var(--color-text-secondary)",
											minWidth: 28,
											textAlign: "right",
										}}
									>
										{e.minute}'
									</span>
								</>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
