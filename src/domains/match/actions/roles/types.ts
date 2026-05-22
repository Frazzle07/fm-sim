export interface ZoneConfig {
	xMin: number;
	xMax: number;
	/** Y-band at deepest own-half ball position (home perspective). */
	yMinDeep: number;
	/** Y-band at deepest opposition-half ball position (home perspective). */
	yMinHigh: number;
	yMaxDeep: number;
	yMaxHigh: number;
}
