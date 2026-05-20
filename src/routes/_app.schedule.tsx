import { createFileRoute } from "@tanstack/react-router";
import Schedule from "../components/Schedule";
import { useGame } from "../GameContext";

function SchedulePage() {
	const { game, teamMap } = useGame();
	return <Schedule game={game} teamMap={teamMap} />;
}

export const Route = createFileRoute("/_app/schedule")({
	component: SchedulePage,
});
