import { useMemo, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import {
  ASPECT_COLORS,
  PLANET_COLORS,
  PLANET_GLYPHS,
  ZODIAC_SIGNS,
  computeAspects,
  getMoonPhase,
  getPlanetaryPositions,
  getRetrogradeStatus,
} from "../utils/astroCalc";

const SIZE = 480;
const CX = SIZE / 2;
const CY = SIZE / 2;
const OUTER_R = 210;
const ZODIAC_R = 190;
const ZODIAC_INNER = 155;
const SIGN_LABEL_R = 172;
const PLANET_R = 125;
const ASPECT_R = 75;

// Convert ecliptic longitude to SVG angle (0° = right, counterclockwise in astrology)
function lonToSvgAngle(lon: number): number {
  // Astrology: 0° Aries = 9 o'clock position going counterclockwise
  // SVG: 0° = 3 o'clock, angles go clockwise
  return -lon - 90;
}

function polarToXY(r: number, angleDeg: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

interface PlanetTooltip {
  body: string;
  longitude: number;
  sign: string;
  degree: number;
  isRetrograde: boolean;
  aspects: string[];
  x: number;
  y: number;
}

// Zodiac sign colors
const ZODIAC_COLORS = [
  "#E05A30", // Aries - fire
  "#D4AA70", // Taurus - earth
  "#60A5FA", // Gemini - air
  "#C8C8D4", // Cancer - water
  "#FFD700", // Leo - fire
  "#86EFAC", // Virgo - earth
  "#A78BFA", // Libra - air
  "#F87171", // Scorpio - water
  "#FB923C", // Sagittarius - fire
  "#94A3B8", // Capricorn - earth
  "#7FCFC0", // Aquarius - air
  "#818CF8", // Pisces - water
];

export function ZodiacWheel() {
  const { selectedTimestamp } = useAppStore();
  const [hoveredPlanet, setHoveredPlanet] = useState<PlanetTooltip | null>(
    null,
  );

  const { positions, aspects, moonPhase } = useMemo(() => {
    const pos = getPlanetaryPositions(selectedTimestamp);
    const asp = computeAspects(selectedTimestamp);
    const moon = getMoonPhase(selectedTimestamp);
    return { positions: pos, aspects: asp, moonPhase: moon };
  }, [selectedTimestamp]);

  const bodies = [
    "Sun",
    "Moon",
    "Mercury",
    "Venus",
    "Mars",
    "Jupiter",
    "Saturn",
    "Uranus",
    "Neptune",
    "Pluto",
  ];

  // Group planets that are close together (within 8°) to avoid overlap
  const planetPositions = bodies.map((body) => {
    const lon = positions[body]?.longitude ?? 0;
    const isRetro =
      body !== "Sun" &&
      body !== "Moon" &&
      getRetrogradeStatus(body, selectedTimestamp);
    const svgAngle = lonToSvgAngle(lon);
    const [x, y] = polarToXY(PLANET_R, svgAngle);
    const sign = ZODIAC_SIGNS[Math.floor(lon / 30) % 12];
    const bodyAspects = aspects
      .filter((a) => a.body1 === body || a.body2 === body)
      .map(
        (a) =>
          `${a.body1 === body ? a.body2 : a.body1}: ${a.aspectType} (${a.orb.toFixed(1)}°)`,
      );

    return {
      body,
      lon,
      svgAngle,
      x,
      y,
      isRetro,
      sign: sign?.name ?? "",
      degree: lon % 30,
      aspects: bodyAspects,
    };
  });

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 pb-0">
        <h2 className="font-display font-semibold text-xl text-foreground">
          Zodiac Wheel
        </h2>
        <p className="font-mono text-xs text-muted-foreground mt-0.5">
          Planetary positions in the ecliptic — Moon:{" "}
          <span className="text-neon-teal">{moonPhase.phase}</span> (
          {moonPhase.illumination.toFixed(1)}% illuminated)
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 p-4">
        {/* SVG Wheel */}
        <div className="flex-shrink-0 flex justify-center">
          <div className="relative">
            <svg
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              width={SIZE}
              height={SIZE}
              className="max-w-full"
              role="img"
              aria-label="Zodiac wheel showing planetary positions"
              style={{
                filter: "drop-shadow(0 0 30px oklch(0.4 0.1 265 / 0.3))",
              }}
            >
              {/* Outer circle */}
              <circle
                cx={CX}
                cy={CY}
                r={OUTER_R}
                fill="oklch(0.1 0.015 265 / 0.8)"
                stroke="oklch(0.35 0.06 240 / 0.5)"
                strokeWidth="1.5"
              />

              {/* Zodiac ring */}
              <circle
                cx={CX}
                cy={CY}
                r={ZODIAC_R}
                fill="none"
                stroke="oklch(0.3 0.05 265 / 0.4)"
                strokeWidth="0.5"
              />
              <circle
                cx={CX}
                cy={CY}
                r={ZODIAC_INNER}
                fill="oklch(0.08 0.01 265 / 0.7)"
                stroke="oklch(0.3 0.05 265 / 0.4)"
                strokeWidth="0.5"
              />

              {/* Zodiac sign segments */}
              {ZODIAC_SIGNS.map((sign, i) => {
                const startAngle = lonToSvgAngle(sign.start);
                const endAngle = lonToSvgAngle(sign.start + 30);
                const midAngle = lonToSvgAngle(sign.start + 15);
                const color = ZODIAC_COLORS[i];

                // Segment background
                const [sx1, sy1] = polarToXY(ZODIAC_INNER, startAngle);
                const [sx2, sy2] = polarToXY(ZODIAC_R, startAngle);
                const [ex1, ey1] = polarToXY(ZODIAC_INNER, endAngle);
                const [ex2, ey2] = polarToXY(ZODIAC_R, endAngle);

                const pathD = [
                  `M ${sx1} ${sy1}`,
                  `L ${sx2} ${sy2}`,
                  `A ${ZODIAC_R} ${ZODIAC_R} 0 0 0 ${ex2} ${ey2}`,
                  `L ${ex1} ${ey1}`,
                  `A ${ZODIAC_INNER} ${ZODIAC_INNER} 0 0 1 ${sx1} ${sy1}`,
                ].join(" ");

                // Division line
                const [dl1x, dl1y] = polarToXY(ZODIAC_INNER, startAngle);
                const [dl2x, dl2y] = polarToXY(OUTER_R, startAngle);

                // Sign glyph position
                const [gx, gy] = polarToXY(SIGN_LABEL_R, midAngle);

                return (
                  <g key={sign.name}>
                    <path
                      d={pathD}
                      fill={`${color}18`}
                      stroke={`${color}30`}
                      strokeWidth="0.5"
                    />
                    {/* Division lines */}
                    <line
                      x1={dl1x}
                      y1={dl1y}
                      x2={dl2x}
                      y2={dl2y}
                      stroke="oklch(0.3 0.05 265 / 0.5)"
                      strokeWidth="0.5"
                    />
                    {/* Sign symbol */}
                    <text
                      x={gx}
                      y={gy}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={color}
                      fontSize="13"
                      fontFamily="serif"
                      opacity="0.85"
                    >
                      {sign.symbol}
                    </text>
                  </g>
                );
              })}

              {/* Planet orbit ring */}
              <circle
                cx={CX}
                cy={CY}
                r={PLANET_R}
                fill="none"
                stroke="oklch(0.28 0.04 265 / 0.3)"
                strokeWidth="0.5"
                strokeDasharray="2 3"
              />

              {/* Aspect lines */}
              {aspects.map((aspect) => {
                const body1 = planetPositions.find(
                  (p) => p.body === aspect.body1,
                );
                const body2 = planetPositions.find(
                  (p) => p.body === aspect.body2,
                );
                if (!body1 || !body2) return null;
                const [ax1, ay1] = polarToXY(ASPECT_R, body1.svgAngle);
                const [ax2, ay2] = polarToXY(ASPECT_R, body2.svgAngle);
                const color = ASPECT_COLORS[aspect.aspectType] ?? "#888";
                return (
                  <line
                    key={`aspect-${aspect.body1}-${aspect.body2}-${aspect.aspectType}`}
                    x1={ax1}
                    y1={ay1}
                    x2={ax2}
                    y2={ay2}
                    stroke={color}
                    strokeWidth="0.8"
                    strokeOpacity={0.4}
                    strokeDasharray={
                      aspect.aspectType === "Opposition"
                        ? "4 2"
                        : aspect.aspectType === "Conjunction"
                          ? "none"
                          : "2 2"
                    }
                  />
                );
              })}

              {/* Center */}
              <circle
                cx={CX}
                cy={CY}
                r="8"
                fill="oklch(0.65 0.22 240 / 0.3)"
                stroke="oklch(0.65 0.22 240 / 0.6)"
                strokeWidth="1"
              />

              {/* Planet glyphs */}
              {planetPositions.map((p) => {
                const color = PLANET_COLORS[p.body] ?? "#888";
                const glyph = PLANET_GLYPHS[p.body] ?? p.body[0];

                return (
                  <g
                    key={p.body}
                    onMouseEnter={() =>
                      setHoveredPlanet({
                        body: p.body,
                        longitude: p.lon,
                        sign: p.sign,
                        degree: p.degree,
                        isRetrograde: p.isRetro,
                        aspects: p.aspects,
                        x: p.x,
                        y: p.y,
                      })
                    }
                    onMouseLeave={() => setHoveredPlanet(null)}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Tick line from zodiac inner to planet */}
                    {(() => {
                      const [tx1, ty1] = polarToXY(
                        ZODIAC_INNER - 2,
                        p.svgAngle,
                      );
                      const [tx2, ty2] = polarToXY(PLANET_R + 15, p.svgAngle);
                      return (
                        <line
                          x1={tx1}
                          y1={ty1}
                          x2={tx2}
                          y2={ty2}
                          stroke={color}
                          strokeWidth="0.5"
                          strokeOpacity={0.4}
                        />
                      );
                    })()}

                    {/* Planet dot */}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="9"
                      fill="oklch(0.1 0.015 265 / 0.9)"
                      stroke={color}
                      strokeWidth="1"
                      style={{ filter: `drop-shadow(0 0 4px ${color})` }}
                    />

                    {/* Glyph */}
                    <text
                      x={p.x}
                      y={p.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={color}
                      fontSize="11"
                      fontFamily="serif"
                    >
                      {glyph}
                    </text>

                    {/* Retrograde indicator */}
                    {p.isRetro && (
                      <text
                        x={p.x + 9}
                        y={p.y - 6}
                        textAnchor="middle"
                        fill="#F87171"
                        fontSize="7"
                        fontFamily="JetBrains Mono"
                      >
                        ℞
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Tooltip */}
              {hoveredPlanet && (
                <g>
                  <foreignObject
                    x={Math.min(hoveredPlanet.x + 12, SIZE - 170)}
                    y={Math.max(hoveredPlanet.y - 10, 5)}
                    width="160"
                    height="120"
                  >
                    <div
                      style={{
                        background: "oklch(0.13 0.02 265 / 0.95)",
                        border: "1px solid oklch(0.35 0.06 240 / 0.5)",
                        borderRadius: "8px",
                        padding: "8px",
                        fontFamily: "JetBrains Mono, monospace",
                        fontSize: "10px",
                        color: "oklch(0.9 0.02 265)",
                        backdropFilter: "blur(12px)",
                      }}
                    >
                      <div
                        style={{
                          color: PLANET_COLORS[hoveredPlanet.body] ?? "#fff",
                          fontWeight: "600",
                          marginBottom: "4px",
                        }}
                      >
                        {PLANET_GLYPHS[hoveredPlanet.body]} {hoveredPlanet.body}
                        {hoveredPlanet.isRetrograde && (
                          <span style={{ color: "#F87171" }}> ℞</span>
                        )}
                      </div>
                      <div
                        style={{
                          color: "oklch(0.6 0.04 265)",
                          fontSize: "9px",
                        }}
                      >
                        {hoveredPlanet.sign} {hoveredPlanet.degree.toFixed(1)}°
                      </div>
                      <div
                        style={{
                          color: "oklch(0.6 0.04 265)",
                          fontSize: "9px",
                        }}
                      >
                        Lon: {hoveredPlanet.longitude.toFixed(2)}°
                      </div>
                      {hoveredPlanet.aspects.slice(0, 2).map((a) => (
                        <div
                          key={a}
                          style={{
                            color: "oklch(0.55 0.04 265)",
                            fontSize: "8px",
                            marginTop: "2px",
                          }}
                        >
                          {a}
                        </div>
                      ))}
                    </div>
                  </foreignObject>
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* Planet list */}
        <div className="flex-1 min-w-0">
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
            Planetary Positions
          </h3>
          <div className="space-y-1">
            {planetPositions.map((p) => {
              const color = PLANET_COLORS[p.body] ?? "#888";
              return (
                <div
                  key={p.body}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 glass border border-border/20
                    hover:border-border/40 transition-colors duration-150"
                >
                  <span
                    className="text-base flex-shrink-0 w-5 text-center"
                    style={{ color, textShadow: `0 0 6px ${color}` }}
                  >
                    {PLANET_GLYPHS[p.body]}
                  </span>
                  <span className="font-mono text-xs text-foreground w-16">
                    {p.body}
                    {p.isRetro && (
                      <span className="text-red-400 ml-1 text-[9px]">℞</span>
                    )}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground flex-1">
                    {p.sign} {p.degree.toFixed(1)}°
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground/60">
                    {p.lon.toFixed(1)}°
                  </span>
                </div>
              );
            })}
          </div>

          {/* Aspect summary */}
          <div className="mt-4">
            <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">
              Active Aspects ({aspects.length})
            </h3>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {aspects.map((a) => {
                const color = ASPECT_COLORS[a.aspectType] ?? "#888";
                return (
                  <div
                    key={`${a.body1}-${a.body2}-${a.aspectType}`}
                    className="flex items-center gap-2 rounded px-2 py-1 bg-muted/20"
                  >
                    <span
                      className="font-mono text-xs w-4"
                      style={{
                        color: PLANET_COLORS[a.body1] ?? "#fff",
                      }}
                    >
                      {PLANET_GLYPHS[a.body1]}
                    </span>
                    <span
                      className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                      style={{
                        color,
                        background: `${color}18`,
                        border: `1px solid ${color}30`,
                      }}
                    >
                      {a.aspectType}
                    </span>
                    <span
                      className="font-mono text-xs w-4"
                      style={{
                        color: PLANET_COLORS[a.body2] ?? "#fff",
                      }}
                    >
                      {PLANET_GLYPHS[a.body2]}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground ml-auto">
                      {a.orb.toFixed(1)}° orb
                    </span>
                  </div>
                );
              })}
              {aspects.length === 0 && (
                <div className="font-mono text-xs text-muted-foreground text-center py-2">
                  No major aspects active
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
