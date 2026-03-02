// Simplified astronomical calculations using mean motion / Keplerian approximations
// Reference epoch: J2000.0 = January 1.5, 2000 UTC = Unix 946728000

export const J2000_UNIX = 946728000;

// Orbital periods in days
export const ORBITAL_PERIODS: Record<string, number> = {
  Sun: 365.25, // Earth's orbital period (for Sun's apparent motion)
  Moon: 27.321661,
  Mercury: 87.969,
  Venus: 224.701,
  Earth: 365.25,
  Mars: 686.971,
  Jupiter: 4332.589,
  Saturn: 10759.22,
  Uranus: 30688.5,
  Neptune: 60195.0,
  Pluto: 90560.0,
};

// Known ecliptic longitudes at J2000.0 (degrees)
const J2000_LONGITUDES: Record<string, number> = {
  Sun: 280.46, // Mean longitude
  Moon: 218.316, // Mean longitude
  Mercury: 252.25,
  Venus: 181.979,
  Earth: 100.464,
  Mars: 355.433,
  Jupiter: 34.351,
  Saturn: 50.077,
  Uranus: 314.055,
  Neptune: 304.349,
  Pluto: 238.958,
};

// Orbital inclinations (degrees relative to ecliptic)
const ORBITAL_INCLINATIONS: Record<string, number> = {
  Sun: 0,
  Moon: 5.145,
  Mercury: 7.005,
  Venus: 3.395,
  Earth: 0,
  Mars: 1.85,
  Jupiter: 1.303,
  Saturn: 2.489,
  Uranus: 0.773,
  Neptune: 1.77,
  Pluto: 17.14,
};

// Semi-major axes (AU)
export const SEMI_MAJOR_AXES: Record<string, number> = {
  Sun: 0,
  Moon: 0.00257, // relative to Earth
  Mercury: 0.387,
  Venus: 0.723,
  Earth: 1.0,
  Mars: 1.524,
  Jupiter: 5.203,
  Saturn: 9.537,
  Uranus: 19.19,
  Neptune: 30.07,
  Pluto: 39.48,
};

// Eccentricities
const ECCENTRICITIES: Record<string, number> = {
  Sun: 0,
  Moon: 0.0549,
  Mercury: 0.2056,
  Venus: 0.0068,
  Earth: 0.0167,
  Mars: 0.0934,
  Jupiter: 0.0489,
  Saturn: 0.0566,
  Uranus: 0.0457,
  Neptune: 0.0113,
  Pluto: 0.2488,
};

function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

// Simplified mean longitude computation
export function getPlanetLongitude(body: string, timestamp: number): number {
  const period = ORBITAL_PERIODS[body];
  const startLon = J2000_LONGITUDES[body];
  if (period === undefined || startLon === undefined) return 0;

  const daysSinceJ2000 = (timestamp - J2000_UNIX) / 86400;
  const meanMotion = 360 / period; // degrees per day
  return normalizeAngle(startLon + meanMotion * daysSinceJ2000);
}

export interface PlanetPosition {
  longitude: number;
  latitude: number;
  distance: number; // AU
}

export function getPlanetaryPositions(
  timestamp: number,
): Record<string, PlanetPosition> {
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

  const result: Record<string, PlanetPosition> = {};
  for (const body of bodies) {
    const lon = getPlanetLongitude(body, timestamp);
    const inc = ORBITAL_INCLINATIONS[body] ?? 0;
    const ecc = ECCENTRICITIES[body] ?? 0;
    const sma = SEMI_MAJOR_AXES[body] ?? 1;

    // Simplified latitude from inclination
    const period = ORBITAL_PERIODS[body];
    const daysSinceJ2000 = (timestamp - J2000_UNIX) / 86400;
    const meanAngle = ((daysSinceJ2000 / period) * 2 * Math.PI) % (2 * Math.PI);
    const lat = inc * Math.sin(meanAngle);

    // Simplified distance with eccentricity
    const dist = sma * (1 - ecc * Math.cos(meanAngle));

    result[body] = { longitude: lon, latitude: lat, distance: dist };
  }
  return result;
}

// Moon phase calculation
export interface MoonPhaseResult {
  phase: string;
  illumination: number; // 0-100
  angle: number; // 0-360
}

