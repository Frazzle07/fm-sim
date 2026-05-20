// Procedural 2D semi-realistic face generator.
// Usage: import { createFace } from './generation';
//        const svg = createFace(); // random face
//        const svg = createFace({ seed: 12345 }); // deterministic face

export interface FaceOptions {
  /** Fixed seed for deterministic output. Omit for a random face. */
  seed?: number;
  /** Width of the SVG viewport (default: 120) */
  width?: number;
  /** Height of the SVG viewport (default: 140) */
  height?: number;
}

export interface FaceResult {
  /** The rendered SVG string — inject directly into innerHTML */
  svg: string;
  /** The seed used, store this to recreate the same face later */
  seed: number;
}

interface SkinTone {
  fill: string;
  shadow: string;
  dark: string;
  highlight: string;
}

interface FaceParams {
  skin: SkinTone;
  hairColor: string;
  eyeColor: string;
  faceWidth: number;
  faceHeight: number;
  eyeSpacing: number;
  eyeSize: number;
  noseLength: number;
  noseWidth: number;
  lipWidth: number;
  lipCurve: number;
  lipFullness: number;
  hairStyle: number;
  hasFacialHair: boolean;
  facialHairStyle: number;
  browThickness: number;
  browAngle: number;
  hasFreckles: boolean;
  hasScar: boolean;
  scarX: number;
  scarY: number;
  earSize: number;
  cheekboneHeight: number;
  jawWidth: number;
}

const SKIN_TONES: SkinTone[] = [
  { fill: '#FCEEE0', shadow: '#EAD4B8', dark: '#C8A880', highlight: '#FFFFFF' },
  { fill: '#FDDBB4', shadow: '#E8C090', dark: '#C49060', highlight: '#FFF0D8' },
  { fill: '#F5C89A', shadow: '#DDA870', dark: '#B07840', highlight: '#FFE4C0' },
  { fill: '#E8A878', shadow: '#C88050', dark: '#986030', highlight: '#F8C898' },
  { fill: '#D08858', shadow: '#A86030', dark: '#804818', highlight: '#E8A878' },
  { fill: '#C07840', shadow: '#A05820', dark: '#784010', highlight: '#D89060' },
  { fill: '#A05828', shadow: '#804010', dark: '#602808', highlight: '#C07840' },
  { fill: '#804020', shadow: '#602808', dark: '#401800', highlight: '#A05828' },
  { fill: '#5A2810', shadow: '#401808', dark: '#280C04', highlight: '#7A3820' },
];

const HAIR_COLORS: string[] = [
  '#1A0A00', '#2C1810', '#4A2810', '#8B4513', '#A0522D',
  '#C68642', '#D4A017', '#F0C040', '#E8C49A', '#C0392B',
  '#8B0000', '#555555', '#999999', '#CCCCCC',
];

const EYE_COLORS: string[] = [
  '#2E4057', '#1A6B8A', '#3D8B37', '#6B8E23', '#6B4423',
  '#4A3728', '#1A1A1A', '#7B6B4A', '#5C8A6B',
];

const HAIR_STYLE_COUNT = 6;

function rng(seed: number, offset: number): number {
  let s = seed ^ (offset * 2654435761);
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
  s = s ^ (s >>> 16);
  return (s >>> 0) / 4294967296;
}

function pick<T>(arr: T[], seed: number, offset: number): T {
  return arr[Math.floor(rng(seed, offset) * arr.length)];
}

function range(min: number, max: number, seed: number, offset: number): number {
  return min + rng(seed, offset) * (max - min);
}

function buildParams(seed: number): FaceParams {
  return {
    skin:            pick(SKIN_TONES, seed, 1),
    hairColor:       pick(HAIR_COLORS, seed, 2),
    eyeColor:        pick(EYE_COLORS, seed, 3),
    faceWidth:       range(54, 74, seed, 4),
    faceHeight:      range(68, 90, seed, 5),
    eyeSpacing:      range(10, 17, seed, 6),
    eyeSize:         range(5, 8, seed, 7),
    noseLength:      range(7, 15, seed, 8),
    noseWidth:       range(4, 9, seed, 9),
    lipWidth:        range(10, 20, seed, 10),
    lipCurve:        range(-3, 4, seed, 11),
    lipFullness:     range(2, 6, seed, 12),
    hairStyle:       Math.floor(rng(seed, 13) * HAIR_STYLE_COUNT),
    hasFacialHair:   rng(seed, 14) > 0.55,
    facialHairStyle: Math.floor(rng(seed, 15) * 3),
    browThickness:   range(1.5, 3, seed, 16),
    browAngle:       range(-3, 2, seed, 17),
    hasFreckles:     rng(seed, 18) > 0.7,
    hasScar:         rng(seed, 19) > 0.85,
    scarX:           range(-15, 15, seed, 20),
    scarY:           range(-10, 15, seed, 21),
    earSize:         range(5, 9, seed, 22),
    cheekboneHeight: range(-5, 5, seed, 23),
    jawWidth:        range(0.7, 1.0, seed, 24),
  };
}

