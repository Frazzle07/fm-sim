import { createFileRoute } from "@tanstack/react-router";
import PassPlayground from "../components/PassPlayground";

export const Route = createFileRoute("/debug/pass")({
	component: PassPlayground,
});
