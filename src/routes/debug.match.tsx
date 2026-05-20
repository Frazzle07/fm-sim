import { createFileRoute } from "@tanstack/react-router";
import MatchDebugPage from "../components/MatchDebugPage";

export const Route = createFileRoute("/debug/match")({
	component: MatchDebugPage,
});
