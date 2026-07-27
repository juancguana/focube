/**
 * Single source of truth for seven-segment shapes, shared by the SVG readouts
 * in the panel and the canvas texture painted onto the cube screen.
 */

export const SEGMENTS_BY_CHARACTER: Record<string, string[]> = {
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "g", "e", "d"],
  "3": ["a", "b", "g", "c", "d"],
  "4": ["f", "g", "b", "c"],
  "5": ["a", "f", "g", "c", "d"],
  "6": ["a", "f", "g", "e", "c", "d"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "c", "d", "f", "g"],
  "-": ["g"],
  " ": [],
};

export const ALL_SEGMENTS = ["a", "b", "c", "d", "e", "f", "g"];

/** Width of a digit relative to its height, and of the colon separator. */
export const DIGIT_ASPECT = 100 / 180;
export const COLON_ASPECT = 30 / 180;

type Point = [number, number];

/**
 * Returns the polygon for one segment inside a box, in the mitred shape real
 * seven-segment displays use.
 */
export function segmentPolygon(
  segment: string,
  x: number,
  y: number,
  width: number,
  height: number,
): Point[] {
  const thickness = width * 0.09;
  const inset = width * 0.14;

  const horizontal = (centerY: number): Point[] => [
    [x + inset, centerY],
    [x + inset + thickness, centerY - thickness],
    [x + width - inset - thickness, centerY - thickness],
    [x + width - inset, centerY],
    [x + width - inset - thickness, centerY + thickness],
    [x + inset + thickness, centerY + thickness],
  ];

  const vertical = (centerX: number, top: number, bottom: number): Point[] => [
    [centerX, top],
    [centerX + thickness, top + thickness],
    [centerX + thickness, bottom - thickness],
    [centerX, bottom],
    [centerX - thickness, bottom - thickness],
    [centerX - thickness, top + thickness],
  ];

  switch (segment) {
    case "a":
      return horizontal(y + height * 0.07);
    case "g":
      return horizontal(y + height * 0.5);
    case "d":
      return horizontal(y + height * 0.93);
    case "f":
      return vertical(x + inset * 0.6, y + height * 0.11, y + height * 0.46);
    case "b":
      return vertical(
        x + width - inset * 0.6,
        y + height * 0.11,
        y + height * 0.46,
      );
    case "e":
      return vertical(x + inset * 0.6, y + height * 0.54, y + height * 0.89);
    default:
      return vertical(
        x + width - inset * 0.6,
        y + height * 0.54,
        y + height * 0.89,
      );
  }
}

/** Total width of a rendered string at a given digit height. */
export function measureText(value: string, height: number, gap: number) {
  return value.split("").reduce((total, character, index) => {
    const aspect = character === ":" ? COLON_ASPECT : DIGIT_ASPECT;
    return total + height * aspect + (index > 0 ? gap : 0);
  }, 0);
}

/** Paints a seven-segment string onto a 2D canvas, left-aligned at (x, y). */
export function drawSevenSegmentText(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  height: number,
  options: { color: string; dimAlpha?: number; gap?: number },
) {
  const gap = options.gap ?? height * 0.055;
  const dimAlpha = options.dimAlpha ?? 0.07;
  let cursor = x;

  for (const character of value) {
    if (character === ":") {
      const width = height * COLON_ASPECT;
      context.fillStyle = options.color;
      context.globalAlpha = 1;
      const radius = height * 0.05;
      context.beginPath();
      context.arc(cursor + width / 2, y + height * 0.345, radius, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.arc(cursor + width / 2, y + height * 0.7, radius, 0, Math.PI * 2);
      context.fill();
      cursor += width + gap;
      continue;
    }

    const width = height * DIGIT_ASPECT;
    const lit = new Set(SEGMENTS_BY_CHARACTER[character] ?? []);

    for (const segment of ALL_SEGMENTS) {
      const points = segmentPolygon(segment, cursor, y, width, height);
      context.globalAlpha = lit.has(segment) ? 1 : dimAlpha;
      context.fillStyle = options.color;
      context.beginPath();
      points.forEach(([px, py], index) => {
        if (index === 0) {
          context.moveTo(px, py);
        } else {
          context.lineTo(px, py);
        }
      });
      context.closePath();
      context.fill();
    }

    cursor += width + gap;
  }

  context.globalAlpha = 1;
}
