import { createFileRoute } from "@tanstack/react-router";
import Squad from "../components/Squad";
import { useGame } from "../GameContext";

function SquadPage() {
	const { game, onListForSale } = useGame();
	return <Squad game={game} onListForSale={onListForSale} />;
}

export const Route = createFileRoute("/_app/squad")({
	component: SquadPage,
});
