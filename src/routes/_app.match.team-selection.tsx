import { createFileRoute } from "@tanstack/react-router";
import TeamSelection from "../components/TeamSelection";

export const Route = createFileRoute("/_app/match/team-selection")({
	component: TeamSelection,
});