const MOON_PHASE_NAMES = [
  "New Moon",
  "Waxing Crescent",
  "First Quarter",
  "Waxing Gibbous",
  "Full Moon",
  "Waning Gibbous",
  "Last Quarter",
  "Waning Crescent",
];

export function getMoonPhase(timestamp: number): MoonPhaseResult {
  const sunLon = getPlanetLongitude("Sun", timestamp);
  const moonLon = getPlanetLongitude("Moon", timestamp);
  const angle = normalizeAngle(moonLon - sunLon);

  // Illumination fraction
  const illumination = ((1 - Math.cos((angle * Math.PI) / 180)) / 2) * 100;

  // Phase name based on angle
  const phaseIndex = Math.floor((angle / 360) * 8) % 8;
  const phase = MOON_PHASE_NAMES[phaseIndex];

  return { phase, illumination, angle };
}

// Aspect computation
export interface AspectEvent {
  body1: string;
  body2: string;
  aspectType: string;
  orb: number;
  angle: number;
}

const ASPECTS: Array<{ name: string; angle: number; orb: number }> = [
  { name: "Conjunction", angle: 0, orb: 8 },
  { name: "Opposition", angle: 180, orb: 8 },
  { name: "Trine", angle: 120, orb: 6 },
  { name: "Square", angle: 90, orb: 6 },
  { name: "Sextile", angle: 60, orb: 4 },
  { name: "Quincunx", angle: 150, orb: 3 },
];

export function computeAspects(timestamp: number): AspectEvent[] {
  const positions = getPlanetaryPositions(timestamp);
  const bodies = Object.keys(positions);
  const aspects: AspectEvent[] = [];

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const b1 = bodies[i];
      const b2 = bodies[j];
      const lon1 = positions[b1].longitude;
      const lon2 = positions[b2].longitude;
      const diff = Math.abs(normalizeAngle(lon2 - lon1 + 180) - 180);

      for (const aspect of ASPECTS) {
        const orb = Math.abs(diff - aspect.angle);
        if (orb <= aspect.orb) {
          aspects.push({
            body1: b1,
            body2: b2,
            aspectType: aspect.name,
            orb,
            angle: diff,
          });
        }
      }
    }
  }

  return aspects;
}

// Retrograde detection using finite difference of longitude
export function getRetrogradeStatus(body: string, timestamp: number): boolean {
  const dt = 86400; // 1 day
  const lon1 = getPlanetLongitude(body, timestamp - dt);
  const lon2 = getPlanetLongitude(body, timestamp + dt);

  // Unwrap angles to detect retrograde
  let diff = lon2 - lon1;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  return diff < 0;
}

// Pearson correlation coefficient
export function computePearsonCorrelation(
  series1: number[],
  series2: number[],
): number {
  const n = Math.min(series1.length, series2.length);
  if (n < 3) return 0;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += series1[i];
    sumY += series2[i];
    sumXY += series1[i] * series2[i];
    sumX2 += series1[i] * series1[i];
    sumY2 += series2[i] * series2[i];
  }
  const num = n * sumXY - sumX * sumY;
  const denom = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY),
  );
  if (denom === 0) return 0;
  return num / denom;
}

export interface RollingPoint {
  t: number;
  r: number;
}

export function computeRollingCorrelation(
  series1: Array<{ t: number; v: number }>,
  series2: Array<{ t: number; v: number }>,
  windowDays: number,
): RollingPoint[] {
  const windowSeconds = windowDays * 86400;
  const result: RollingPoint[] = [];

  // Align and sort by time
  const aligned: Array<{ t: number; v1: number; v2: number }> = [];
  const map1 = new Map(series1.map((p) => [Math.floor(p.t / 86400), p.v]));
  const map2 = new Map(series2.map((p) => [Math.floor(p.t / 86400), p.v]));

  const allDays = Array.from(new Set([...map1.keys(), ...map2.keys()])).sort();
  for (const day of allDays) {
    if (map1.has(day) && map2.has(day)) {
      aligned.push({ t: day * 86400, v1: map1.get(day)!, v2: map2.get(day)! });
    }
  }

  const windowPoints = Math.floor(windowSeconds / 86400);
  for (let i = windowPoints; i < aligned.length; i++) {
    const window1 = aligned.slice(i - windowPoints, i).map((p) => p.v1);
    const window2 = aligned.slice(i - windowPoints, i).map((p) => p.v2);
    result.push({
      t: aligned[i].t,
      r: computePearsonCorrelation(window1, window2),
    });
  }
  return result;
}

