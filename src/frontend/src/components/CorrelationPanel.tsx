import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAppStore } from "../store/useAppStore";
import {
  computePearsonCorrelation,
  computeRollingCorrelation,
  getMoonPhase,
  getPlanetLongitude,
  runAspectEventStudy,
} from "../utils/astroCalc";
import { generateMarketData } from "../utils/marketData";

const MARKETS = [
  { id: "BTC", name: "Bitcoin (BTC)" },
  { id: "SP500", name: "S&P 500" },
  { id: "GOLD", name: "Gold" },
  { id: "DXY", name: "DXY (USD Index)" },
  { id: "VIX", name: "VIX" },
  { id: "ALTSEASON", name: "Altseason Index" },
];

const ASTRO_SERIES = [
  { id: "Jupiter", name: "Jupiter Longitude" },
  { id: "Saturn", name: "Saturn Longitude" },
  { id: "Mars", name: "Mars Longitude" },
  { id: "Moon_phase", name: "Moon Phase Angle" },
  { id: "JS_angle", name: "Jupiter-Saturn Angle" },
  { id: "Venus", name: "Venus Longitude" },
  { id: "Mercury", name: "Mercury Longitude" },
  { id: "aspect_event_study", name: "Aspect Event Study (Auto)" },
];

const ASPECT_STUDY_MARKETS = ["BTC", "ETH", "SP500", "GOLD", "DXY"];

function getAstroSeries(astroId: string, timestamps: number[]): number[] {
  return timestamps.map((ts) => {
    if (astroId === "Moon_phase") {
      return getMoonPhase(ts).angle;
    }
    if (astroId === "JS_angle") {
      const jupLon = getPlanetLongitude("Jupiter", ts);
      const satLon = getPlanetLongitude("Saturn", ts);
      return Math.abs(jupLon - satLon);
    }
    return getPlanetLongitude(astroId, ts);
  });
}

function correlationColor(r: number): string {
  const abs = Math.abs(r);
  if (abs > 0.7) return r > 0 ? "#22D3EE" : "#F87171";
  if (abs > 0.4) return r > 0 ? "#34D399" : "#FB923C";
  return "oklch(0.5 0.04 265)";
}

function correlationBg(r: number): string {
  if (r > 0.7) return "oklch(0.7 0.18 195 / 0.15)";
  if (r > 0.4) return "oklch(0.72 0.2 145 / 0.1)";
  if (r < -0.7) return "oklch(0.62 0.22 25 / 0.15)";
  if (r < -0.4) return "oklch(0.75 0.2 50 / 0.1)";
  return "transparent";
}

// Significance estimate based on n and r
function getPValue(r: number, n: number): { pval: number; sig: string } {
  if (n < 3) return { pval: 1, sig: "Insufficient data" };
  const t = (r * Math.sqrt(n - 2)) / Math.sqrt(1 - r * r);
  const absT = Math.abs(t);
  // Rough t-distribution approximation
  let pval: number;
  if (absT > 4) pval = 0.0001;
  else if (absT > 3.3) pval = 0.001;
  else if (absT > 2.6) pval = 0.01;
  else if (absT > 2.0) pval = 0.05;
  else if (absT > 1.6) pval = 0.1;
  else pval = 0.2 + (2 - absT) * 0.3;

  let sig = "Not Significant";
  if (pval < 0.001) sig = "*** (p<0.001)";
  else if (pval < 0.01) sig = "** (p<0.01)";
  else if (pval < 0.05) sig = "* (p<0.05)";
  else if (pval < 0.1) sig = "† (p<0.1)";
  return { pval, sig };
}

function sigColor(sig: string): string {
  if (sig === "***") return "#22D3EE"; // neon cyan
  if (sig === "**") return "#60A5FA"; // neon blue
  if (sig === "*") return "#FACC15"; // yellow
  if (sig === "†") return "oklch(0.55 0.04 265)"; // muted
  return "oklch(0.35 0.03 265)"; // very muted
}

