import { createFileRoute } from "@tanstack/react-router";
import DribblePlayground from "../components/DribblePlayground";

export const Route = createFileRoute("/debug/dribble")({
	component: DribblePlayground,
});