function buildHair(p: FaceParams, cx: number, cy: number): string {
  const rx = p.faceWidth / 2;
  const ry = p.faceHeight / 2;
  const hc = p.hairColor;
  const top = cy - ry;

  switch (p.hairStyle) {
    case 0:
      return `
        <ellipse cx="${cx}" cy="${top + ry * 0.35}" rx="${rx * 0.97}" ry="${ry * 0.4}" fill="${hc}"/>
        <rect x="${cx - rx * 0.97}" y="${top}" width="${rx * 1.94}" height="${ry * 0.45}" fill="${hc}"/>
        <path d="M${cx - rx * 0.97},${cy - ry * 0.55} Q${cx - rx * 1.2},${cy + ry * 0.1} ${cx - rx * 0.85},${cy + ry * 0.35}" fill="none" stroke="${hc}" stroke-width="9"/>
        <path d="M${cx + rx * 0.97},${cy - ry * 0.55} Q${cx + rx * 1.2},${cy + ry * 0.1} ${cx + rx * 0.85},${cy + ry * 0.35}" fill="none" stroke="${hc}" stroke-width="9"/>`;

    case 1:
      return `
        <ellipse cx="${cx}" cy="${top + ry * 0.28}" rx="${rx * 0.99}" ry="${ry * 0.32}" fill="${hc}"/>
        <rect x="${cx - rx * 0.99}" y="${top}" width="${rx * 1.98}" height="${ry * 0.38}" fill="${hc}"/>`;

    case 2:
      return `
        <path d="M${cx - rx * 0.9},${cy - ry * 0.7} Q${cx - rx * 0.6},${cy - ry * 1.35} ${cx},${cy - ry * 1.28} Q${cx + rx * 0.6},${cy - ry * 1.35} ${cx + rx * 0.9},${cy - ry * 0.7} L${cx + rx * 0.97},${cy - ry * 0.5} L${cx - rx * 0.97},${cy - ry * 0.5}Z" fill="${hc}"/>
        <path d="M${cx - rx * 0.97},${cy - ry * 0.5} Q${cx - rx * 1.25},${cy + ry * 0.15} ${cx - rx * 0.92},${cy + ry * 0.5}" fill="none" stroke="${hc}" stroke-width="11"/>
        <path d="M${cx + rx * 0.97},${cy - ry * 0.5} Q${cx + rx * 1.25},${cy + ry * 0.15} ${cx + rx * 0.92},${cy + ry * 0.5}" fill="none" stroke="${hc}" stroke-width="11"/>`;

    case 3:
      return `
        <path d="M${cx - rx * 0.9},${cy - ry * 0.62} Q${cx},${cy - ry * 1.55} ${cx + rx * 0.9},${cy - ry * 0.62}" fill="${hc}"/>
        ${[-0.85, -0.45, -0.1, 0.2, 0.6, 0.9].map(i =>
          `<path d="M${cx + i * rx * 0.85},${cy - ry * 0.92} Q${cx + i * rx * 1.1},${cy + ry * 0.55} ${cx + i * rx * 1.15},${cy + ry * 1.15}" fill="none" stroke="${hc}" stroke-width="6"/>`
        ).join('')}`;

    case 4:
      return `
        <ellipse cx="${cx}" cy="${top + ry * 0.28}" rx="${rx * 0.97}" ry="${ry * 0.34}" fill="${hc}"/>
        <rect x="${cx - rx * 0.97}" y="${top}" width="${rx * 1.94}" height="${ry * 0.4}" fill="${hc}"/>
        <circle cx="${cx}" cy="${top - ry * 0.15}" r="${rx * 0.28}" fill="${hc}"/>
        <circle cx="${cx}" cy="${top - ry * 0.15}" r="${rx * 0.18}" fill="${hc}" opacity="0.6"/>`;

    case 5:
    default:
      return `
        <ellipse cx="${cx}" cy="${top + ry * 0.38}" rx="${rx * 1.05}" ry="${ry * 0.48}" fill="${hc}"/>
        <rect x="${cx - rx * 1.05}" y="${top}" width="${rx * 2.1}" height="${ry * 0.5}" fill="${hc}"/>
        ${[-0.7, -0.3, 0.1, 0.5, 0.85].map((o) => {
          const bx = cx + o * rx;
          const by = top + ry * 0.05;
          return `<circle cx="${bx}" cy="${by}" r="${rx * 0.22}" fill="${hc}"/>
                  <circle cx="${bx - rx * 0.15}" cy="${by - ry * 0.1}" r="${rx * 0.18}" fill="${hc}"/>`;
        }).join('')}
        <path d="M${cx - rx * 1.05},${cy - ry * 0.52} Q${cx - rx * 1.3},${cy + ry * 0.1} ${cx - rx * 1.05},${cy + ry * 0.45}" fill="none" stroke="${hc}" stroke-width="12"/>
        <path d="M${cx + rx * 1.05},${cy - ry * 0.52} Q${cx + rx * 1.3},${cy + ry * 0.1} ${cx + rx * 1.05},${cy + ry * 0.45}" fill="none" stroke="${hc}" stroke-width="12"/>`;
  }
}