// Compute major astrological events for a time range
export interface AstroEvent {
  timestamp: number;
  label: string;
  type:
    | "conjunction"
    | "eclipse"
    | "retrograde_start"
    | "retrograde_end"
    | "full_moon"
    | "new_moon"
    | "opposition";
  body1?: string;
  body2?: string;
}

export function computeAstroEvents(
  startUnix: number,
  endUnix: number,
): AstroEvent[] {
  const events: AstroEvent[] = [];
  const stepDays = 1;
  const stepSeconds = stepDays * 86400;

  // Track previous states for transitions
  let prevMoonPhaseAngle = -1;
  let prevMercuryRetrograde = false;
  let prevVenusRetrograde = false;
  let prevMarsRetrograde = false;
  let prevJupiterSaturnDiff = -1;

  for (let ts = startUnix; ts <= endUnix; ts += stepSeconds) {
    const moonPhase = getMoonPhase(ts);

    // Full Moon (angle crosses ~180)
    if (
      prevMoonPhaseAngle > 0 &&
      prevMoonPhaseAngle < 170 &&
      moonPhase.angle >= 170 &&
      moonPhase.angle <= 190
    ) {
      events.push({
        timestamp: ts,
        label: "Full Moon",
        type: "full_moon",
        body1: "Moon",
      });
    }

    // New Moon (angle crosses 0/360)
    if (prevMoonPhaseAngle > 350 && moonPhase.angle < 10) {
      events.push({
        timestamp: ts,
        label: "New Moon",
        type: "new_moon",
        body1: "Moon",
      });
    }

    prevMoonPhaseAngle = moonPhase.angle;

    // Mercury retrograde transitions
    const mercuryRetro = getRetrogradeStatus("Mercury", ts);
    if (mercuryRetro && !prevMercuryRetrograde) {
      events.push({
        timestamp: ts,
        label: "Mercury Retrograde",
        type: "retrograde_start",
        body1: "Mercury",
      });
    } else if (!mercuryRetro && prevMercuryRetrograde) {
      events.push({
        timestamp: ts,
        label: "Mercury Direct",
        type: "retrograde_end",
        body1: "Mercury",
      });
    }
    prevMercuryRetrograde = mercuryRetro;

    // Venus retrograde transitions (every ~584 days)
    const venusRetro = getRetrogradeStatus("Venus", ts);
    if (venusRetro && !prevVenusRetrograde) {
      events.push({
        timestamp: ts,
        label: "Venus Retrograde",
        type: "retrograde_start",
        body1: "Venus",
      });
    } else if (!venusRetro && prevVenusRetrograde) {
      events.push({
        timestamp: ts,
        label: "Venus Direct",
        type: "retrograde_end",
        body1: "Venus",
      });
    }
    prevVenusRetrograde = venusRetro;

    // Mars retrograde
    const marsRetro = getRetrogradeStatus("Mars", ts);
    if (marsRetro && !prevMarsRetrograde) {
      events.push({
        timestamp: ts,
        label: "Mars Retrograde",
        type: "retrograde_start",
        body1: "Mars",
      });
    } else if (!marsRetro && prevMarsRetrograde) {
      events.push({
        timestamp: ts,
        label: "Mars Direct",
        type: "retrograde_end",
        body1: "Mars",
      });
    }
    prevMarsRetrograde = marsRetro;

    // Jupiter-Saturn conjunction (approx every 20 years)
    const jupLon = getPlanetLongitude("Jupiter", ts);
    const satLon = getPlanetLongitude("Saturn", ts);
    const jsDiff = Math.abs(normalizeAngle(jupLon - satLon + 180) - 180);
    if (prevJupiterSaturnDiff > 0 && jsDiff < 2 && prevJupiterSaturnDiff >= 2) {
      events.push({
        timestamp: ts,
        label: "Jupiter-Saturn Conjunction",
        type: "conjunction",
        body1: "Jupiter",
        body2: "Saturn",
      });
    }
    prevJupiterSaturnDiff = jsDiff;
  }

  return events;
}

