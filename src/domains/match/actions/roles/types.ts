export interface ZoneConfig {
	xMin: number;
	xMax: number;
	/** Y-band at deepest own-half ball position (home perspective). */
	yMinDeep: number;
	/** Y-band at deepest opposition-half ball position (home perspective). */
	yMinHigh: number;
	yMaxDeep: number;
	yMaxHigh: number;
	/**
	 * How far ahead of the ball (in attacking direction, 0–1 pitch units) this
	 * role ideally positions itself. Positive = ahead, negative = behind.
	 * Used instead of a shared depth-alignment metric so each role maintains
	 * its own depth relative to the ball rather than collapsing to ball depth.
	 */
	idealBallOffset: number;
}