function buildFacialHair(p: FaceParams, cx: number, mouthY: number): string {
  if (!p.hasFacialHair) return '';
  const hc = p.hairColor;
  const lw = p.lipWidth;

  switch (p.facialHairStyle) {
    case 0:
      return `<path d="M${cx - lw * 0.9},${mouthY + 2} Q${cx},${mouthY + 14 + p.lipCurve} ${cx + lw * 0.9},${mouthY + 2} Q${cx + lw * 1.3},${mouthY + 8} ${cx + lw},${mouthY + 18} Q${cx},${mouthY + 24} ${cx - lw},${mouthY + 18} Q${cx - lw * 1.3},${mouthY + 8} ${cx - lw * 0.9},${mouthY + 2}Z" fill="${hc}" opacity="0.8"/>`;
    case 1:
      return `<path d="M${cx - lw * 0.5},${mouthY + 2} Q${cx},${mouthY + 12} ${cx + lw * 0.5},${mouthY + 2} Q${cx + lw * 0.6},${mouthY + 8} ${cx},${mouthY + 15} Q${cx - lw * 0.6},${mouthY + 8} ${cx - lw * 0.5},${mouthY + 2}Z" fill="${hc}" opacity="0.75"/>`;
    case 2:
    default:
      return `<ellipse cx="${cx}" cy="${mouthY + 8}" rx="${lw * 1.1}" ry="8" fill="${hc}" opacity="0.25"/>`;
  }
}

function buildFreckles(p: FaceParams, cx: number, eyeY: number, skin: SkinTone): string {
  if (!p.hasFreckles) return '';
  const freckleColor = skin.dark;
  const positions = [
    [-18, 6], [-12, 10], [-20, 12], [-8, 8], [-15, 16],
    [18, 6],  [12, 10],  [20, 12],  [8, 8],  [15, 16],
    [-5, 14], [5, 14],   [0, 12],
  ];
  return positions.map(([ox, oy]) =>
    `<circle cx="${cx + ox}" cy="${eyeY + oy}" r="1.2" fill="${freckleColor}" opacity="0.45"/>`
  ).join('');
}

function buildScar(p: FaceParams, cx: number, cy: number): string {
  if (!p.hasScar) return '';
  const sx = cx + p.scarX;
  const sy = cy + p.scarY;
  return `<path d="M${sx},${sy - 8} Q${sx + 2},${sy} ${sx - 1},${sy + 8}" fill="none" stroke="#C08070" stroke-width="1.5" opacity="0.6"/>`;
}