// Zodiac signs
export const ZODIAC_SIGNS = [
  { name: "Aries", symbol: "♈", start: 0, glyph: "♈︎" },
  { name: "Taurus", symbol: "♉", start: 30, glyph: "♉︎" },
  { name: "Gemini", symbol: "♊", start: 60, glyph: "♊︎" },
  { name: "Cancer", symbol: "♋", start: 90, glyph: "♋︎" },
  { name: "Leo", symbol: "♌", start: 120, glyph: "♌︎" },
  { name: "Virgo", symbol: "♍", start: 150, glyph: "♍︎" },
  { name: "Libra", symbol: "♎", start: 180, glyph: "♎︎" },
  { name: "Scorpio", symbol: "♏", start: 210, glyph: "♏︎" },
  { name: "Sagittarius", symbol: "♐", start: 240, glyph: "♐︎" },
  { name: "Capricorn", symbol: "♑", start: 270, glyph: "♑︎" },
  { name: "Aquarius", symbol: "♒", start: 300, glyph: "♒︎" },
  { name: "Pisces", symbol: "♓", start: 330, glyph: "♓︎" },
];

export function getZodiacSign(longitude: number): {
  name: string;
  symbol: string;
  degree: number;
} {
  const idx = Math.floor(longitude / 30) % 12;
  const sign = ZODIAC_SIGNS[idx];
  return { name: sign.name, symbol: sign.symbol, degree: longitude % 30 };
}

// Planet glyphs
export const PLANET_GLYPHS: Record<string, string> = {
  Sun: "☉",
  Moon: "☽",
  Mercury: "☿",
  Venus: "♀",
  Mars: "♂",
  Jupiter: "♃",
  Saturn: "♄",
  Uranus: "♅",
  Neptune: "♆",
  Pluto: "♇",
};

// Planet colors
export const PLANET_COLORS: Record<string, string> = {
  Sun: "#FFD700",
  Moon: "#C8C8D4",
  Mercury: "#B5B5B5",
  Venus: "#E8C070",
  Earth: "#4A90D9",
  Mars: "#E05A30",
  Jupiter: "#C88060",
  Saturn: "#D4AA70",
  Uranus: "#7FCFC0",
  Neptune: "#5080C8",
  Pluto: "#9B8060",
};

// Aspect colors
export const ASPECT_COLORS: Record<string, string> = {
  Conjunction: "#FFFFFF",
  Opposition: "#FF4040",
  Trine: "#4080FF",
  Square: "#FF8000",
  Sextile: "#40C060",
  Quincunx: "#C040C0",
};

// Precession cycle (26,000 years)
export function getPrecessionAngle(timestamp: number): number {
  const PRECESSION_PERIOD = 26000 * 365.25 * 86400;
  // Reference: approximately year 2000 = ~150° into the cycle
  const elapsed = timestamp - J2000_UNIX;
  return normalizeAngle(150 + (elapsed / PRECESSION_PERIOD) * 360);
}

// Galactic center alignment (currently ~26° Sagittarius = 266°)
export function getGalacticCenterDistance(timestamp: number): number {
  const sunLon = getPlanetLongitude("Sun", timestamp);
  const GALACTIC_CENTER = 266;
  const diff = Math.abs(normalizeAngle(sunLon - GALACTIC_CENTER + 180) - 180);
  return diff;
}

// ─── Aspect Event Correlation Engine ──────────────────────────────────────────

export interface AspectEventWindow {
  eventTimestamp: number;
  aspectType: string;
  body1: string;
  body2: string;
  marketReturn: number; // price change % in window
}

export interface AspectCorrelationResult {
  aspectType: string;
  body1: string;
  body2: string;
  market: string;
  windowDays: number;
  avgReturn: number; // mean % return in window
  stdDev: number;
  tStat: number;
  pValue: number; // approximate
  sampleCount: number;
  significance: string; // "***", "**", "*", "†", "ns"
}

function approximatePValue(tStat: number): number {
  const absT = Math.abs(tStat);
  if (absT > 4) return 0.0001;
  if (absT > 3.3) return 0.001;
  if (absT > 2.6) return 0.01;
  if (absT > 2.0) return 0.05;
  if (absT > 1.6) return 0.1;
  return 0.2 + (2 - Math.min(absT, 2)) * 0.3;
}

function pValueToSignificance(p: number): string {
  if (p < 0.001) return "***";
  if (p < 0.01) return "**";
  if (p < 0.05) return "*";
  if (p < 0.1) return "†";
  return "ns";
}

