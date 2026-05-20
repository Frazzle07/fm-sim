import { calcValue, nextId, statsFromCA } from "#/domains/player/generator";
import type { Player } from "#/domains/player/types";
import type { Team } from "./types";

type RawPlayer = {
	name: string;
	dob: string;
	position: "GK" | "DEF" | "MID" | "FWD";
	ca: number;
	pa: number;
	personality: Player["personality"];
	naturalFitness: number;
};

const SQUAD: RawPlayer[] = [
	// Goalkeepers
	{ name: "Senne Lammens",    dob: "2000-05-14", position: "GK",  ca: 118, pa: 148, personality: "Determined",         naturalFitness: 14 },
	{ name: "Altay Bayındır",   dob: "1998-04-09", position: "GK",  ca: 112, pa: 130, personality: "Average",            naturalFitness: 13 },
	{ name: "André Onana",      dob: "1996-04-02", position: "GK",  ca: 140, pa: 148, personality: "Model Professional", naturalFitness: 15 },

	// Defenders
	{ name: "Diogo Dalot",         dob: "1999-03-18", position: "DEF", ca: 144, pa: 158, personality: "Determined",         naturalFitness: 16 },
	{ name: "Noussair Mazraoui",   dob: "1997-11-14", position: "DEF", ca: 138, pa: 145, personality: "Average",            naturalFitness: 14 },
	{ name: "Matthijs de Ligt",    dob: "1999-08-12", position: "DEF", ca: 148, pa: 168, personality: "Model Professional", naturalFitness: 16 },
	{ name: "Harry Maguire",       dob: "1993-03-05", position: "DEF", ca: 128, pa: 132, personality: "Determined",         naturalFitness: 14 },
	{ name: "Lisandro Martínez",   dob: "1998-01-18", position: "DEF", ca: 152, pa: 162, personality: "Determined",         naturalFitness: 17 },
	{ name: "Patrick Dorgu",       dob: "2004-02-28", position: "DEF", ca: 125, pa: 162, personality: "Determined",         naturalFitness: 16 },
	{ name: "Leny Yoro",           dob: "2005-11-20", position: "DEF", ca: 118, pa: 178, personality: "Model Professional", naturalFitness: 15 },
	{ name: "Luke Shaw",           dob: "1995-07-12", position: "DEF", ca: 140, pa: 148, personality: "Average",            naturalFitness: 13 },
	{ name: "Tyrell Malacia",      dob: "1999-08-17", position: "DEF", ca: 108, pa: 130, personality: "Average",            naturalFitness: 13 },
	{ name: "Ayden Heaven",        dob: "2005-09-10", position: "DEF", ca: 95,  pa: 145, personality: "Determined",         naturalFitness: 15 },

	// Midfielders
	{ name: "Bruno Fernandes",  dob: "1994-09-08", position: "MID", ca: 172, pa: 178, personality: "Model Professional", naturalFitness: 17 },
	{ name: "Casemiro",         dob: "1992-02-23", position: "MID", ca: 148, pa: 155, personality: "Determined",         naturalFitness: 15 },
	{ name: "Manuel Ugarte",    dob: "2001-03-11", position: "MID", ca: 138, pa: 162, personality: "Determined",         naturalFitness: 16 },
	{ name: "Kobbie Mainoo",    dob: "2005-04-19", position: "MID", ca: 142, pa: 182, personality: "Model Professional", naturalFitness: 16 },
	{ name: "Mason Mount",      dob: "1999-01-10", position: "MID", ca: 132, pa: 152, personality: "Model Professional", naturalFitness: 14 },

	// Forwards
	{ name: "Matheus Cunha",    dob: "2000-06-27", position: "FWD", ca: 158, pa: 172, personality: "Temperamental",      naturalFitness: 16 },
	{ name: "Bryan Mbeumo",     dob: "1999-08-07", position: "FWD", ca: 158, pa: 168, personality: "Determined",         naturalFitness: 17 },
	{ name: "Benjamin Šeško",   dob: "2003-05-31", position: "FWD", ca: 152, pa: 182, personality: "Determined",         naturalFitness: 16 },
	{ name: "Amad Diallo",      dob: "2002-07-11", position: "FWD", ca: 138, pa: 168, personality: "Determined",         naturalFitness: 15 },
	{ name: "Joshua Zirkzee",   dob: "2001-05-22", position: "FWD", ca: 128, pa: 158, personality: "Average",            naturalFitness: 14 },
];

function ageOn(dob: string, currentDate: string): number {
	const birth = new Date(dob);
	const now = new Date(currentDate);
	let age = now.getFullYear() - birth.getFullYear();
	const m = now.getMonth() - birth.getMonth();
	if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
	return age;
}

export function generateManchesterUnited(
	currentDate = new Date().toISOString().slice(0, 10),
): Team {
	const players: Player[] = SQUAD.map((p) => {
		const age = ageOn(p.dob, currentDate);
		const value = calcValue(p.ca, age);
		return {
			id: nextId(),
			name: p.name,
			dateOfBirth: p.dob,
			position: p.position,
			stats: statsFromCA(p.ca, p.position),
			ca: p.ca,
			pa: p.pa,
			personality: p.personality,
			naturalFitness: p.naturalFitness,
			wage: Math.round(value / 500 / 100) * 100,
			value,
			form: 6,
			injured: false,
			injuryWeeks: 0,
			morale: 7,
		};
	});

	return {
		id: nextId(),
		name: "Manchester United",
		shortName: "MUN",
		color: "#da291c",
		players,
		budget: 50_000_000,
		reputation: 78,
	};
}
