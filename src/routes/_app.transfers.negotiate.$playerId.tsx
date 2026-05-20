import { createFileRoute } from "@tanstack/react-router";
import NegotiationThread from "../components/NegotiationThread";
import { useGame } from "../GameContext";

function NegotiationPage() {
	const { playerId } = Route.useParams();
	const { game, onSubmitOffer, onAcceptCounter, onWalkAway } = useGame();
	return (
		<NegotiationThread
			game={game}
			playerId={playerId}
			onSubmitOffer={onSubmitOffer}
			onAcceptCounter={onAcceptCounter}
			onWalkAway={onWalkAway}
		/>
	);
}

export const Route = createFileRoute("/_app/transfers/negotiate/$playerId")({
	component: NegotiationPage,
});
