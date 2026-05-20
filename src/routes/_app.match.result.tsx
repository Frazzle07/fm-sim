import { createFileRoute } from "@tanstack/react-router";
import MatchResultPage from "../components/MatchResultPage";

export const Route = createFileRoute("/_app/match/result")({
	validateSearch: (search: Record<string, unknown>) => ({
		fixtureId: String(search.fixtureId ?? ""),
	}),
	component: MatchResultRouteComponent,
});

function MatchResultRouteComponent() {
	const { fixtureId } = Route.useSearch();
	return <MatchResultPage fixtureId={fixtureId} />;
}