function assembleSVG(p: FaceParams, svgWidth: number, svgHeight: number): string {
  const cx = svgWidth / 2;
  const cy = svgHeight * 0.5;
  const rx = p.faceWidth / 2;
  const ry = p.faceHeight / 2;

  const eyeY = cy - ry * 0.12;
  const noseY = cy + ry * 0.12;
  const mouthY = cy + ry * 0.38;

  const earX = rx + p.earSize * 0.4;
  const earY = eyeY + 5;
  const jawRx = rx * p.jawWidth;

  const hair     = buildHair(p, cx, cy);
  const facialH  = buildFacialHair(p, cx, mouthY);
  const freckles = buildFreckles(p, cx, eyeY, p.skin);
  const scar     = buildScar(p, cx, cy);

  const es  = p.eyeSize;
  const esp = p.eyeSpacing;
  const lx  = cx - esp;
  const rx2 = cx + esp;

  return `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}">
  ${hair}
  <ellipse cx="${cx - earX}" cy="${earY}" rx="${p.earSize * 0.72}" ry="${p.earSize}" fill="${p.skin.fill}"/>
  <ellipse cx="${cx + earX}" cy="${earY}" rx="${p.earSize * 0.72}" ry="${p.earSize}" fill="${p.skin.fill}"/>
  <ellipse cx="${cx - earX}" cy="${earY}" rx="${p.earSize * 0.36}" ry="${p.earSize * 0.58}" fill="${p.skin.shadow}"/>
  <ellipse cx="${cx + earX}" cy="${earY}" rx="${p.earSize * 0.36}" ry="${p.earSize * 0.58}" fill="${p.skin.shadow}"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${p.skin.fill}"/>
  <ellipse cx="${cx}" cy="${cy + ry * 0.35}" rx="${jawRx}" ry="${ry * 0.55}" fill="${p.skin.fill}"/>
  <ellipse cx="${cx - rx * 0.62}" cy="${cy - ry * 0.42}" rx="${rx * 0.28}" ry="${ry * 0.22}" fill="${p.skin.shadow}" opacity="0.2"/>
  <ellipse cx="${cx + rx * 0.62}" cy="${cy - ry * 0.42}" rx="${rx * 0.28}" ry="${ry * 0.22}" fill="${p.skin.shadow}" opacity="0.2"/>
  <ellipse cx="${cx}" cy="${cy + ry * 0.55}" rx="${jawRx * 0.6}" ry="${ry * 0.28}" fill="${p.skin.shadow}" opacity="0.15"/>
  <ellipse cx="${cx - rx * 0.58}" cy="${eyeY + 16 + p.cheekboneHeight}" rx="${rx * 0.22}" ry="${ry * 0.12}" fill="#E87878" opacity="0.1"/>
  <ellipse cx="${cx + rx * 0.58}" cy="${eyeY + 16 + p.cheekboneHeight}" rx="${rx * 0.22}" ry="${ry * 0.12}" fill="#E87878" opacity="0.1"/>
  <path d="M${lx - es * 1.5},${eyeY - es - 3 + p.browAngle} Q${lx},${eyeY - es - 6} ${lx + es * 1.5},${eyeY - es - 3 - p.browAngle * 0.5}"
        fill="none" stroke="${p.hairColor}" stroke-width="${p.browThickness}" stroke-linecap="round" opacity="0.9"/>
  <path d="M${rx2 - es * 1.5},${eyeY - es - 3 - p.browAngle * 0.5} Q${rx2},${eyeY - es - 6} ${rx2 + es * 1.5},${eyeY - es - 3 + p.browAngle}"
        fill="none" stroke="${p.hairColor}" stroke-width="${p.browThickness}" stroke-linecap="round" opacity="0.9"/>
  <ellipse cx="${lx}" cy="${eyeY}" rx="${es * 1.55}" ry="${es}" fill="white"/>
  <ellipse cx="${rx2}" cy="${eyeY}" rx="${es * 1.55}" ry="${es}" fill="white"/>
  <circle cx="${lx}" cy="${eyeY}" r="${es * 0.72}" fill="${p.eyeColor}"/>
  <circle cx="${rx2}" cy="${eyeY}" r="${es * 0.72}" fill="${p.eyeColor}"/>
  <circle cx="${lx}" cy="${eyeY}" r="${es * 0.72}" fill="none" stroke="#111" stroke-width="0.8" opacity="0.5"/>
  <circle cx="${rx2}" cy="${eyeY}" r="${es * 0.72}" fill="none" stroke="#111" stroke-width="0.8" opacity="0.5"/>
  <circle cx="${lx}" cy="${eyeY}" r="${es * 0.4}" fill="#0A0A0A"/>
  <circle cx="${rx2}" cy="${eyeY}" r="${es * 0.4}" fill="#0A0A0A"/>
  <circle cx="${lx + es * 0.25}" cy="${eyeY - es * 0.25}" r="${es * 0.17}" fill="white" opacity="0.8"/>
  <circle cx="${rx2 + es * 0.25}" cy="${eyeY - es * 0.25}" r="${es * 0.17}" fill="white" opacity="0.8"/>
  <path d="M${lx - es * 1.55},${eyeY} Q${lx},${eyeY - es * 1.1} ${lx + es * 1.55},${eyeY}"
        fill="none" stroke="#44220A" stroke-width="1" opacity="0.5"/>
  <path d="M${rx2 - es * 1.55},${eyeY} Q${rx2},${eyeY - es * 1.1} ${rx2 + es * 1.55},${eyeY}"
        fill="none" stroke="#44220A" stroke-width="1" opacity="0.5"/>
  <path d="M${cx - 2},${eyeY + es + 2} Q${cx - p.noseWidth * 0.5},${noseY} ${cx - p.noseWidth * 0.6},${noseY + p.noseLength}"
        fill="none" stroke="${p.skin.dark}" stroke-width="1.1" opacity="0.35"/>
  <path d="M${cx + 2},${eyeY + es + 2} Q${cx + p.noseWidth * 0.5},${noseY} ${cx + p.noseWidth * 0.6},${noseY + p.noseLength}"
        fill="none" stroke="${p.skin.dark}" stroke-width="1.1" opacity="0.35"/>
  <ellipse cx="${cx}" cy="${noseY + p.noseLength}" rx="${p.noseWidth * 0.7}" ry="${p.noseLength * 0.25}" fill="${p.skin.shadow}" opacity="0.3"/>
  <path d="M${cx - p.noseWidth * 0.5},${noseY + p.noseLength} Q${cx - p.noseWidth * 0.85},${noseY + p.noseLength + 3} ${cx - p.noseWidth * 0.6},${noseY + p.noseLength + 5}"
        fill="none" stroke="${p.skin.dark}" stroke-width="1.3" opacity="0.4"/>
  <path d="M${cx + p.noseWidth * 0.5},${noseY + p.noseLength} Q${cx + p.noseWidth * 0.85},${noseY + p.noseLength + 3} ${cx + p.noseWidth * 0.6},${noseY + p.noseLength + 5}"
        fill="none" stroke="${p.skin.dark}" stroke-width="1.3" opacity="0.4"/>
  <path d="M${cx - p.lipWidth},${mouthY} Q${cx - p.lipWidth * 0.4},${mouthY - p.lipFullness * 0.6 + p.lipCurve} ${cx},${mouthY - p.lipFullness * 0.4 + p.lipCurve} Q${cx + p.lipWidth * 0.4},${mouthY - p.lipFullness * 0.6 + p.lipCurve} ${cx + p.lipWidth},${mouthY}Z"
        fill="${p.skin.shadow}" opacity="0.5"/>
  <path d="M${cx - p.lipWidth * 0.35},${mouthY - p.lipFullness * 0.3 + p.lipCurve} Q${cx},${mouthY - p.lipFullness * 0.7 + p.lipCurve} ${cx + p.lipWidth * 0.35},${mouthY - p.lipFullness * 0.3 + p.lipCurve}"
        fill="none" stroke="${p.skin.dark}" stroke-width="0.8" opacity="0.4"/>
  <path d="M${cx - p.lipWidth},${mouthY} Q${cx},${mouthY + p.lipFullness + p.lipCurve} ${cx + p.lipWidth},${mouthY}Z"
        fill="${p.skin.shadow}" opacity="0.45"/>
  <path d="M${cx - p.lipWidth},${mouthY} Q${cx},${mouthY + p.lipCurve * 0.5} ${cx + p.lipWidth},${mouthY}"
        fill="none" stroke="${p.skin.dark}" stroke-width="1.4" stroke-linecap="round" opacity="0.55"/>
  <ellipse cx="${cx}" cy="${mouthY + p.lipFullness * 0.4 + p.lipCurve * 0.5}" rx="${p.lipWidth * 0.3}" ry="${p.lipFullness * 0.22}" fill="white" opacity="0.2"/>
  ${freckles}
  ${facialH}
  ${scar}
</svg>`;
}

/**
 * Generate a procedural 2D semi-realistic face as an SVG string.
 * Pass a seed to get a deterministic face; omit for a random one.
 */
export function createFace(options: FaceOptions = {}): FaceResult {
  const seed   = options.seed   ?? Math.floor(Math.random() * 2 ** 32);
  const width  = options.width  ?? 120;
  const height = options.height ?? 140;

  const params = buildParams(seed);
  const svg    = assembleSVG(params, width, height);

  return { svg, seed };
}
