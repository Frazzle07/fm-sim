import { generateSquad } from "#/domains/player/generator";
import { generateManchesterUnited } from "./manchesterUnited";
import type { Team } from "./types";

function rand(min: number, max: number) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

let _id = 1;
function nextId() {
	return String(_id++);
}

const teamData = [
	{ name: "Northgate City",    short: "NCY", color: "#1a56db", quality: 80 },
	{ name: "Ashton Athletic",   short: "ASH", color: "#ff6b00", quality: 74 },
	{ name: "Westbrook FC",      short: "WBK", color: "#0e9f6e", quality: 72 },
	{ name: "Millhaven Town",    short: "MLH", color: "#9061f9", quality: 70 },
	{ name: "Crestwood Rangers", short: "CRW", color: "#e74694", quality: 68 },
	{ name: "Ironbridge SC",     short: "IRB", color: "#6b7280", quality: 65 },
	{ name: "Lakeside FC",       short: "LAK", color: "#0891b2", quality: 63 },
];

export function generateLeague(): Team[] {
	const fictionalTeams: Team[] = teamData.map((t) => ({
		id: nextId(),
		name: t.name,
		shortName: t.short,
		color: t.color,
		players: generateSquad(t.quality),
		budget: rand(5, 25) * 1_000_000,
		reputation: t.quality,
	}));

	const manutd = generateManchesterUnited();
	// Insert Man United at index 1 (second-strongest slot, replacing Redfield United)
	fictionalTeams.splice(1, 0, manutd);
	return fictionalTeams;
}
