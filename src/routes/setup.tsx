import { createFileRoute, useNavigate } from "@tanstack/react-router";
import SetupScreen from "#/components/SetupScreen";
import { useGameStore } from "#/GameProvider";
import { createNewGame } from "#/game";

export const Route = createFileRoute("/setup")({
	component: Setup,
});

function Setup() {
	const navigate = useNavigate();
	const { setGame } = useGameStore();

	return (
		<SetupScreen
			onStart={(_teams, playerTeamIndex) => {
				setGame(createNewGame(playerTeamIndex));
				navigate({ to: "/dashboard" });
			}}
			onLoad={(state) => {
				setGame(state);
				navigate({ to: "/dashboard" });
			}}
		/>
	);
}
