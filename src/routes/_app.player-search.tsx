import { createFileRoute } from "@tanstack/react-router";
import PlayerSearch from "../components/Transfers";
import { useGame } from "../GameContext";

function PlayerSearchPage() {
	const { game, onStartNegotiation } = useGame();
	return <PlayerSearch game={game} onStartNegotiation={onStartNegotiation} />;
}

export const Route = createFileRoute("/_app/player-search")({
	component: PlayerSearchPage,
});
