import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import FootballManager from "../FootballManager";

export const Route = createFileRoute("/_app")({
	component: FootballManager,
});