function formatPValue(p: number): string {
  if (p <= 0.0001) return "<.0001";
  if (p <= 0.001) return "<.001";
  if (p <= 0.01) return "<.01";
  if (p <= 0.05) return "<.05";
  if (p <= 0.1) return "<.10";
  return ">.10";
}

export function CorrelationPanel() {
  const { selectedTimestamp } = useAppStore();
  const [selectedMarket, setSelectedMarket] = useState("BTC");
  const [selectedAstro, setSelectedAstro] = useState("Jupiter");
  const [aspectFilter, setAspectFilter] = useState<"all" | "significant">(
    "significant",
  );

  // Use 5-year window for correlation
  const endUnix = selectedTimestamp;
  const startUnix = endUnix - 5 * 365 * 86400;
  const NUM_POINTS = 180; // ~bi-weekly over 5 years

  // Generate all market and astro time series for the correlation matrix
  const { matrix, timestamps } = useMemo(() => {
    const step = (endUnix - startUnix) / NUM_POINTS;
    const ts = Array.from(
      { length: NUM_POINTS },
      (_, i) => startUnix + i * step,
    );

    const marketData: Record<string, number[]> = {};
    for (const m of MARKETS) {
      const pts = generateMarketData(m.id, startUnix, endUnix, NUM_POINTS);
      marketData[m.id] = pts.map((p) => p.value);
    }

    const astroData: Record<string, number[]> = {};
    for (const a of ASTRO_SERIES) {
      if (a.id === "aspect_event_study") continue;
      astroData[a.id] = getAstroSeries(a.id, ts);
    }

    // Compute correlation matrix
    const mat: Record<string, Record<string, number>> = {};
    for (const m of MARKETS) {
      mat[m.id] = {};
      for (const a of ASTRO_SERIES) {
        if (a.id === "aspect_event_study") {
          mat[m.id][a.id] = 0;
          continue;
        }
        mat[m.id][a.id] = computePearsonCorrelation(
          marketData[m.id],
          astroData[a.id],
        );
      }
    }

    return { matrix: mat, timestamps: ts };
  }, [startUnix, endUnix]);

  // Rolling correlation for selected pair
  const rollingData = useMemo(() => {
    if (selectedAstro === "aspect_event_study") return [];
    const pts1 = generateMarketData(
      selectedMarket,
      startUnix,
      endUnix,
      365,
    ).map((p) => ({ t: p.timestamp, v: p.value }));
    const astro = timestamps.map((ts) => ({
      t: ts,
      v: getAstroSeries(selectedAstro, [ts])[0],
    }));
    const rolling = computeRollingCorrelation(pts1, astro, 90);
    return rolling.map((p) => ({
      timestamp: p.t,
      r: p.r,
    }));
  }, [selectedMarket, selectedAstro, startUnix, endUnix, timestamps]);

  // Notable correlations: find top 3 absolute
  const notableCorrelations = useMemo(() => {
    const all: Array<{
      market: string;
      astro: string;
      r: number;
      n: number;
    }> = [];
    for (const m of MARKETS) {
      for (const a of ASTRO_SERIES) {
        if (a.id === "aspect_event_study") continue;
        all.push({
          market: m.name,
          astro: a.name,
          r: matrix[m.id]?.[a.id] ?? 0,
          n: NUM_POINTS,
        });
      }
    }
    return all.sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).slice(0, 3);
  }, [matrix]);

  // Aspect Event Study: expensive computation, memoized on 5y window
  const aspectStudyResults = useMemo(() => {
    return runAspectEventStudy(
      startUnix,
      endUnix,
      ASPECT_STUDY_MARKETS,
      7,
      generateMarketData,
    );
  }, [startUnix, endUnix]);

  const filteredAspectResults = useMemo(() => {
    const base =
      aspectFilter === "significant"
        ? aspectStudyResults.filter((r) => r.pValue < 0.1)
        : aspectStudyResults;
    return base.slice(0, 20);
  }, [aspectStudyResults, aspectFilter]);

  const significantCount = useMemo(
    () => aspectStudyResults.filter((r) => r.pValue < 0.1).length,
    [aspectStudyResults],
  );

  const selectedR =
    selectedAstro === "aspect_event_study"
      ? 0
      : (matrix[selectedMarket]?.[selectedAstro] ?? 0);
  const { sig } = getPValue(selectedR, NUM_POINTS);

  const tooltipFormatter = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: number;
  }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="glass rounded-lg px-3 py-2 border border-border/50 font-mono text-xs">
        <div className="text-muted-foreground">
          {label ? format(new Date(label * 1000), "MMM d, yyyy") : ""}
        </div>
        <div
          className="font-semibold mt-1"
          style={{ color: correlationColor(payload[0].value) }}
        >
          r = {payload[0].value.toFixed(3)}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 gap-6">
      <div>
        <h2 className="font-display font-semibold text-xl text-foreground">
          Correlation Engine
        </h2>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Pearson correlation between financial markets and astrological cycles
          — 5-year window
        </p>
      </div>

      {/* Correlation Matrix Heatmap */}
      <div className="glass rounded-xl border border-border/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/30">
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Correlation Matrix Heatmap
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="border-b border-border/20">
                <th className="text-left px-3 py-2 text-muted-foreground font-normal w-28">
                  Market ↕ Astro →
                </th>
                {ASTRO_SERIES.filter((a) => a.id !== "aspect_event_study").map(
                  (a) => (
                    <th
                      key={a.id}
                      className="px-2 py-2 text-muted-foreground font-normal text-center"
                      style={{ minWidth: "70px" }}
                    >
                      <div
                        className="writing-vertical"
                        style={{
                          writingMode: "vertical-lr",
                          transform: "rotate(180deg)",
                          height: "60px",
                        }}
                      >
                        {a.name.replace(" Longitude", "").replace(" Angle", "")}
                      </div>
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {MARKETS.map((m) => (
                <tr key={m.id} className="border-b border-border/10">
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {m.name}
                  </td>
                  {ASTRO_SERIES.filter(
                    (a) => a.id !== "aspect_event_study",
                  ).map((a) => {
                    const r = matrix[m.id]?.[a.id] ?? 0;
                    return (
                      <td key={a.id} className="p-0">
                        <button
                          type="button"
                          className="w-full px-2 py-2 text-center font-semibold font-mono text-[10px]"
                          style={{
                            background: correlationBg(r),
                            color: correlationColor(r),
                            cursor: "pointer",
                          }}
                          onClick={() => {
                            setSelectedMarket(m.id);
                            setSelectedAstro(a.id);
                          }}
                          title={`${m.name} vs ${a.name}: r = ${r.toFixed(3)}`}
                        >
                          {r > 0 ? "+" : ""}
                          {r.toFixed(2)}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 flex items-center gap-4 border-t border-border/20">
          <span className="font-mono text-[9px] text-muted-foreground">
            Color scale:
          </span>
          <div className="flex items-center gap-1">
            <div
              className="w-16 h-2 rounded"
              style={{
                background:
                  "linear-gradient(to right, #F87171, oklch(0.5 0.04 265), #22D3EE)",
              }}
            />
            <span className="font-mono text-[9px] text-muted-foreground">
              -1 → 0 → +1
            </span>
          </div>
          <span className="font-mono text-[9px] text-muted-foreground">
            Click a cell to analyze
          </span>
        </div>
      </div>

      {/* Pair selector + rolling correlation */}
      <div className="glass rounded-xl border border-border/40 p-4">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Rolling Correlation (90-day window)
          </h3>
          <div className="flex items-center gap-2 ml-auto">
            <Select value={selectedMarket} onValueChange={setSelectedMarket}>
              <SelectTrigger
                className="w-40 font-mono text-xs h-7 border-border/50"
                data-ocid="correlation.market.select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MARKETS.map((m) => (
                  <SelectItem
                    key={m.id}
                    value={m.id}
                    className="font-mono text-xs"
                  >
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="font-mono text-xs text-muted-foreground">vs</span>

            <Select value={selectedAstro} onValueChange={setSelectedAstro}>
              <SelectTrigger
                className="w-52 font-mono text-xs h-7 border-border/50"
                data-ocid="correlation.astro.select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASTRO_SERIES.map((a) => (
                  <SelectItem
                    key={a.id}
                    value={a.id}
                    className="font-mono text-xs"
                  >
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedAstro === "aspect_event_study" ? (
          <div className="flex items-center justify-center h-24 rounded-lg bg-muted/10 border border-border/20">
            <p className="font-mono text-xs text-muted-foreground">
              See <span className="text-cyan-400">Aspect Event Study</span>{" "}
              section below for auto-detected patterns.
            </p>
          </div>
        ) : (
          <>
            {/* Current correlation stats */}
            <div className="flex items-center gap-4 mb-4 p-3 rounded-lg bg-muted/20">
              <div>
                <span className="font-mono text-[9px] text-muted-foreground block">
                  Pearson r
                </span>
                <span
                  className="font-mono text-lg font-semibold"
                  style={{ color: correlationColor(selectedR) }}
                >
                  {selectedR > 0 ? "+" : ""}
                  {selectedR.toFixed(3)}
                </span>
              </div>
              <div>
                <span className="font-mono text-[9px] text-muted-foreground block">
                  Significance
                </span>
                <span className="font-mono text-xs text-foreground">{sig}</span>
              </div>
              <div>
                <span className="font-mono text-[9px] text-muted-foreground block">
                  Data Points
                </span>
                <span className="font-mono text-xs text-foreground">
                  {NUM_POINTS}
                </span>
              </div>
              <div>
                <span className="font-mono text-[9px] text-muted-foreground block">
                  Window
                </span>
                <span className="font-mono text-xs text-foreground">
                  5 years
                </span>
              </div>
            </div>

            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={rollingData}
                  margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="2 4" strokeOpacity={0.2} />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(ts: number) =>
                      format(new Date(ts * 1000), "MMM yy")
                    }
                    tick={{ fontSize: 9, fontFamily: "JetBrains Mono" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[-1, 1]}
                    tick={{ fontSize: 9, fontFamily: "JetBrains Mono" }}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  <Tooltip content={tooltipFormatter as any} />
                  <ReferenceLine
                    y={0}
                    stroke="oklch(0.4 0.04 265)"
                    strokeWidth={1}
                  />
                  <ReferenceLine
                    y={0.7}
                    stroke="#22D3EE"
                    strokeWidth={0.5}
                    strokeDasharray="3 3"
                    strokeOpacity={0.4}
                  />
                  <ReferenceLine
                    y={-0.7}
                    stroke="#F87171"
                    strokeWidth={0.5}
                    strokeDasharray="3 3"
                    strokeOpacity={0.4}
                  />
                  <Line
                    type="monotone"
                    dataKey="r"
                    stroke="#7FCFC0"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      {/* Notable Correlations */}
      <div className="glass rounded-xl border border-border/40 p-4">
        <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
          Top Correlations Found
        </h3>
        <div className="space-y-2">
          {notableCorrelations.map((c, i) => {
            const { sig } = getPValue(c.r, c.n);
            return (
              <div
                key={`${c.market}-${c.astro}`}
                className="flex items-center gap-3 rounded-lg p-3 border"
                style={{
                  background: correlationBg(c.r),
                  borderColor: `${correlationColor(c.r)}30`,
                }}
                data-ocid={`correlation.item.${i + 1}`}
              >
                <div
                  className="text-2xl font-mono font-semibold flex-shrink-0 w-14"
                  style={{ color: correlationColor(c.r) }}
                >
                  {c.r > 0 ? "+" : ""}
                  {c.r.toFixed(2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs text-foreground">
                    {c.market}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    vs {c.astro}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-mono text-[9px] text-muted-foreground">
                    {sig}
                  </div>
                  <div className="font-mono text-[9px] text-muted-foreground mt-0.5">
                    n={c.n}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Aspect Event Study */}
      <div className="glass rounded-xl border border-border/40 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Auto-Detected Patterns
            </h3>
            {significantCount > 0 && (
              <Badge
                variant="outline"
                className="border-cyan-500/40 text-cyan-400 font-mono text-[9px] px-1.5 py-0.5 flex items-center gap-1"
                data-ocid="correlation.aspect_study.panel"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500" />
                </span>
                {significantCount} significant
              </Badge>
            )}
          </div>

          {/* Filter toggle */}
          <div
            className="flex gap-1"
            data-ocid="correlation.aspect_filter.toggle"
          >
            {(
              [
                { value: "significant", label: "Significant (p<0.1)" },
                { value: "all", label: "All" },
              ] as const
            ).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setAspectFilter(value)}
                className={`font-mono text-[10px] px-2 py-0.5 rounded border transition-all duration-150 ${
                  aspectFilter === value
                    ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400"
                    : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {filteredAspectResults.length === 0 ? (
            <div
              className="flex items-center justify-center py-8"
              data-ocid="correlation.aspect_study.empty_state"
            >
              <p className="font-mono text-xs text-muted-foreground">
                {aspectFilter === "significant"
                  ? "No significant patterns found in this window — try switching to 'All'"
                  : "No aspect events found in this time window"}
              </p>
            </div>
          ) : (
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="border-b border-border/20">
                  <th className="text-left px-3 py-2 text-muted-foreground font-normal whitespace-nowrap">
                    Aspect Type
                  </th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-normal whitespace-nowrap">
                    Bodies
                  </th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-normal">
                    Mkt
                  </th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-normal whitespace-nowrap">
                    Avg Ret
                  </th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-normal">
                    t-stat
                  </th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-normal">
                    p-val
                  </th>
                  <th className="text-center px-3 py-2 text-muted-foreground font-normal">
                    Sig
                  </th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-normal">
                    n
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAspectResults.map((result, idx) => {
                  const isPositiveReturn = result.avgReturn >= 0;
                  return (
                    <tr
                      key={`${result.aspectType}-${result.body1}-${result.body2}-${result.market}`}
                      className="border-b border-border/10 hover:bg-muted/10 transition-colors"
                      data-ocid={`correlation.aspect_study.item.${idx + 1}`}
                    >
                      <td className="px-3 py-2 text-foreground/80 whitespace-nowrap capitalize">
                        {result.aspectType.replace(/_/g, " ")}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {result.body1}
                        {result.body2 ? ` / ${result.body2}` : ""}
                      </td>
                      <td className="px-3 py-2 text-foreground/70">
                        {result.market}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-semibold ${
                          isPositiveReturn ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {isPositiveReturn ? "+" : ""}
                        {result.avgReturn.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-right text-foreground/70">
                        {result.tStat.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right text-foreground/60">
                        {formatPValue(result.pValue)}
                      </td>
                      <td
                        className="px-3 py-2 text-center font-bold"
                        style={{ color: sigColor(result.significance) }}
                      >
                        {result.significance}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {result.sampleCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 border-t border-border/20 flex items-center gap-4 flex-wrap">
          <span className="font-mono text-[9px] text-muted-foreground">
            7-day event window · Markets: {ASPECT_STUDY_MARKETS.join(", ")} ·
            5-year study period
          </span>
          <div className="ml-auto flex items-center gap-3">
            {(
              [
                { sig: "***", label: "p<.001" },
                { sig: "**", label: "p<.01" },
                { sig: "*", label: "p<.05" },
                { sig: "†", label: "p<.10" },
              ] as const
            ).map(({ sig, label }) => (
              <span
                key={sig}
                className="font-mono text-[9px]"
                style={{ color: sigColor(sig) }}
              >
                {sig} {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
