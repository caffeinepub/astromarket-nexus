import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAppStore } from "../store/useAppStore";
import {
  ORBITAL_PERIODS,
  PLANETARY_SYNODIC_PERIODS,
  computeDominantPeriods,
  computePhaseSync,
  getMoonPhase,
  getPlanetLongitude,
} from "../utils/astroCalc";
import { generateMarketData } from "../utils/marketData";

// ─── Constants ─────────────────────────────────────────────────────────────────

const MARKETS = [
  { id: "BTC", name: "Bitcoin" },
  { id: "ETH", name: "Ethereum" },
  { id: "SP500", name: "S&P 500" },
  { id: "GOLD", name: "Gold" },
  { id: "DXY", name: "DXY" },
  { id: "OIL", name: "Oil WTI" },
  { id: "ALTSEASON", name: "Altseason" },
];

const ASTRO_SERIES_LIST = [
  { id: "Jupiter", name: "Jupiter Longitude" },
  { id: "Saturn", name: "Saturn Longitude" },
  { id: "Mars", name: "Mars Longitude" },
  { id: "Moon_phase", name: "Moon Phase" },
  { id: "JS_angle", name: "Jupiter-Saturn Angle" },
  { id: "Venus", name: "Venus Longitude" },
  { id: "Mercury", name: "Mercury Longitude" },
  { id: "Uranus", name: "Uranus Longitude" },
  { id: "Neptune", name: "Neptune Longitude" },
];

type StudyWindow = "1Y" | "5Y" | "10Y" | "20Y";

const WINDOW_SECONDS: Record<StudyWindow, number> = {
  "1Y": 365 * 86400,
  "5Y": 5 * 365 * 86400,
  "10Y": 10 * 365 * 86400,
  "20Y": 20 * 365 * 86400,
};

const WINDOW_SAMPLE_RATE: Record<StudyWindow, number> = {
  "1Y": 1,
  "5Y": 3,
  "10Y": 7,
  "20Y": 14,
};

// Key planetary periods to mark on the spectrum
const PERIOD_MARKERS = [
  { period: 29.5, label: "Moon", color: "#C8C8D4" },
  { period: 87.9, label: "Mercury", color: "#B5B5B5" },
  { period: 115.9, label: "☿ syn", color: "#9CA3AF" },
  { period: 224.7, label: "Venus", color: "#E8C070" },
  { period: 365.25, label: "1 Year", color: "#FACC15" },
  { period: 398.9, label: "♃ syn", color: "#C88060" },
  { period: 583.9, label: "♀ syn", color: "#E8A040" },
  { period: 686.9, label: "Mars yr", color: "#E05A30" },
  { period: 779.9, label: "♂ syn", color: "#FB923C" },
  { period: 4332.6, label: "Jupiter", color: "#C88060" },
  { period: 7253, label: "♃-♄", color: "#D4AA70" },
  { period: 10759, label: "Saturn", color: "#D4AA70" },
];

// Planets for phase sync analysis
const PHASE_SYNC_PLANETS = [
  { id: "Moon", label: "Moon", period: 29.5 },
  { id: "Mercury", label: "Mercury", period: 87.9 },
  { id: "Venus", label: "Venus", period: 224.7 },
  { id: "Mars", label: "Mars", period: 686.9 },
  { id: "Jupiter", label: "Jupiter", period: 4332.6 },
  { id: "Saturn", label: "Saturn", period: 10759 },
  { id: "Sun-Mercury", label: "Sun-Mercury syn", period: 115.9 },
  { id: "Sun-Venus", label: "Sun-Venus syn", period: 583.9 },
  { id: "Sun-Mars", label: "Sun-Mars syn", period: 779.9 },
  { id: "Sun-Jupiter", label: "Sun-Jupiter syn", period: 398.9 },
  { id: "Jupiter-Saturn", label: "Jupiter-Saturn", period: 7253 },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getAstroValues(astroId: string, timestamps: number[]): number[] {
  return timestamps.map((ts) => {
    if (astroId === "Moon_phase") return getMoonPhase(ts).angle;
    if (astroId === "JS_angle") {
      const j = getPlanetLongitude("Jupiter", ts);
      const s = getPlanetLongitude("Saturn", ts);
      return Math.abs(j - s);
    }
    return getPlanetLongitude(astroId, ts);
  });
}

function syncColor(score: number): string {
  if (score > 0.7) return "#22D3EE";
  if (score > 0.4) return "#34D399";
  return "#6B7280";
}

function syncLabel(score: number): string {
  if (score > 0.7) return "Strong";
  if (score > 0.4) return "Moderate";
  return "Weak";
}

// ─── Custom Tooltip Components ────────────────────────────────────────────────

function SpectrumTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg px-3 py-2 border border-border/50 font-mono text-xs z-50">
      <div className="text-muted-foreground mb-1">
        Period: {label?.toFixed(1)} days
      </div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value?.toFixed(4)}
        </div>
      ))}
    </div>
  );
}

function SyncTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload: { label: string; period: number; score: number };
    value: number;
  }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="glass rounded-lg px-3 py-2 border border-border/50 font-mono text-xs z-50">
      <div className="text-foreground font-semibold">{d.label}</div>
      <div className="text-muted-foreground">
        Period: {d.period.toFixed(1)} days
      </div>
      <div style={{ color: syncColor(d.score) }}>
        Sync: {d.score.toFixed(3)} — {syncLabel(d.score)}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function CyclesPanel() {
  const { selectedTimestamp } = useAppStore();
  const [selectedMarket, setSelectedMarket] = useState("BTC");
  const [selectedAstro, setSelectedAstro] = useState("Jupiter");
  const [studyWindow, setStudyWindow] = useState<StudyWindow>("5Y");

  const endUnix = selectedTimestamp;
  const startUnix = endUnix - WINDOW_SECONDS[studyWindow];
  const sampleRateDays = WINDOW_SAMPLE_RATE[studyWindow];

  // Generate market + astro time series
  const { marketValues, astroValues } = useMemo(() => {
    const windowSeconds = WINDOW_SECONDS[studyWindow];
    const totalDays = windowSeconds / 86400;
    const numPoints = Math.min(500, Math.floor(totalDays / sampleRateDays));
    const stepSeconds = windowSeconds / numPoints;

    const ts = Array.from(
      { length: numPoints },
      (_, i) => startUnix + i * stepSeconds,
    );

    const mktPts = generateMarketData(
      selectedMarket,
      startUnix,
      endUnix,
      numPoints,
    );
    const mktVals = mktPts.map((p) => p.value);

    const astroVals = getAstroValues(selectedAstro, ts);

    return { marketValues: mktVals, astroValues: astroVals };
  }, [
    selectedMarket,
    selectedAstro,
    studyWindow,
    startUnix,
    endUnix,
    sampleRateDays,
  ]);

  // Compute power spectra
  const { marketSpectrum, combinedSpectrum } = useMemo(() => {
    const mktSpec = computeDominantPeriods(marketValues, sampleRateDays, 200);
    const astroSpec = computeDominantPeriods(astroValues, sampleRateDays, 200);

    // Build combined chart data: merge periods
    const periodSet = new Set<number>();
    for (const p of mktSpec) periodSet.add(Math.round(p.period));
    for (const p of astroSpec) periodSet.add(Math.round(p.period));

    const mktMap = new Map(mktSpec.map((p) => [Math.round(p.period), p.power]));
    const astroMap = new Map(
      astroSpec.map((p) => [Math.round(p.period), p.power]),
    );

    const combined = Array.from(periodSet)
      .sort((a, b) => a - b)
      .map((period) => ({
        period,
        market: mktMap.get(period) ?? 0,
        astro: astroMap.get(period) ?? 0,
      }));

    return {
      marketSpectrum: mktSpec,
      combinedSpectrum: combined,
    };
  }, [marketValues, astroValues, sampleRateDays]);

  // Compute phase synchronization scores
  const phaseSyncData = useMemo(() => {
    return PHASE_SYNC_PLANETS.map(({ id, label, period }) => {
      // Generate the planetary series for the study window
      const numPoints = Math.min(
        500,
        Math.floor((endUnix - startUnix) / (sampleRateDays * 86400)),
      );
      const stepSeconds = (endUnix - startUnix) / numPoints;
      const ts = Array.from(
        { length: numPoints },
        (_, i) => startUnix + i * stepSeconds,
      );

      let planetVals: number[];
      if (id.includes("-")) {
        // Synodic: use angle difference
        const parts = id.split("-");
        const body1 = parts[0] === "Sun" ? "Sun" : parts[0];
        const body2 =
          parts[1] === "Jupiter"
            ? "Jupiter"
            : parts[1] === "Saturn"
              ? "Saturn"
              : parts[1] === "Mars"
                ? "Mars"
                : parts[1] === "Venus"
                  ? "Venus"
                  : parts[1];
        planetVals = ts.map((t) => {
          const l1 = getPlanetLongitude(body1, t);
          const l2 = getPlanetLongitude(body2, t);
          return Math.abs(l1 - l2);
        });
      } else if (id === "Moon") {
        planetVals = ts.map((t) => getMoonPhase(t).angle);
      } else {
        planetVals = ts.map((t) => getPlanetLongitude(id, t));
      }

      const score = computePhaseSync(
        marketValues.slice(0, numPoints),
        planetVals,
        period,
        sampleRateDays,
      );

      return { id, label, period, score };
    }).sort((a, b) => b.score - a.score);
  }, [marketValues, startUnix, endUnix, sampleRateDays]);

  // Detected resonances: find market peaks near planetary periods
  const resonances = useMemo(() => {
    const threshold = 0.15; // 15% match
    const results: Array<{
      marketPeriod: number;
      planetaryPeriod: number;
      planetName: string;
      matchPct: number;
      significance: string;
    }> = [];

    const topMarketPeaks = marketSpectrum.slice(0, 30);

    for (const peak of topMarketPeaks) {
      // Check against period markers
      for (const marker of PERIOD_MARKERS) {
        const matchPct = Math.abs(peak.period - marker.period) / marker.period;
        if (matchPct <= threshold) {
          const sig =
            peak.power > 0.8
              ? "★★★"
              : peak.power > 0.5
                ? "★★"
                : peak.power > 0.3
                  ? "★"
                  : "·";
          results.push({
            marketPeriod: peak.period,
            planetaryPeriod: marker.period,
            planetName: marker.label,
            matchPct: matchPct * 100,
            significance: sig,
          });
          break;
        }
      }

      // Also check synodic periods
      for (const [name, period] of Object.entries(PLANETARY_SYNODIC_PERIODS)) {
        const matchPct = Math.abs(peak.period - period) / period;
        if (matchPct <= threshold) {
          const existing = results.find(
            (r) => Math.abs(r.marketPeriod - peak.period) < 5,
          );
          if (!existing) {
            const sig =
              peak.power > 0.8
                ? "★★★"
                : peak.power > 0.5
                  ? "★★"
                  : peak.power > 0.3
                    ? "★"
                    : "·";
            results.push({
              marketPeriod: peak.period,
              planetaryPeriod: period,
              planetName: name,
              matchPct: matchPct * 100,
              significance: sig,
            });
            break;
          }
        }
      }
    }

    return results.sort((a, b) => a.matchPct - b.matchPct).slice(0, 15);
  }, [marketSpectrum]);

  // Orbital periods reference for astro panel
  const planetOrbitalPeriods = useMemo(() => {
    return Object.entries(ORBITAL_PERIODS)
      .filter(([, p]) => p >= 14 && p <= 10000)
      .map(([name, period]) => ({ name, period }));
  }, []);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display font-semibold text-xl text-foreground">
            Cycle Analysis
          </h2>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            Dominant periodicities in market and astrological data
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Market selector */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
              Market
            </span>
            <div className="flex gap-1 flex-wrap">
              {MARKETS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMarket(m.id)}
                  className={`font-mono text-[10px] px-2 py-0.5 rounded border transition-all duration-150 ${
                    selectedMarket === m.id
                      ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                      : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                  data-ocid="cycles.market.button"
                >
                  {m.id}
                </button>
              ))}
            </div>
          </div>

          {/* Astro selector */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
              Astro
            </span>
            <div className="flex gap-1 flex-wrap">
              {ASTRO_SERIES_LIST.slice(0, 5).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedAstro(a.id)}
                  className={`font-mono text-[10px] px-2 py-0.5 rounded border transition-all duration-150 ${
                    selectedAstro === a.id
                      ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400"
                      : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                  data-ocid="cycles.astro.button"
                >
                  {a.id === "Moon_phase"
                    ? "Moon"
                    : a.id === "JS_angle"
                      ? "J-S"
                      : a.id}
                </button>
              ))}
            </div>
          </div>

          {/* Study window */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
              Window
            </span>
            <div className="flex gap-1">
              {(["1Y", "5Y", "10Y", "20Y"] as StudyWindow[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setStudyWindow(w)}
                  className={`font-mono text-[10px] px-2 py-0.5 rounded border transition-all duration-150 ${
                    studyWindow === w
                      ? "bg-neon-blue/20 border-neon-blue/50 text-neon-blue"
                      : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                  data-ocid="cycles.window.button"
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Power Spectrum Chart */}
      <div className="glass rounded-xl border border-border/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
          <div>
            <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Power Spectrum
            </h3>
            <p className="font-mono text-[9px] text-muted-foreground/60 mt-0.5">
              {selectedMarket} (amber) vs{" "}
              {selectedAstro === "Moon_phase"
                ? "Moon Phase"
                : selectedAstro === "JS_angle"
                  ? "J-S Angle"
                  : selectedAstro}{" "}
              (cyan) — {studyWindow} window
            </p>
          </div>
          <div className="flex items-center gap-3 text-[9px] font-mono">
            <div className="flex items-center gap-1">
              <div className="w-6 h-0.5 bg-amber-400 opacity-80" />
              <span className="text-amber-400/80">{selectedMarket}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-6 h-0.5 bg-cyan-400 opacity-80" />
              <span className="text-cyan-400/80">{selectedAstro}</span>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={combinedSpectrum}
                margin={{ top: 8, right: 16, left: 0, bottom: 20 }}
              >
                <defs>
                  <linearGradient id="marketGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="astroGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22D3EE" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#22D3EE" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" strokeOpacity={0.15} />
                <XAxis
                  dataKey="period"
                  type="number"
                  domain={[14, 10000]}
                  scale="log"
                  tickFormatter={(v: number) =>
                    v >= 1000
                      ? `${(v / 365.25).toFixed(1)}y`
                      : `${Math.round(v)}d`
                  }
                  tick={{ fontSize: 8, fontFamily: "JetBrains Mono" }}
                  tickLine={false}
                  axisLine={false}
                  ticks={[
                    29.5, 87.9, 224.7, 365.25, 686.9, 1461, 4332.6, 7253, 10759,
                  ]}
                  label={{
                    value: "Period (days)",
                    position: "insideBottom",
                    offset: -12,
                    fontSize: 8,
                    fontFamily: "JetBrains Mono",
                    fill: "oklch(0.5 0.03 265)",
                  }}
                />
                <YAxis
                  domain={[0, 1]}
                  tick={{ fontSize: 8, fontFamily: "JetBrains Mono" }}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                  tickFormatter={(v: number) => v.toFixed(1)}
                />
                <Tooltip content={<SpectrumTooltip />} />

                {/* Planetary period reference lines */}
                {PERIOD_MARKERS.map((marker) => (
                  <ReferenceLine
                    key={marker.label}
                    x={marker.period}
                    stroke={marker.color}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    strokeOpacity={0.5}
                    label={{
                      value: marker.label,
                      position: "top",
                      fontSize: 7,
                      fontFamily: "JetBrains Mono",
                      fill: marker.color,
                      opacity: 0.7,
                    }}
                  />
                ))}

                <Area
                  type="monotone"
                  dataKey="market"
                  name={selectedMarket}
                  stroke="#F59E0B"
                  strokeWidth={1.5}
                  fill="url(#marketGrad)"
                  dot={false}
                  strokeOpacity={0.9}
                />
                <Area
                  type="monotone"
                  dataKey="astro"
                  name={
                    selectedAstro === "Moon_phase"
                      ? "Moon Phase"
                      : selectedAstro === "JS_angle"
                        ? "J-S Angle"
                        : selectedAstro
                  }
                  stroke="#22D3EE"
                  strokeWidth={1.5}
                  fill="url(#astroGrad)"
                  dot={false}
                  strokeOpacity={0.9}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Resonance highlights: aligned peaks */}
          {resonances.length > 0 && (
            <div className="mt-3 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <span className="font-mono text-[9px] text-amber-400/80 uppercase tracking-wider">
                ✦ Resonance Peaks Detected
              </span>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {resonances.slice(0, 8).map((r) => (
                  <span
                    key={`${Math.round(r.marketPeriod)}-${r.planetName}`}
                    className="font-mono text-[8px] px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-300/80"
                  >
                    ~{Math.round(r.marketPeriod)}d ≈ {r.planetName} (
                    {r.matchPct.toFixed(1)}% off)
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Phase Synchronization Matrix */}
      <div className="glass rounded-xl border border-border/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/30">
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Phase Synchronization Matrix
          </h3>
          <p className="font-mono text-[9px] text-muted-foreground/60 mt-0.5">
            {selectedMarket} vs each planetary cycle — Mean Resultant Length
            (0=no sync, 1=perfect sync)
          </p>
        </div>
        <div className="p-4">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={phaseSyncData}
                layout="vertical"
                margin={{ top: 4, right: 60, left: 4, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="2 4"
                  strokeOpacity={0.15}
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  domain={[0, 1]}
                  tick={{ fontSize: 8, fontFamily: "JetBrains Mono" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => v.toFixed(1)}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={110}
                  tick={{
                    fontSize: 8,
                    fontFamily: "JetBrains Mono",
                    fill: "oklch(0.6 0.04 265)",
                  }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<SyncTooltip />} />
                <ReferenceLine
                  x={0.7}
                  stroke="#22D3EE"
                  strokeDasharray="3 3"
                  strokeOpacity={0.4}
                  strokeWidth={1}
                />
                <ReferenceLine
                  x={0.4}
                  stroke="#34D399"
                  strokeDasharray="3 3"
                  strokeOpacity={0.4}
                  strokeWidth={1}
                />
                <Bar
                  dataKey="score"
                  radius={[0, 3, 3, 0]}
                  label={{
                    position: "right",
                    fontSize: 8,
                    fontFamily: "JetBrains Mono",
                    formatter: (v: number) => v.toFixed(3),
                    fill: "oklch(0.6 0.04 265)",
                  }}
                  fill="#22D3EE"
                  isAnimationActive={false}
                  // Color bars by score
                  shape={(props: any) => {
                    const { x, y, width, height, value } = props;
                    const color = syncColor(value as number);
                    return (
                      <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        fill={color}
                        opacity={0.75}
                        rx={3}
                        ry={3}
                      />
                    );
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-cyan-400 opacity-75" />
              <span className="font-mono text-[9px] text-muted-foreground">
                Strong sync (&gt;0.7)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-green-400 opacity-75" />
              <span className="font-mono text-[9px] text-muted-foreground">
                Moderate sync (&gt;0.4)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-gray-500 opacity-75" />
              <span className="font-mono text-[9px] text-muted-foreground">
                Weak sync
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Detected Resonances */}
      <div className="glass rounded-xl border border-border/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/30">
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Detected Resonances
          </h3>
          <p className="font-mono text-[9px] text-muted-foreground/60 mt-0.5">
            Market cycle peaks within 15% of known planetary periods
          </p>
        </div>
        <div className="overflow-x-auto">
          {resonances.length === 0 ? (
            <div
              className="flex items-center justify-center py-8"
              data-ocid="cycles.resonances.empty_state"
            >
              <p className="font-mono text-xs text-muted-foreground">
                No resonances detected in this time window — try a longer study
                period
              </p>
            </div>
          ) : (
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="border-b border-border/20">
                  <th className="text-left px-4 py-2 text-muted-foreground font-normal">
                    Market Period
                  </th>
                  <th className="text-left px-4 py-2 text-muted-foreground font-normal">
                    Nearest Planetary Period
                  </th>
                  <th className="text-right px-4 py-2 text-muted-foreground font-normal">
                    Offset
                  </th>
                  <th className="text-center px-4 py-2 text-muted-foreground font-normal">
                    Strength
                  </th>
                </tr>
              </thead>
              <tbody>
                {resonances.map((r, i) => {
                  const matchColor =
                    r.matchPct < 3
                      ? "#22D3EE"
                      : r.matchPct < 8
                        ? "#34D399"
                        : "#F59E0B";
                  return (
                    <tr
                      key={`${Math.round(r.marketPeriod)}-${r.planetName}-${r.matchPct.toFixed(1)}`}
                      className="border-b border-border/10 hover:bg-muted/10 transition-colors"
                      data-ocid={`cycles.resonance.item.${i + 1}`}
                    >
                      <td className="px-4 py-2 text-foreground/80">
                        {r.marketPeriod >= 365
                          ? `${(r.marketPeriod / 365.25).toFixed(2)}yr`
                          : `${Math.round(r.marketPeriod)}d`}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        <span style={{ color: matchColor }}>
                          {r.planetName}
                        </span>{" "}
                        <span className="text-muted-foreground/60">
                          (
                          {r.planetaryPeriod >= 365
                            ? `${(r.planetaryPeriod / 365.25).toFixed(1)}yr`
                            : `${Math.round(r.planetaryPeriod)}d`}
                          )
                        </span>
                      </td>
                      <td
                        className="px-4 py-2 text-right"
                        style={{ color: matchColor }}
                      >
                        {r.matchPct.toFixed(1)}%
                      </td>
                      <td
                        className="px-4 py-2 text-center"
                        style={{ color: matchColor }}
                      >
                        {r.significance}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Reference table */}
        <div className="px-4 py-3 border-t border-border/20">
          <p className="font-mono text-[9px] text-muted-foreground/60 mb-2 uppercase tracking-wider">
            Orbital Periods Reference
          </p>
          <div className="flex flex-wrap gap-3">
            {planetOrbitalPeriods.map(({ name, period }) => (
              <div key={name} className="flex items-center gap-1">
                <span className="font-mono text-[8px] text-muted-foreground/80">
                  {name}:
                </span>
                <span className="font-mono text-[8px] text-foreground/60">
                  {period >= 365
                    ? `${(period / 365.25).toFixed(1)}yr`
                    : `${Math.round(period)}d`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
