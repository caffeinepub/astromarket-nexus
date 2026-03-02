export interface DataPoint {
  timestamp: number;
  value: number;
}

// Seeded pseudo-random for deterministic data
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 4294967296;
  };
}

export interface MarketConfig {
  basePrice: number;
  volatility: number;
  trend: number; // annual drift
  cycles: Array<{ period: number; amplitude: number; phase: number }>;
  seed: number;
}

const MARKET_CONFIGS: Record<string, MarketConfig> = {
  BTC: {
    basePrice: 100,
    volatility: 0.045,
    trend: 0.85,
    cycles: [
      { period: 1461, amplitude: 0.6, phase: 0.3 },
      { period: 365, amplitude: 0.25, phase: 1.2 },
      { period: 30, amplitude: 0.08, phase: 0 },
    ],
    seed: 42,
  },
  ETH: {
    basePrice: 30,
    volatility: 0.05,
    trend: 0.8,
    cycles: [
      { period: 1461, amplitude: 0.55, phase: 0.8 },
      { period: 365, amplitude: 0.22, phase: 2.0 },
      { period: 30, amplitude: 0.07, phase: 0.5 },
    ],
    seed: 43,
  },
  TOTAL_MCAP: {
    basePrice: 500,
    volatility: 0.04,
    trend: 0.75,
    cycles: [
      { period: 1461, amplitude: 0.5, phase: 0.5 },
      { period: 365, amplitude: 0.2, phase: 1.5 },
    ],
    seed: 44,
  },
  ALTSEASON: {
    basePrice: 35,
    volatility: 0.035,
    trend: 0.0,
    cycles: [
      { period: 1461, amplitude: 0.45, phase: 1.2 },
      { period: 180, amplitude: 0.3, phase: 0.8 },
      { period: 90, amplitude: 0.15, phase: 0.2 },
    ],
    seed: 45,
  },
  SP500: {
    basePrice: 1000,
    volatility: 0.012,
    trend: 0.1,
    cycles: [
      { period: 3650, amplitude: 0.15, phase: 0.0 },
      { period: 365, amplitude: 0.05, phase: 0.5 },
      { period: 30, amplitude: 0.02, phase: 0 },
    ],
    seed: 100,
  },
  NASDAQ: {
    basePrice: 2000,
    volatility: 0.015,
    trend: 0.12,
    cycles: [
      { period: 3650, amplitude: 0.18, phase: 0.2 },
      { period: 365, amplitude: 0.06, phase: 0.7 },
    ],
    seed: 101,
  },
  DAX: {
    basePrice: 4000,
    volatility: 0.013,
    trend: 0.09,
    cycles: [
      { period: 3650, amplitude: 0.12, phase: 0.4 },
      { period: 365, amplitude: 0.05, phase: 0.3 },
    ],
    seed: 102,
  },
  NIKKEI: {
    basePrice: 15000,
    volatility: 0.014,
    trend: 0.07,
    cycles: [
      { period: 3650, amplitude: 0.14, phase: 0.6 },
      { period: 365, amplitude: 0.05, phase: 1.0 },
    ],
    seed: 103,
  },
  FTSE: {
    basePrice: 5000,
    volatility: 0.011,
    trend: 0.06,
    cycles: [
      { period: 3650, amplitude: 0.1, phase: 0.8 },
      { period: 365, amplitude: 0.04, phase: 0.2 },
    ],
    seed: 104,
  },
  GOLD: {
    basePrice: 300,
    volatility: 0.01,
    trend: 0.06,
    cycles: [
      { period: 3650, amplitude: 0.2, phase: 1.5 },
      { period: 365, amplitude: 0.07, phase: 0.9 },
      { period: 27.32, amplitude: 0.01, phase: 0 },
    ],
    seed: 200,
  },
  SILVER: {
    basePrice: 5,
    volatility: 0.018,
    trend: 0.04,
    cycles: [
      { period: 3650, amplitude: 0.22, phase: 1.8 },
      { period: 365, amplitude: 0.09, phase: 1.2 },
    ],
    seed: 201,
  },
  OIL: {
    basePrice: 25,
    volatility: 0.02,
    trend: 0.03,
    cycles: [
      { period: 3650, amplitude: 0.35, phase: 0.7 },
      { period: 365, amplitude: 0.12, phase: 0.4 },
    ],
    seed: 202,
  },
  NATGAS: {
    basePrice: 3,
    volatility: 0.025,
    trend: 0.01,
    cycles: [
      { period: 365, amplitude: 0.4, phase: 3.14 }, // strong seasonal
      { period: 90, amplitude: 0.15, phase: 0.5 },
    ],
    seed: 203,
  },
  DXY: {
    basePrice: 95,
    volatility: 0.005,
    trend: 0.01,
    cycles: [
      { period: 3650, amplitude: 0.08, phase: 2.0 },
      { period: 365, amplitude: 0.025, phase: 0.6 },
    ],
    seed: 300,
  },
  VIX: {
    basePrice: 20,
    volatility: 0.04,
    trend: -0.02,
    cycles: [
      { period: 3650, amplitude: 0.5, phase: 1.0 },
      { period: 365, amplitude: 0.25, phase: 0.3 },
      { period: 30, amplitude: 0.15, phase: 0.8 },
    ],
    seed: 301,
  },
  FEAR_GREED: {
    basePrice: 50,
    volatility: 0.06,
    trend: 0.0,
    cycles: [
      { period: 180, amplitude: 0.4, phase: 0.5 },
      { period: 30, amplitude: 0.2, phase: 0.2 },
    ],
    seed: 302,
  },
};

