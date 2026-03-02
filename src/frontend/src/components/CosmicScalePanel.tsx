import { format } from "date-fns";
import { useAppStore } from "../store/useAppStore";
import {
  ZODIAC_SIGNS,
  getGalacticCenterDistance,
  getPlanetLongitude,
  getPrecessionAngle,
} from "../utils/astroCalc";

// Notable fixed stars (ecliptic longitudes in J2000)
const FIXED_STARS = [
  { name: "Sirius", longitude: 104.0, color: "#A0E0FF" },
  { name: "Aldebaran", longitude: 70.0, color: "#FFD0A0" },
  { name: "Regulus", longitude: 150.0, color: "#FFFFFF" },
  { name: "Spica", longitude: 204.0, color: "#C0D0FF" },
  { name: "Antares", longitude: 250.0, color: "#FFA0A0" },
  { name: "Fomalhaut", longitude: 4.0, color: "#B0D0FF" },
  { name: "Algol", longitude: 56.0, color: "#FFE0E0" },
  { name: "Pleiades", longitude: 60.0, color: "#D0E0FF" },
];

// Astrological ages
const ASTROLOGICAL_AGES = [
  { name: "Aquarius", start: 2150, end: 4300, color: "#7FCFC0" },
  { name: "Pisces", start: 0, end: 2150, color: "#818CF8" },
  { name: "Aries", start: -2150, end: 0, color: "#E05A30" },
  { name: "Taurus", start: -4300, end: -2150, color: "#D4AA70" },
];

const SIZE = 360;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 150;

