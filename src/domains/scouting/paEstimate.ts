export interface PAEstimate {
	low: number;
	high: number;
}

export function paEstimate(truePa: number, sightings: number): PAEstimate {
	const margin = sightings >= 6 ? 5 : sightings >= 3 ? 15 : 30;
	return {
		low: Math.max(1, truePa - margin),
		high: Math.min(200, truePa + margin),
	};
}
