import type {
	GKStats,
	Personality,
	Player,
	PlayerStats,
	Position,
} from "./types";

const firstNames = [
	"James",
	"Marcus",
	"Liam",
	"Oliver",
	"Noah",
	"Harry",
	"Jack",
	"George",
	"Charlie",
	"Thomas",
	"Kai",
	"Jude",
	"Mason",
	"Ethan",
	"Lucas",
	"Finn",
	"Rory",
	"Theo",
	"Carlos",
	"Diego",
	"Mateo",
	"Luis",
	"Pedro",
	"Rafael",
	"Bruno",
	"Tomas",
	"Ivan",
	"Alexei",
];

const lastNames = [
	"Smith",
	"Johnson",
	"Williams",
	"Brown",
	"Jones",
	"Garcia",
	"Martinez",
	"Davis",
	"Wilson",
	"Moore",
	"Taylor",
	"Anderson",
	"Thomas",
	"Jackson",
	"White",
	"Harris",
	"Silva",
	"Costa",
	"Santos",
	"Oliveira",
	"Müller",
	"Schmidt",
	"Weber",
	"Meyer",
	"Sanchez",
	"Romero",
	"Torres",
	"Ramirez",
	"Fernandez",
	"Lopez",
	"Gonzalez",
	"Hernandez",
];

const PERSONALITIES: Personality[] = [
	"Model Professional",
	"Determined",
	"Average",
	"Lazy",
	"Temperamental",
];

function rand(min: number, max: number) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

let _id = 1;
export function nextId() {
	return String(_id++);
}

export function ageFromDob(dob: string, currentDate: string): number {
	const birth = new Date(dob);
	const now = new Date(currentDate);
	let age = now.getFullYear() - birth.getFullYear();
	const monthDiff = now.getMonth() - birth.getMonth();
	if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate()))
		age--;
	return age;
}

function dobForAge(targetAge: number, currentDate: string): string {
	const now = new Date(currentDate);
	const birthYear = now.getFullYear() - targetAge;
	const month = rand(1, 12);
	const day = rand(1, 28);
	return `${birthYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function ageRatio(age: number): number {
	// scales from ~0.4 at 17 to ~0.95 at 34
	return Math.min(0.95, 0.4 + ((age - 17) * 0.55) / 17);
}

// Converts a CA (1–200) + weight (0–1) + jitter into a 1–20 attribute value.
function attr(ca: number, weight: number, jitter = 2): number {
	const base = (ca / 200) * 20 * weight;
	return Math.min(20, Math.max(1, Math.round(base + rand(-jitter, jitter))));
}

export function statsFromCA(
	ca: number,
	position: Position,
): PlayerStats | GKStats {
	if (position === "GK") {
		return {
			reflexes:      attr(ca, 1.0),
			handling:      attr(ca, 0.9),
			positioning:   attr(ca, 0.95),
			kicking:       attr(ca, 0.6),
			aerial:        attr(ca, 0.75),
			composure:     attr(ca, 0.7),
			decisions:     attr(ca, 0.75),
			determination: attr(ca, 0.65),
			pace:          attr(ca, 0.45),
			stamina:       attr(ca, 0.6),
			strength:      attr(ca, 0.55),
		};
	}

	// Weights relative to CA: 1.0 = scales linearly (CA 200 → attr 20).
	// Primary attrs for a position peak near 1.0; weak attrs are 0.3–0.5.
	const w: Record<Position, Record<string, number>> = {
		FWD: {
			finishing:     1.0,
			longShots:     0.8,
			offTheBall:    0.9,
			passing:       0.65,
			dribbling:     0.85,
			firstTouch:    0.8,
			technique:     0.75,
			tackling:      0.35,
			marking:       0.3,
			positioning:   0.6,
			composure:     0.8,
			decisions:     0.7,
			determination: 0.65,
			workRate:      0.7,
			pace:          0.9,
			acceleration:  0.95,
			stamina:       0.7,
			strength:      0.65,
		},
		MID: {
			finishing:     0.65,
			longShots:     0.7,
			offTheBall:    0.75,
			passing:       1.0,
			dribbling:     0.75,
			firstTouch:    0.9,
			technique:     0.85,
			tackling:      0.7,
			marking:       0.65,
			positioning:   0.75,
			composure:     0.8,
			decisions:     0.9,
			determination: 0.7,
			workRate:      0.85,
			pace:          0.7,
			acceleration:  0.7,
			stamina:       0.8,
			strength:      0.65,
		},
		DEF: {
			finishing:     0.3,
			longShots:     0.4,
			offTheBall:    0.5,
			passing:       0.7,
			dribbling:     0.55,
			firstTouch:    0.65,
			technique:     0.6,
			tackling:      1.0,
			marking:       0.95,
			positioning:   0.9,
			composure:     0.75,
			decisions:     0.8,
			determination: 0.7,
			workRate:      0.75,
			pace:          0.75,
			acceleration:  0.75,
			stamina:       0.75,
			strength:      0.85,
		},
		GK: {}, // handled above
	};

	const weights = w[position];
	const stats: Record<string, number> = {};
	for (const [key, weight] of Object.entries(weights)) {
		stats[key] = attr(ca, weight as number);
	}
	return stats as unknown as PlayerStats;
}

export function calcValue(ca: number, age: number): number {
	const base = ca * ca * 200;
	const agePenalty = 1 - Math.max(0, age - 23) * 0.04;
	return Math.max(50_000, Math.round((base * agePenalty) / 1000) * 1000);
}

export function generatePlayer(
	position: Position,
	quality: number,
	currentDate = new Date().toISOString().slice(0, 10),
): Player {
	const age = rand(17, 34);
	const pa = Math.min(200, Math.max(80, quality * 2 + rand(-20, 20)));
	const ca = Math.round(pa * ageRatio(age));
	const stats = statsFromCA(ca, position);
	const value = calcValue(ca, age);
	return {
		id: nextId(),
		name: `${pick(firstNames)} ${pick(lastNames)}`,
		dateOfBirth: dobForAge(age, currentDate),
		position,
		stats,
		ca,
		pa,
		personality: pick(PERSONALITIES),
		naturalFitness: rand(1, 20),
		wage: Math.round(value / 500 / 100) * 100,
		value,
		form: rand(5, 8),
		injured: false,
		injuryWeeks: 0,
		morale: rand(6, 9),
		faceSeed: Math.floor(Math.random() * 2 ** 32),
		caHistory: [{ date: currentDate, ca }],
	};
}

export function generateSquad(quality: number): Player[] {
	const squad: Player[] = [];
	squad.push(generatePlayer("GK", quality));
	squad.push(generatePlayer("GK", quality - 10));
	for (let i = 0; i < 6; i++)
		squad.push(generatePlayer("DEF", quality + rand(-5, 5)));
	for (let i = 0; i < 6; i++)
		squad.push(generatePlayer("MID", quality + rand(-5, 5)));
	for (let i = 0; i < 5; i++)
		squad.push(generatePlayer("FWD", quality + rand(-5, 5)));
	return squad;
}