function polarToXY(r: number, angleDeg: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

export function CosmicScalePanel() {
  const { selectedTimestamp } = useAppStore();

  const precessionAngle = getPrecessionAngle(selectedTimestamp);
  const galacticDist = getGalacticCenterDistance(selectedTimestamp);
  const currentYear = new Date(selectedTimestamp * 1000).getFullYear();

  // Sun's longitude for fixed star proximity
  const sunLon = getPlanetLongitude("Sun", selectedTimestamp);

  // Current astrological age
  const currentAge =
    ASTROLOGICAL_AGES.find(
      (a) => currentYear >= a.start && currentYear < a.end,
    ) ?? ASTROLOGICAL_AGES[0];

  // Progress through Age of Aquarius transition
  const ageProgress = Math.max(
    0,
    Math.min(100, ((currentYear - 2000) / 150) * 100),
  );

  return (
    <div className="p-6 overflow-y-auto h-full space-y-6">
      <div>
        <h2 className="font-display font-semibold text-xl text-foreground">
          Cosmic Scale
        </h2>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Universal perspective — precession, galactic alignment, and fixed
          stars
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Precession Dial */}
        <div className="glass rounded-xl p-4 border border-border/40">
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Precession of Equinoxes
          </h3>
          <div className="flex items-center justify-center">
            <svg
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              width={SIZE}
              height={SIZE}
              role="img"
              aria-label="Precession of Equinoxes dial"
            >
              {/* Background */}
              <circle
                cx={CX}
                cy={CY}
                r={R}
                fill="oklch(0.08 0.01 265)"
                stroke="oklch(0.3 0.05 265 / 0.4)"
                strokeWidth="1"
              />

              {/* 26,000 year cycle markers */}
              {Array.from({ length: 12 }, (_, i) => {
                const angle = i * 30 - 90;
                const [x1, y1] = polarToXY(R - 8, angle);
                const [x2, y2] = polarToXY(R, angle);
                const [lx, ly] = polarToXY(R - 20, angle);
                const sign = ZODIAC_SIGNS[i];
                return (
                  <g key={sign?.name ?? `sign-${angle}`}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="oklch(0.35 0.06 265 / 0.5)"
                      strokeWidth="1"
                    />
                    <text
                      x={lx}
                      y={ly}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="oklch(0.5 0.04 265)"
                      fontSize="8"
                      fontFamily="JetBrains Mono"
                    >
                      {sign?.symbol}
                    </text>
                  </g>
                );
              })}

              {/* Age sectors */}
              {ASTROLOGICAL_AGES.map((age, i) => {
                const startDeg = i * 90 - 90;
                const endDeg = startDeg + 90;
                const [sx, sy] = polarToXY(R * 0.65, startDeg);
                const [ex, ey] = polarToXY(R * 0.65, endDeg);
                const isLarge = endDeg - startDeg > 180;
                const pathD = `M ${CX} ${CY} L ${sx} ${sy} A ${R * 0.65} ${R * 0.65} 0 ${isLarge ? 1 : 0} 1 ${ex} ${ey} Z`;
                const [mx, my] = polarToXY(R * 0.45, startDeg + 45);
                return (
                  <g key={age.name}>
                    <path
                      d={pathD}
                      fill={`${age.color}15`}
                      stroke={`${age.color}30`}
                      strokeWidth="0.5"
                    />
                    <text
                      x={mx}
                      y={my}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={age.color}
                      fontSize="9"
                      fontFamily="JetBrains Mono"
                      opacity="0.6"
                    >
                      {age.name}
                    </text>
                  </g>
                );
              })}

              {/* Precession pointer */}
              {(() => {
                const [px, py] = polarToXY(R * 0.75, precessionAngle - 90);
                return (
                  <line
                    x1={CX}
                    y1={CY}
                    x2={px}
                    y2={py}
                    stroke="#7FCFC0"
                    strokeWidth="2"
                    strokeLinecap="round"
                    style={{ filter: "drop-shadow(0 0 4px #7FCFC0)" }}
                  />
                );
              })()}

              {/* Center dot */}
              <circle
                cx={CX}
                cy={CY}
                r="4"
                fill="#7FCFC0"
                style={{ filter: "drop-shadow(0 0 6px #7FCFC0)" }}
              />

              {/* Labels */}
              <text
                x={CX}
                y={CY + R + 12}
                textAnchor="middle"
                fill="oklch(0.5 0.04 265)"
                fontSize="8"
                fontFamily="JetBrains Mono"
              >
                26,000 year cycle
              </text>
            </svg>
          </div>
          <div className="mt-2 text-center font-mono text-xs text-muted-foreground">
            Current position:{" "}
            <span className="text-neon-teal">
              {precessionAngle.toFixed(1)}°
            </span>
          </div>
        </div>

        {/* Galactic alignment + Astrological Age */}
        <div className="space-y-4">
          {/* Galactic alignment */}
          <div className="glass rounded-xl p-4 border border-border/40">
            <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
              Galactic Center Alignment
            </h3>
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-full border-2 flex items-center justify-center"
                style={{
                  borderColor:
                    galacticDist < 5 ? "#FFD700" : "oklch(0.3 0.05 265)",
                  background: `radial-gradient(circle, oklch(0.65 0.22 240 / ${Math.max(0, ((10 - galacticDist) / 10) * 0.3)}) 0%, transparent 70%)`,
                }}
              >
                <span className="font-mono text-xs text-center leading-tight">
                  <span
                    className={
                      galacticDist < 5
                        ? "text-yellow-400"
                        : "text-muted-foreground"
                    }
                  >
                    {galacticDist.toFixed(1)}°
                  </span>
                </span>
              </div>
              <div>
                <p className="font-mono text-xs text-foreground">
                  Sun is{" "}
                  <span className="text-neon-blue">
                    {galacticDist.toFixed(1)}°
                  </span>{" "}
                  from Galactic Center
                </p>
                <p className="font-mono text-[10px] text-muted-foreground mt-1">
                  Galactic Center: ~266° (26° Sagittarius)
                </p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  Sun at:{" "}
                  <span className="text-neon-teal">{sunLon.toFixed(1)}°</span>
                </p>
                {galacticDist < 5 && (
                  <p className="font-mono text-[10px] text-yellow-400 mt-1">
                    ⚠ Near galactic alignment!
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Astrological Age */}
          <div className="glass rounded-xl p-4 border border-border/40">
            <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
              Astrological Age
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span
                    className="font-mono text-lg font-semibold"
                    style={{ color: currentAge.color }}
                  >
                    Age of {currentAge.name}
                  </span>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {currentAge.start > 0
                      ? `${currentAge.start} CE`
                      : `${Math.abs(currentAge.start)} BCE`}{" "}
                    — {currentAge.end} CE
                  </p>
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  Year {currentYear}
                </div>
              </div>

              <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${ageProgress}%`,
                    background: `linear-gradient(to right, ${currentAge.color}60, ${currentAge.color})`,
                  }}
                />
              </div>
              <p className="font-mono text-[9px] text-muted-foreground">
                {ageProgress.toFixed(1)}% through transition to Age of Aquarius
              </p>
            </div>
          </div>

          {/* Fixed Stars */}
          <div className="glass rounded-xl p-4 border border-border/40">
            <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
              Notable Fixed Stars
            </h3>
            <div className="space-y-1">
              {FIXED_STARS.map((star) => {
                const distFromSun = Math.abs(
                  ((star.longitude - sunLon + 180 + 360) % 360) - 180,
                );
                return (
                  <div
                    key={star.name}
                    className="flex items-center gap-2 text-[10px] font-mono"
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: star.color,
                        boxShadow: `0 0 4px ${star.color}`,
                      }}
                    />
                    <span className="text-foreground w-20">{star.name}</span>
                    <span className="text-muted-foreground w-16">
                      {star.longitude}° ecl.
                    </span>
                    <span
                      className={
                        distFromSun < 5
                          ? "text-yellow-400 font-semibold"
                          : "text-muted-foreground/60"
                      }
                    >
                      ☉ {distFromSun.toFixed(1)}° away
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Milky Way scale diagram */}
      <div className="glass rounded-xl p-4 border border-border/40">
        <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
          Milky Way Scale — Sun&apos;s Position
        </h3>
        <div className="flex justify-center">
          <svg
            viewBox="0 0 600 160"
            width="100%"
            className="max-w-2xl"
            role="img"
            aria-label="Milky Way scale diagram showing Sun's position"
          >
            {/* Galaxy shape */}
            <ellipse
              cx="300"
              cy="80"
              rx="260"
              ry="45"
              fill="none"
              stroke="oklch(0.3 0.04 265 / 0.4)"
              strokeWidth="1"
            />
            <ellipse
              cx="300"
              cy="80"
              rx="200"
              ry="35"
              fill="oklch(0.2 0.04 240 / 0.1)"
              stroke="none"
            />
            <ellipse
              cx="300"
              cy="80"
              rx="130"
              ry="25"
              fill="oklch(0.25 0.06 240 / 0.15)"
              stroke="none"
            />
            <ellipse
              cx="300"
              cy="80"
              rx="60"
              ry="15"
              fill="oklch(0.35 0.1 240 / 0.2)"
              stroke="none"
            />
            {/* Center bulge */}
            <ellipse
              cx="300"
              cy="80"
              rx="20"
              ry="20"
              fill="oklch(0.55 0.15 240 / 0.3)"
              stroke="none"
            />

            {/* Spiral arms (simplified) */}
            {Array.from({ length: 24 }, (_, i) => {
              const angle = (i / 24) * Math.PI * 2;
              const r1 = 30 + i * 7;
              const r2 = 25 + i * 6.5;
              const x1 = 300 + Math.cos(angle) * r1 * 0.85;
              const y1 = 80 + Math.sin(angle) * r1 * 0.15;
              const x2 = 300 + Math.cos(angle + 0.3) * r2 * 0.85;
              const y2 = 80 + Math.sin(angle + 0.3) * r2 * 0.15;
              return (
                <line
                  key={`spiral-${i}-${r1}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="oklch(0.65 0.18 240 / 0.3)"
                  strokeWidth="1"
                />
              );
            })}

            {/* Sun position marker */}
            <circle
              cx="425"
              cy="80"
              r="4"
              fill="#FFD700"
              style={{ filter: "drop-shadow(0 0 6px #FFD700)" }}
            />
            <text
              x="425"
              y="96"
              textAnchor="middle"
              fill="#FFD700"
              fontSize="8"
              fontFamily="JetBrains Mono"
            >
              ☉ Sun
            </text>
            <text
              x="425"
              y="106"
              textAnchor="middle"
              fill="oklch(0.5 0.04 265)"
              fontSize="7"
              fontFamily="JetBrains Mono"
            >
              26,000 ly from center
            </text>

            {/* Galactic center label */}
            <text
              x="300"
              y="50"
              textAnchor="middle"
              fill="oklch(0.7 0.12 240)"
              fontSize="8"
              fontFamily="JetBrains Mono"
            >
              Galactic Center
            </text>
            <text
              x="300"
              y="130"
              textAnchor="middle"
              fill="oklch(0.4 0.04 265)"
              fontSize="7"
              fontFamily="JetBrains Mono"
            >
              Milky Way Galaxy — ~100,000 light-years across
            </text>

            {/* Scale bar */}
            <line
              x1="50"
              y1="150"
              x2="150"
              y2="150"
              stroke="oklch(0.4 0.04 265)"
              strokeWidth="1"
            />
            <text
              x="100"
              y="145"
              textAnchor="middle"
              fill="oklch(0.4 0.04 265)"
              fontSize="7"
              fontFamily="JetBrains Mono"
            >
              25,000 ly
            </text>
          </svg>
        </div>
        <div className="mt-2 font-mono text-[10px] text-muted-foreground text-center">
          {format(new Date(selectedTimestamp * 1000), "MMMM d, yyyy")} —
          Galactic Center distance: {galacticDist.toFixed(2)}°
        </div>
      </div>
    </div>
  );
}
