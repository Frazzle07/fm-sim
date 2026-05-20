import { createFileRoute } from "@tanstack/react-router";
import TransferCentre from "../components/TransferCentre";
import { useGame } from "../GameContext";

function TransferCentrePage() {
	const { game, onWalkAway } = useGame();
	return <TransferCentre game={game} onWalkAway={onWalkAway} />;
}

export const Route = createFileRoute("/_app/transfers/")({
	component: TransferCentrePage,
});