const REFERENCE_UNIX = 946684800; // Jan 1, 2000

export function generateMarketData(
  marketId: string,
  startUnix: number,
  endUnix: number,
  numPoints: number,
): DataPoint[] {
  const config = MARKET_CONFIGS[marketId];
  if (!config) return [];

  const rand = seededRandom(config.seed + startUnix);
  const points: DataPoint[] = [];
  const totalDays = (endUnix - startUnix) / 86400;
  const stepSeconds = (endUnix - startUnix) / numPoints;
  const startDays = (startUnix - REFERENCE_UNIX) / 86400;
  const annualTrendPerDay = config.trend / 365;

  // Generate price path
  let logPrice = Math.log(config.basePrice);
  const dailySteps = Math.max(1, Math.floor(totalDays));

  // Pre-compute full path at daily resolution then downsample
  const fullPath: number[] = [Math.exp(logPrice)];

  for (let d = 1; d <= dailySteps; d++) {
    const noise = (rand() - 0.5) * 2 * config.volatility;
    let cycleSum = 0;
    for (const cycle of config.cycles) {
      const angle =
        (2 * Math.PI * (startDays + d)) / cycle.period + cycle.phase;
      cycleSum += cycle.amplitude * Math.sin(angle) * config.volatility * 0.5;
    }
    logPrice += annualTrendPerDay + noise + cycleSum;
    // Clamp to prevent negative prices
    if (marketId === "ALTSEASON" || marketId === "FEAR_GREED") {
      const pct = Math.max(0, Math.min(100, Math.exp(logPrice)));
      fullPath.push(pct);
    } else {
      fullPath.push(Math.max(0.01, Math.exp(logPrice)));
    }
  }

  // Downsample to numPoints
  for (let i = 0; i < numPoints; i++) {
    const frac = i / (numPoints - 1);
    const dayIdx = Math.floor(frac * (fullPath.length - 1));
    points.push({
      timestamp: Math.floor(startUnix + i * stepSeconds),
      value: fullPath[dayIdx],
    });
  }

  return points;
}

export function getLatestValue(marketId: string, timestamp: number): number {
  const points = generateMarketData(marketId, timestamp - 86400, timestamp, 2);
  return points.length > 0 ? points[points.length - 1].value : 0;
}

export function getMarketChange(
  marketId: string,
  timestamp: number,
  periodSeconds: number,
): { value: number; change: number; changePct: number } {
  const points = generateMarketData(
    marketId,
    timestamp - periodSeconds,
    timestamp,
    2,
  );
  if (points.length < 2) return { value: 0, change: 0, changePct: 0 };
  const current = points[points.length - 1].value;
  const previous = points[0].value;
  return {
    value: current,
    change: current - previous,
    changePct: ((current - previous) / previous) * 100,
  };
}

export { MARKET_CONFIGS };