function getWindowReturn(
  marketId: string,
  centerTs: number,
  windowDays: number,
  generateMarketDataFn: (
    id: string,
    start: number,
    end: number,
    n: number,
  ) => Array<{ timestamp: number; value: number }>,
): number {
  const halfWindow = Math.floor(windowDays / 2) * 86400;
  const startTs = centerTs - halfWindow;
  const endTs = centerTs + halfWindow;
  const pts = generateMarketDataFn(marketId, startTs, endTs, 3);
  if (pts.length < 2) return 0;
  const first = pts[0].value;
  const last = pts[pts.length - 1].value;
  if (first === 0) return 0;
  return ((last - first) / first) * 100;
}

export function computeAspectEventCorrelation(
  aspectEvents: Array<{
    timestamp: number;
    aspectType: string;
    body1: string;
    body2: string;
  }>,
  marketId: string,
  windowDays: number,
  getMarketReturnFn: (
    marketId: string,
    centerTimestamp: number,
    windowDays: number,
  ) => number,
): AspectCorrelationResult {
  const firstEvent = aspectEvents[0];
  const aspectType = firstEvent?.aspectType ?? "";
  const body1 = firstEvent?.body1 ?? "";
  const body2 = firstEvent?.body2 ?? "";

  // Collect all market returns for the event windows
  const returns: number[] = aspectEvents.map((ev) =>
    getMarketReturnFn(marketId, ev.timestamp, windowDays),
  );

  const n = returns.length;
  const avgReturn = n > 0 ? returns.reduce((s, v) => s + v, 0) / n : 0;

  // Standard deviation
  const variance =
    n > 1 ? returns.reduce((s, v) => s + (v - avgReturn) ** 2, 0) / (n - 1) : 0;
  const stdDev = Math.sqrt(variance);

  // t-statistic: mean / (stdDev / sqrt(n))
  const tStat = stdDev > 0 ? avgReturn / (stdDev / Math.sqrt(n)) : 0;
  const pValue = approximatePValue(tStat);
  const significance = pValueToSignificance(pValue);

  return {
    aspectType,
    body1,
    body2,
    market: marketId,
    windowDays,
    avgReturn,
    stdDev,
    tStat,
    pValue,
    sampleCount: n,
    significance,
  };
}

export function runAspectEventStudy(
  startUnix: number,
  endUnix: number,
  marketIds: string[],
  windowDays: number,
  generateMarketDataFn: (
    id: string,
    start: number,
    end: number,
    n: number,
  ) => Array<{ timestamp: number; value: number }>,
): AspectCorrelationResult[] {
  // 1. Generate all astrological events in the range
  const rawEvents = computeAstroEvents(startUnix, endUnix);

  // Normalise raw AstroEvents into the aspect event format
  interface AspectInput {
    timestamp: number;
    aspectType: string;
    body1: string;
    body2: string;
  }

  const aspectInputs: AspectInput[] = rawEvents
    .filter((e) => e.body1 !== undefined)
    .map((e) => ({
      timestamp: e.timestamp,
      aspectType: e.type,
      body1: e.body1 ?? "",
      body2: e.body2 ?? "",
    }));

  // 2. Group events by aspectType + body1 + body2
  const groups = new Map<string, AspectInput[]>();
  for (const ev of aspectInputs) {
    const key = `${ev.aspectType}||${ev.body1}||${ev.body2}`;
    const existing = groups.get(key);
    if (existing) {
      existing.push(ev);
    } else {
      groups.set(key, [ev]);
    }
  }

  // Helper to get window return for a market+center+window
  const returnFn = (
    marketId: string,
    centerTs: number,
    wDays: number,
  ): number => getWindowReturn(marketId, centerTs, wDays, generateMarketDataFn);

  const results: AspectCorrelationResult[] = [];

  // 3. For each (market, aspectGroup) pair compute correlation
  for (const [, events] of groups.entries()) {
    if (events.length < 3) continue; // minimum sample requirement
    for (const marketId of marketIds) {
      const result = computeAspectEventCorrelation(
        events,
        marketId,
        windowDays,
        returnFn,
      );
      if (result.sampleCount >= 3) {
        results.push(result);
      }
    }
  }

  // 4. Sort by p-value ascending (most significant first)
  return results.sort((a, b) => a.pValue - b.pValue);
}
