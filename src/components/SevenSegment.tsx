/**
 * SVG seven-segment renderer used for every LED readout, so the digits match
 * the mitred segment shape of the physical display instead of a font fallback.
 */

const SEGMENTS_BY_CHARACTER: Record<string, string[]> = {
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

const DIGIT_WIDTH = 100;
const DIGIT_HEIGHT = 180;
const THICKNESS = 8;

function horizontalSegment(centerY: number) {
  const left = 14;
  const right = DIGIT_WIDTH - 14;

  return [
    [left, centerY],
    [left + THICKNESS, centerY - THICKNESS],
    [right - THICKNESS, centerY - THICKNESS],
    [right, centerY],
    [right - THICKNESS, centerY + THICKNESS],
    [left + THICKNESS, centerY + THICKNESS],
  ]
    .map((point) => point.join(","))
    .join(" ");
}

function verticalSegment(centerX: number, top: number, bottom: number) {
  return [
    [centerX, top],
    [centerX + THICKNESS, top + THICKNESS],
    [centerX + THICKNESS, bottom - THICKNESS],
    [centerX, bottom],
    [centerX - THICKNESS, bottom - THICKNESS],
    [centerX - THICKNESS, top + THICKNESS],
  ]
    .map((point) => point.join(","))
    .join(" ");
}

const SEGMENT_SHAPES: Record<string, string> = {
  a: horizontalSegment(12),
  g: horizontalSegment(90),
  d: horizontalSegment(168),
  f: verticalSegment(8, 20, 82),
  b: verticalSegment(DIGIT_WIDTH - 8, 20, 82),
  e: verticalSegment(8, 98, 160),
  c: verticalSegment(DIGIT_WIDTH - 8, 98, 160),
};

const ALL_SEGMENTS = Object.keys(SEGMENT_SHAPES);

function Digit({ character, color }: { character: string; color: string }) {
  const lit = new Set(SEGMENTS_BY_CHARACTER[character] ?? []);

  return (
    <svg
      className="seven-segment__digit"
      preserveAspectRatio="xMidYMid meet"
      viewBox={`0 0 ${DIGIT_WIDTH} ${DIGIT_HEIGHT}`}
    >
      {ALL_SEGMENTS.map((segment) => (
        <polygon
          key={segment}
          fill={lit.has(segment) ? color : "currentColor"}
          opacity={lit.has(segment) ? 1 : 0.07}
          points={SEGMENT_SHAPES[segment]}
        />
      ))}
    </svg>
  );
}

function Colon({ color }: { color: string }) {
  return (
    <svg
      className="seven-segment__colon"
      preserveAspectRatio="xMidYMid meet"
      viewBox={`0 0 30 ${DIGIT_HEIGHT}`}
    >
      <circle cx="15" cy="62" fill={color} r="9" />
      <circle cx="15" cy="126" fill={color} r="9" />
    </svg>
  );
}

export default function SevenSegment({
  value,
  color = "#f4f7fb",
  className = "",
  label = value,
}: {
  value: string;
  color?: string;
  className?: string;
  /**
   * What screen readers announce for the readout. `null` hides it from them,
   * for places where the same value is already announced as prose.
   */
  label?: string | null;
}) {
  return (
    <div
      aria-hidden={label === null || undefined}
      aria-label={label ?? undefined}
      className={`seven-segment ${className}`}
      role={label === null ? undefined : "img"}
    >
      {value.split("").map((character, index) =>
        character === ":" ? (
          <Colon key={`colon-${index}`} color={color} />
        ) : (
          <Digit key={`${character}-${index}`} character={character} color={color} />
        ),
      )}
    </div>
  );
}
