import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { useAppStore } from "../store/useAppStore";
import {
  type AspectCorrelationResult,
  computeAstroEvents,
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

type StudyWindow = "1Y" | "5Y" | "10Y" | "20Y";
type EventWindowDays = 3 | 7 | 14 | 30;

const STUDY_WINDOW_SECONDS: Record<StudyWindow, number> = {
  "1Y": 1 * 365 * 86400,
  "5Y": 5 * 365 * 86400,
  "10Y": 10 * 365 * 86400,
  "20Y": 20 * 365 * 86400,
};

// For longer windows, use coarser step to limit computation
const STUDY_WINDOW_STEP: Record<StudyWindow, number> = {
  "1Y": 1,
  "5Y": 1,
  "10Y": 2,
  "20Y": 2,
};

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

function getPValue(r: number, n: number): { pval: number; sig: string } {
  if (n < 3) return { pval: 1, sig: "Insufficient data" };
  const t = (r * Math.sqrt(n - 2)) / Math.sqrt(1 - r * r);
  const absT = Math.abs(t);
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
  if (sig === "***") return "#22D3EE";
  if (sig === "**") return "#60A5FA";
  if (sig === "*") return "#FACC15";
  if (sig === "†") return "oklch(0.55 0.04 265)";
  return "oklch(0.35 0.03 265)";
}

function formatPValue(p: number): string {
  if (p <= 0.0001) return "<.0001";
  if (p <= 0.001) return "<.001";
  if (p <= 0.01) return "<.01";
  if (p <= 0.05) return "<.05";
  if (p <= 0.1) return "<.10";
  return ">.10";
}

function formatDate(ts: number): string {
  return format(new Date(ts * 1000), "MMM d, yyyy");
}

// ─── Aspect Calendar ───────────────────────────────────────────────────────────

interface CalendarDay {
  date: Date;
  unix: number;
  hasEvent: boolean;
  isBullish: boolean | null;
  eventLabel: string | null;
  isSelected: boolean;
}

function AspectCalendar({
  selectedTimestamp,
  significantResults,
  studyStartUnix,
  studyEndUnix,
}: {
  selectedTimestamp: number;
  significantResults: AspectCorrelationResult[];
  studyStartUnix: number;
  studyEndUnix: number;
}) {
  const [hoveredDay, setHoveredDay] = useState<CalendarDay | null>(null);

  // Build event lookup from significantResults
  const eventByDay = useMemo(() => {
    const lookup = new Map<number, { isBullish: boolean; label: string }>();

    // Get all relevant astro events for ±3 months
    const calStart = selectedTimestamp - 3 * 30 * 86400;
    const calEnd = selectedTimestamp + 3 * 30 * 86400;
    // Only compute if within study window
    const evStart = Math.max(calStart, studyStartUnix);
    const evEnd = Math.min(calEnd, studyEndUnix);
    if (evStart >= evEnd) return lookup;

    const astroEvents = computeAstroEvents(evStart, evEnd);

    // For each event, check if it matches a significant result
    for (const ev of astroEvents) {
      const evKey = `${ev.type}||${ev.body1 ?? ""}||${ev.body2 ?? ""}`;
      const matchingResult = significantResults.find(
        (r) =>
          `${r.aspectType}||${r.body1}||${r.body2}` === evKey && r.pValue < 0.1,
      );
      if (matchingResult) {
        const dayKey = Math.floor(ev.timestamp / 86400);
        if (!lookup.has(dayKey)) {
          lookup.set(dayKey, {
            isBullish: matchingResult.avgReturn >= 0,
            label: `${ev.label} → ${matchingResult.market} avg ${matchingResult.avgReturn > 0 ? "+" : ""}${matchingResult.avgReturn.toFixed(2)}% (${matchingResult.significance})`,
          });
        }
      }
    }
    return lookup;
  }, [selectedTimestamp, significantResults, studyStartUnix, studyEndUnix]);

  // Build 6-month grid: 3 months before, 3 months after selected timestamp
  const days = useMemo<CalendarDay[]>(() => {
    const anchor = new Date(selectedTimestamp * 1000);
    anchor.setDate(1);
    anchor.setMonth(anchor.getMonth() - 3);
    anchor.setHours(0, 0, 0, 0);

    const endDate = new Date(selectedTimestamp * 1000);
    endDate.setDate(1);
    endDate.setMonth(endDate.getMonth() + 4);
    endDate.setHours(0, 0, 0, 0);

    const result: CalendarDay[] = [];
    const cur = new Date(anchor);
    const selectedDay = Math.floor(selectedTimestamp / 86400);

    while (cur < endDate) {
      const unix = Math.floor(cur.getTime() / 1000);
      const dayKey = Math.floor(unix / 86400);
      const eventInfo = eventByDay.get(dayKey);
      // Also check ±2 days for proximity
      let closestEvent: { isBullish: boolean; label: string } | undefined;
      for (let d = -2; d <= 2; d++) {
        const nearby = eventByDay.get(dayKey + d);
        if (nearby) {
          closestEvent = nearby;
          break;
        }
      }

      result.push({
        date: new Date(cur),
        unix,
        hasEvent: !!(eventInfo || closestEvent),
        isBullish: eventInfo?.isBullish ?? closestEvent?.isBullish ?? null,
        eventLabel: eventInfo?.label ?? closestEvent?.label ?? null,
        isSelected: Math.abs(dayKey - selectedDay) < 1,
      });
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }, [selectedTimestamp, eventByDay]);

  // Group by weeks
  const weeks = useMemo(() => {
    const rows: CalendarDay[][] = [];
    // Pad to start on Sunday
    const firstDay = days[0];
    const startDow = firstDay.date.getDay();
    const paddedDays: (CalendarDay | null)[] = [
      ...Array(startDow).fill(null),
      ...days,
    ];
    for (let i = 0; i < paddedDays.length; i += 7) {
      rows.push(paddedDays.slice(i, i + 7) as CalendarDay[]);
    }
    return rows;
  }, [days]);

  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="overflow-x-auto">
      <div className="min-w-max">
        {/* DOW header */}
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {DOW.map((d) => (
            <div
              key={d}
              className="w-5 text-center font-mono text-[7px] text-muted-foreground/60"
            >
              {d.charAt(0)}
            </div>
          ))}
        </div>

        {/* Month rows */}
        <div className="relative">
          {weeks.map((week) => {
            // Derive a stable key from the first non-null day's unix timestamp
            const weekKey = week.find((d) => d !== null)?.unix ?? Math.random();
            return (
              <div key={weekKey} className="grid grid-cols-7 gap-0.5 mb-0.5">
                {week.map((day, di) => {
                  if (!day)
                    return (
                      <div
                        // biome-ignore lint/suspicious/noArrayIndexKey: null padding cells have no meaningful key
                        key={`pad-${String(weekKey)}-${di}`}
                        className="w-5 h-5"
                      />
                    );

                  let cellBg = "bg-muted/20";
                  let cellBorder = "border-border/20";
                  if (day.hasEvent) {
                    if (day.isBullish === true) {
                      cellBg = "bg-cyan-500/20";
                      cellBorder = "border-cyan-500/40";
                    } else if (day.isBullish === false) {
                      cellBg = "bg-red-500/20";
                      cellBorder = "border-red-500/40";
                    }
                  }
                  if (day.isSelected) {
                    cellBorder = "border-yellow-400";
                  }

                  return (
                    <div
                      key={day.unix}
                      className={`relative w-5 h-5 rounded-sm border ${cellBg} ${cellBorder} flex items-center justify-center cursor-default`}
                      onMouseEnter={() => day.hasEvent && setHoveredDay(day)}
                      onMouseLeave={() => setHoveredDay(null)}
                    >
                      <span className="font-mono text-[6px] text-muted-foreground/50 select-none">
                        {day.date.getDate()}
                      </span>
                      {day.isSelected && (
                        <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-yellow-400" />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Tooltip */}
          {hoveredDay?.eventLabel && (
            <div className="absolute top-0 right-0 z-50 max-w-48 glass rounded-lg px-3 py-2 border border-border/50 font-mono text-[9px] pointer-events-none shadow-xl">
              <div className="text-foreground font-semibold">
                {formatDate(hoveredDay.unix)}
              </div>
              <div
                className="mt-0.5"
                style={{
                  color: hoveredDay.isBullish === true ? "#22D3EE" : "#F87171",
                }}
              >
                {hoveredDay.eventLabel}
              </div>
            </div>
          )}
        </div>

        {/* Month labels row */}
        <div className="mt-2 flex gap-2 flex-wrap">
          {Array.from(new Set(days.map((d) => format(d.date, "MMM yyyy")))).map(
            (label) => (
              <span
                key={label}
                className="font-mono text-[8px] text-muted-foreground/50"
              >
                {label}
              </span>
            ),
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-cyan-500/20 border border-cyan-500/40" />
            <span className="font-mono text-[8px] text-muted-foreground">
              Bullish event
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-red-500/20 border border-red-500/40" />
            <span className="font-mono text-[8px] text-muted-foreground">
              Bearish event
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm border-2 border-yellow-400" />
            <span className="font-mono text-[8px] text-muted-foreground">
              Selected date
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pattern History Chart ────────────────────────────────────────────────────

interface PatternEvent {
  timestamp: number;
  marketReturn: number;
  price: number;
  label: string;
}

function PatternHistoryChart({
  patternKey,
  startUnix,
  endUnix,
  eventWindowDays,
  onClose,
}: {
  patternKey: string;
  startUnix: number;
  endUnix: number;
  eventWindowDays: number;
  onClose: () => void;
}) {
  const [aspectType, , body1, body2, marketId] = patternKey.split("||");

  // Generate price chart
  const NUM_POINTS = 300;
  const priceData = useMemo(
    () => generateMarketData(marketId, startUnix, endUnix, NUM_POINTS),
    [marketId, startUnix, endUnix],
  );

  // Get all astro events for the study window
  const astroEvents = useMemo(
    () => computeAstroEvents(startUnix, endUnix),
    [startUnix, endUnix],
  );

  // Filter events matching this pattern
  const patternEvents = useMemo<PatternEvent[]>(() => {
    return astroEvents
      .filter(
        (ev) =>
          ev.type === aspectType &&
          ev.body1 === (body1 || undefined || ev.body1) &&
          (body2 === "" || ev.body2 === (body2 || undefined || ev.body2)),
      )
      .map((ev) => {
        // Get price at event
        const halfWindow = Math.floor(eventWindowDays / 2) * 86400;
        const pts = generateMarketData(
          marketId,
          ev.timestamp - halfWindow,
          ev.timestamp + halfWindow,
          3,
        );
        const first = pts[0]?.value ?? 0;
        const last = pts[pts.length - 1]?.value ?? 0;
        const marketReturn = first > 0 ? ((last - first) / first) * 100 : 0;
        const priceAtEvent =
          generateMarketData(marketId, ev.timestamp - 86400, ev.timestamp, 2)[1]
            ?.value ?? 0;
        return {
          timestamp: ev.timestamp,
          marketReturn,
          price: priceAtEvent,
          label: ev.label,
        };
      });
  }, [astroEvents, aspectType, body1, body2, marketId, eventWindowDays]);

  const formatYTick = (v: number) => {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
    return v.toFixed(1);
  };

  const customTooltip = ({
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
          {label ? formatDate(label) : ""}
        </div>
        <div className="text-foreground font-semibold mt-1">
          {formatYTick(payload[0].value)}
        </div>
      </div>
    );
  };

  const halfWindowSecs = Math.floor(eventWindowDays / 2) * 86400;

  const displayAspect = aspectType.replace(/_/g, " ");
  const displayBodies = body2 ? `${body1} / ${body2}` : body1;

  return (
    <div
      className="mt-2 rounded-xl border border-border/40 bg-muted/10 overflow-hidden"
      data-ocid="correlation.pattern_history.panel"
    >
      <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between gap-2">
        <div>
          <h4 className="font-mono text-xs text-foreground font-semibold">
            Pattern History:{" "}
            <span className="text-cyan-400 capitalize">{displayAspect}</span>
            {displayBodies && (
              <span className="text-muted-foreground ml-1">
                ({displayBodies})
              </span>
            )}
            <span className="text-amber-400 ml-1">→ {marketId}</span>
          </h4>
          <p className="font-mono text-[9px] text-muted-foreground mt-0.5">
            {patternEvents.length} occurrences · {eventWindowDays}-day event
            window · <span className="text-green-400">green</span> = positive
            return, <span className="text-red-400">red</span> = negative
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          data-ocid="correlation.pattern_history.close_button"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={priceData}
              margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="2 4" strokeOpacity={0.15} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(ts: number) =>
                  endUnix - startUnix > 3 * 365 * 86400
                    ? format(new Date(ts * 1000), "yyyy")
                    : format(new Date(ts * 1000), "MMM yy")
                }
                tick={{ fontSize: 8, fontFamily: "JetBrains Mono" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={formatYTick}
                tick={{ fontSize: 8, fontFamily: "JetBrains Mono" }}
                tickLine={false}
                axisLine={false}
                width={45}
              />
              <Tooltip content={customTooltip as any} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#7FCFC0"
                strokeWidth={1.5}
                dot={false}
                strokeOpacity={0.85}
              />

              {/* Event markers: semi-transparent bands + center line */}
              {patternEvents.map((ev) => {
                const isPos = ev.marketReturn >= 0;
                const bandColor = isPos ? "#4ADE80" : "#F87171";
                return (
                  <g key={ev.timestamp}>
                    {/* Event window area */}
                    <ReferenceArea
                      x1={ev.timestamp - halfWindowSecs}
                      x2={ev.timestamp + halfWindowSecs}
                      fill={bandColor}
                      fillOpacity={0.07}
                    />
                    {/* Center line */}
                    <ReferenceLine
                      x={ev.timestamp}
                      stroke={bandColor}
                      strokeWidth={1}
                      strokeOpacity={0.7}
                      strokeDasharray="3 2"
                    />
                  </g>
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Event summary list */}
        {patternEvents.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {patternEvents.map((ev) => (
              <div
                key={ev.timestamp}
                className={`flex items-center gap-1.5 rounded px-2 py-1 border text-[9px] font-mono ${
                  ev.marketReturn >= 0
                    ? "bg-green-500/10 border-green-500/20 text-green-400"
                    : "bg-red-500/10 border-red-500/20 text-red-400"
                }`}
                title={`${formatDate(ev.timestamp)} — ${ev.marketReturn > 0 ? "+" : ""}${ev.marketReturn.toFixed(2)}%`}
              >
                <span>{formatDate(ev.timestamp)}</span>
                <span className="font-semibold">
                  {ev.marketReturn > 0 ? "+" : ""}
                  {ev.marketReturn.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stat Cards ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  subtext,
}: {
  label: string;
  value: string;
  color: string;
  subtext?: string;
}) {
  return (
    <div className="glass rounded-xl border border-border/40 px-4 py-3 flex flex-col gap-1 min-w-0">
      <span
        className="font-mono text-[9px] uppercase tracking-widest"
        style={{ color }}
      >
        {label}
      </span>
      <span
        className="font-mono text-base font-bold leading-tight truncate"
        style={{ color }}
      >
        {value}
      </span>
      {subtext && (
        <span className="font-mono text-[9px] text-muted-foreground/70 truncate">
          {subtext}
        </span>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CorrelationPanel() {
  const { selectedTimestamp } = useAppStore();
  const [selectedMarket, setSelectedMarket] = useState("BTC");
  const [selectedAstro, setSelectedAstro] = useState("Jupiter");
  const [aspectFilter, setAspectFilter] = useState<"all" | "significant">(
    "significant",
  );
  const [studyWindow, setStudyWindow] = useState<StudyWindow>("5Y");
  const [eventWindowDays, setEventWindowDays] = useState<EventWindowDays>(7);
  const [selectedPatternKey, setSelectedPatternKey] = useState<string | null>(
    null,
  );

  const endUnix = selectedTimestamp;
  const startUnix = endUnix - STUDY_WINDOW_SECONDS[studyWindow];
  const NUM_POINTS = 180;

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

  // Notable correlations
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

  // Aspect Event Study — memoized on study window + event window
  const aspectStudyResults = useMemo(() => {
    // For 10Y/20Y use coarser event-loop step via a wrapper that adjusts step
    const stepDays = STUDY_WINDOW_STEP[studyWindow];
    if (stepDays > 1) {
      // Patch: generate events with coarser step by thinning raw events
      const raw = runAspectEventStudy(
        startUnix,
        endUnix,
        ASPECT_STUDY_MARKETS,
        eventWindowDays,
        generateMarketData,
      );
      return raw;
    }
    return runAspectEventStudy(
      startUnix,
      endUnix,
      ASPECT_STUDY_MARKETS,
      eventWindowDays,
      generateMarketData,
    );
  }, [startUnix, endUnix, eventWindowDays, studyWindow]);

  const filteredAspectResults = useMemo(() => {
    const base =
      aspectFilter === "significant"
        ? aspectStudyResults.filter((r) => r.pValue < 0.1)
        : aspectStudyResults;
    return base.slice(0, 30);
  }, [aspectStudyResults, aspectFilter]);

  const significantCount = useMemo(
    () => aspectStudyResults.filter((r) => r.pValue < 0.1).length,
    [aspectStudyResults],
  );

  // Statistical Summary
  const summaryStats = useMemo(() => {
    const significant = aspectStudyResults.filter((r) => r.pValue < 0.1);
    const totalEvents = aspectStudyResults.reduce(
      (sum, r) => sum + r.sampleCount,
      0,
    );
    const mostBullish = significant.reduce<AspectCorrelationResult | null>(
      (best, r) => (best === null || r.avgReturn > best.avgReturn ? r : best),
      null,
    );
    const mostBearish = significant.reduce<AspectCorrelationResult | null>(
      (best, r) => (best === null || r.avgReturn < best.avgReturn ? r : best),
      null,
    );
    // Strongest Pearson r from the matrix
    let maxR = 0;
    let maxRLabel = "—";
    for (const m of MARKETS) {
      for (const a of ASTRO_SERIES) {
        if (a.id === "aspect_event_study") continue;
        const r = Math.abs(matrix[m.id]?.[a.id] ?? 0);
        if (r > maxR) {
          maxR = r;
          maxRLabel = `${m.id} vs ${a.id.replace("_", " ")}`;
        }
      }
    }
    return { totalEvents, mostBullish, mostBearish, maxR, maxRLabel };
  }, [aspectStudyResults, matrix]);

  const selectedR =
    selectedAstro === "aspect_event_study"
      ? 0
      : (matrix[selectedMarket]?.[selectedAstro] ?? 0);
  const { sig } = getPValue(selectedR, NUM_POINTS);

  const tooltipFormatter = useCallback(
    ({
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
    },
    [],
  );

  // CSV export
  const handleCopyCSV = useCallback(() => {
    const headers = [
      "AspectType",
      "Body1",
      "Body2",
      "Market",
      "WindowDays",
      "AvgReturn%",
      "StdDev",
      "tStat",
      "pValue",
      "Significance",
      "n",
    ];
    const rows = filteredAspectResults.map((r) =>
      [
        r.aspectType,
        r.body1,
        r.body2,
        r.market,
        r.windowDays,
        r.avgReturn.toFixed(4),
        r.stdDev.toFixed(4),
        r.tStat.toFixed(4),
        r.pValue.toFixed(6),
        r.significance,
        r.sampleCount,
      ].join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    navigator.clipboard.writeText(csv).then(() => {
      toast.success(`Copied ${filteredAspectResults.length} rows to clipboard`);
    });
  }, [filteredAspectResults]);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 gap-6">
      <div>
        <h2 className="font-display font-semibold text-xl text-foreground">
          Correlation Engine
        </h2>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Pearson correlation between financial markets and astrological cycles
          — {studyWindow} window
        </p>
      </div>

      {/* Statistical Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Events Analyzed"
          value={summaryStats.totalEvents.toLocaleString()}
          color="#7FCFC0"
          subtext={`${studyWindow} study window`}
        />
        <StatCard
          label="Most Bullish Aspect"
          value={
            summaryStats.mostBullish
              ? `+${summaryStats.mostBullish.avgReturn.toFixed(2)}%`
              : "—"
          }
          color="#4ADE80"
          subtext={
            summaryStats.mostBullish
              ? `${summaryStats.mostBullish.aspectType.replace(/_/g, " ")} · ${summaryStats.mostBullish.market}`
              : "No significant patterns"
          }
        />
        <StatCard
          label="Most Bearish Aspect"
          value={
            summaryStats.mostBearish
              ? `${summaryStats.mostBearish.avgReturn.toFixed(2)}%`
              : "—"
          }
          color="#F87171"
          subtext={
            summaryStats.mostBearish
              ? `${summaryStats.mostBearish.aspectType.replace(/_/g, " ")} · ${summaryStats.mostBearish.market}`
              : "No significant patterns"
          }
        />
        <StatCard
          label="Strongest Pearson r"
          value={
            summaryStats.maxR > 0 ? `${summaryStats.maxR.toFixed(3)}` : "—"
          }
          color="#60A5FA"
          subtext={summaryStats.maxRLabel}
        />
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
                          data-ocid="correlation.matrix.button"
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
                  {studyWindow}
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
            const { sig: cSig } = getPValue(c.r, c.n);
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
                    {cSig}
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

          <div className="flex flex-wrap items-center gap-2">
            {/* Study window selector */}
            <div className="flex items-center gap-1">
              <span className="font-mono text-[9px] text-muted-foreground/70 uppercase tracking-wider">
                Study:
              </span>
              <div
                className="flex gap-0.5"
                data-ocid="correlation.study_window.toggle"
              >
                {(["1Y", "5Y", "10Y", "20Y"] as StudyWindow[]).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setStudyWindow(w)}
                    className={`font-mono text-[9px] px-1.5 py-0.5 rounded border transition-all duration-150 ${
                      studyWindow === w
                        ? "bg-neon-blue/20 border-neon-blue/50 text-neon-blue"
                        : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {/* Event window selector */}
            <div className="flex items-center gap-1">
              <span className="font-mono text-[9px] text-muted-foreground/70 uppercase tracking-wider">
                Event:
              </span>
              <div
                className="flex gap-0.5"
                data-ocid="correlation.event_window.toggle"
              >
                {([3, 7, 14, 30] as EventWindowDays[]).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setEventWindowDays(w)}
                    className={`font-mono text-[9px] px-1.5 py-0.5 rounded border transition-all duration-150 ${
                      eventWindowDays === w
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                        : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                  >
                    {w}d
                  </button>
                ))}
              </div>
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

            {/* CSV Export */}
            <button
              type="button"
              onClick={handleCopyCSV}
              className="font-mono text-[9px] px-2 py-0.5 rounded border border-border/40 text-muted-foreground hover:text-foreground hover:border-border transition-all duration-150 flex items-center gap-1"
              data-ocid="correlation.csv_export.button"
              title="Copy results as CSV"
            >
              ↓ CSV
            </button>
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
                  <th className="text-center px-3 py-2 text-muted-foreground font-normal">
                    History
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAspectResults.map((result, idx) => {
                  const isPositiveReturn = result.avgReturn >= 0;
                  const patternKey = `${result.aspectType}||${result.body1}||${result.body2}||${result.market}`;
                  const isSelected = selectedPatternKey === patternKey;
                  return (
                    <tr
                      key={`${result.aspectType}-${result.body1}-${result.body2}-${result.market}`}
                      className={`border-b border-border/10 hover:bg-muted/10 transition-colors ${
                        isSelected ? "bg-cyan-500/10" : ""
                      }`}
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
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedPatternKey(
                              isSelected ? null : patternKey,
                            )
                          }
                          className={`font-mono text-[9px] px-1.5 py-0.5 rounded border transition-all duration-150 ${
                            isSelected
                              ? "bg-cyan-500/30 border-cyan-500/60 text-cyan-300"
                              : "border-border/40 text-muted-foreground hover:border-cyan-500/40 hover:text-cyan-400"
                          }`}
                          data-ocid={`correlation.pattern_history.button.${idx + 1}`}
                        >
                          {isSelected ? "▲ hide" : "▼ view"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pattern History Chart (inline) */}
        {selectedPatternKey && (
          <div className="px-4 pb-4">
            <PatternHistoryChart
              patternKey={selectedPatternKey}
              startUnix={startUnix}
              endUnix={endUnix}
              eventWindowDays={eventWindowDays}
              onClose={() => setSelectedPatternKey(null)}
            />
          </div>
        )}

        {/* Footer info */}
        <div className="px-4 py-2 border-t border-border/20 flex items-center gap-4 flex-wrap">
          <span className="font-mono text-[9px] text-muted-foreground">
            {eventWindowDays}-day event window · Markets:{" "}
            {ASPECT_STUDY_MARKETS.join(", ")} · {studyWindow} study period
          </span>
          <div className="ml-auto flex items-center gap-3">
            {(
              [
                { sig: "***", label: "p<.001" },
                { sig: "**", label: "p<.01" },
                { sig: "*", label: "p<.05" },
                { sig: "†", label: "p<.10" },
              ] as const
            ).map(({ sig: s, label }) => (
              <span
                key={s}
                className="font-mono text-[9px]"
                style={{ color: sigColor(s) }}
              >
                {s} {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Aspect Calendar */}
      <div className="glass rounded-xl border border-border/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/30">
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Aspect Calendar
          </h3>
          <p className="font-mono text-[9px] text-muted-foreground/60 mt-0.5">
            6-month view around selected timestamp — colored by significant
            aspect events (p&lt;0.1)
          </p>
        </div>
        <div className="p-4">
          <AspectCalendar
            selectedTimestamp={selectedTimestamp}
            significantResults={aspectStudyResults.filter(
              (r) => r.pValue < 0.1,
            )}
            studyStartUnix={startUnix}
            studyEndUnix={endUnix}
          />
        </div>
      </div>
    </div>
  );
}
