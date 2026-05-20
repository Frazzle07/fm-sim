import { createFileRoute } from "@tanstack/react-router";
import LeagueTable from "../components/LeagueTable";
import { useGame } from "../GameContext";

function TablePage() {
	const { game, teamMap } = useGame();
	return <LeagueTable game={game} teamMap={teamMap} />;
}

export const Route = createFileRoute("/_app/table")({
	component: TablePage,
});
