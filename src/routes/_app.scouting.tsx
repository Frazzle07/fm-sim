import { createFileRoute } from "@tanstack/react-router";
import Scouting from "../components/Scouting";
import { useGame } from "../GameContext";

function ScoutingPage() {
	const { game, onCreateAssignment, onCancelAssignment } = useGame();
	return (
		<Scouting
			game={game}
			onCreateAssignment={onCreateAssignment}
			onCancelAssignment={onCancelAssignment}
		/>
	);
}

export const Route = createFileRoute("/_app/scouting")({
	component: ScoutingPage,
});
