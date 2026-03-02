import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { Line, LineChart, ReferenceLine, ResponsiveContainer } from "recharts";
import { getLivePriceFor, useLiveSnapshot } from "../hooks/useLiveData";
import { useAppStore } from "../store/useAppStore";
import {
  PLANET_GLYPHS,
  computeAspects,
  getMoonPhase,
} from "../utils/astroCalc";
import { generateMarketData, getMarketChange } from "../utils/marketData";

interface KPICardProps {
  title: string;
  value: string;
  subValue?: string;
  change?: number;
  sparkData?: Array<{ v: number }>;
  sparkColor?: string;
  accentColor?: string;
  icon?: React.ReactNode;
  gauge?: number; // 0-100
}

function KPICard({
  title,
  value,
  subValue,
  change,
  sparkData,
  sparkColor = "#7FCFC0",
  accentColor = "oklch(0.7 0.18 195)",
  icon,
  gauge,
}: KPICardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const changeColor = isPositive
    ? "text-green-400"
    : isNegative
      ? "text-red-400"
      : "text-muted-foreground";

  return (
    <div
      className="relative glass rounded-xl p-4 overflow-hidden group hover:border-neon-blue/40 
        transition-all duration-300 border border-border/50"
      style={{
        background:
          "linear-gradient(135deg, oklch(0.13 0.02 265 / 0.9) 0%, oklch(0.11 0.015 265 / 0.95) 100%)",
      }}
    >
      {/* Accent glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 0% 0%, ${accentColor}10 0%, transparent 60%)`,
        }}
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {title}
          </span>
          {icon && <span className="text-base opacity-60">{icon}</span>}
        </div>

        <div className="flex items-end justify-between">
          <div>
            <div className="font-display font-semibold text-xl text-foreground leading-tight">
              {value}
            </div>
            {subValue && (
              <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                {subValue}
              </div>
            )}
            {change !== undefined && (
              <div
                className={`flex items-center gap-0.5 font-mono text-[10px] mt-1 ${changeColor}`}
              >
                {isPositive ? (
                  <TrendingUp className="w-2.5 h-2.5" />
                ) : isNegative ? (
                  <TrendingDown className="w-2.5 h-2.5" />
                ) : (
                  <Minus className="w-2.5 h-2.5" />
                )}
                {change > 0 ? "+" : ""}
                {change.toFixed(2)}%
              </div>
            )}
          </div>

          {/* Sparkline */}
          {sparkData && sparkData.length > 0 && (
            <div className="w-20 h-10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkData}>
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke={sparkColor}
                    dot={false}
                    strokeWidth={1.5}
                    strokeOpacity={0.9}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Gauge */}
          {gauge !== undefined && (
            <div className="relative w-12 h-12">
              <svg
                viewBox="0 0 48 48"
                className="w-full h-full"
                role="img"
                aria-label={`Gauge: ${Math.round(gauge ?? 0)}`}
              >
                <circle
                  cx="24"
                  cy="24"
                  r="18"
                  fill="none"
                  stroke="oklch(0.25 0.04 265)"
                  strokeWidth="6"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="18"
                  fill="none"
                  stroke={sparkColor}
                  strokeWidth="6"
                  strokeDasharray={`${(gauge / 100) * 113} 113`}
                  strokeLinecap="round"
                  transform="rotate(-90 24 24)"
                  style={{ filter: `drop-shadow(0 0 4px ${sparkColor})` }}
                />
                <text
                  x="24"
                  y="28"
                  textAnchor="middle"
                  fill="white"
                  fontSize="10"
                  fontFamily="JetBrains Mono"
                  fontWeight="600"
                >
                  {Math.round(gauge)}
                </text>
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Moon phase icons
function getMoonIcon(phase: string): string {
  const map: Record<string, string> = {
    "New Moon": "🌑",
    "Waxing Crescent": "🌒",
    "First Quarter": "🌓",
    "Waxing Gibbous": "🌔",
    "Full Moon": "🌕",
    "Waning Gibbous": "🌖",
    "Last Quarter": "🌗",
    "Waning Crescent": "🌘",
  };
  return map[phase] ?? "🌕";
}

function formatLargeNumber(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
}

export function OverviewDashboard() {
  const { selectedTimestamp } = useAppStore();
  const { snapshot, isLive, lastUpdated } = useLiveSnapshot();

  // Determine if we're viewing the present (within 1 hour of now)
  const isNow = Math.abs(selectedTimestamp - Date.now() / 1000) < 3600;

  const data = useMemo(() => {
    const sparkPoints = 30;
    const sparkStart = selectedTimestamp - 30 * 86400;

    // Generate all sparklines and values
    const btcData = generateMarketData(
      "BTC",
      sparkStart,
      selectedTimestamp,
      sparkPoints,
    );
    const btcChange = getMarketChange("BTC", selectedTimestamp, 86400);

    const ethData = generateMarketData(
      "ETH",
      sparkStart,
      selectedTimestamp,
      sparkPoints,
    );
    const ethChange = getMarketChange("ETH", selectedTimestamp, 86400);

    const sp500Data = generateMarketData(
      "SP500",
      sparkStart,
      selectedTimestamp,
      sparkPoints,
    );
    const sp500Change = getMarketChange("SP500", selectedTimestamp, 86400);

    const goldData = generateMarketData(
      "GOLD",
      sparkStart,
      selectedTimestamp,
      sparkPoints,
    );
    const goldChange = getMarketChange("GOLD", selectedTimestamp, 86400);

    const dxyData = generateMarketData(
      "DXY",
      sparkStart,
      selectedTimestamp,
      sparkPoints,
    );
    const dxyChange = getMarketChange("DXY", selectedTimestamp, 86400);

    const altData = generateMarketData(
      "ALTSEASON",
      sparkStart,
      selectedTimestamp,
      sparkPoints,
    );
    const altChange = getMarketChange("ALTSEASON", selectedTimestamp, 86400);

    const fearData = generateMarketData(
      "FEAR_GREED",
      sparkStart,
      selectedTimestamp,
      sparkPoints,
    );
    const fearChange = getMarketChange("FEAR_GREED", selectedTimestamp, 86400);

    const totalData = generateMarketData(
      "TOTAL_MCAP",
      sparkStart,
      selectedTimestamp,
      sparkPoints,
    );
    const totalChange = getMarketChange("TOTAL_MCAP", selectedTimestamp, 86400);

    // Bitcoin dominance: realistic historical estimate (live value overrides this in render)
    const btcDomRaw = (btcChange.value / (totalChange.value * 150)) * 100;
    const btcDomNorm = Math.max(25, Math.min(75, btcDomRaw));

    const moonPhase = getMoonPhase(selectedTimestamp);
    const aspects = computeAspects(selectedTimestamp);

    return {
      btc: btcData.map((p) => ({ v: p.value })),
      btcValue: btcChange.value,
      btcChangePct: btcChange.changePct,
      eth: ethData.map((p) => ({ v: p.value })),
      ethValue: ethChange.value,
      ethChangePct: ethChange.changePct,
      sp500: sp500Data.map((p) => ({ v: p.value })),
      sp500Value: sp500Change.value,
      sp500ChangePct: sp500Change.changePct,
      gold: goldData.map((p) => ({ v: p.value })),
      goldValue: goldChange.value,
      goldChangePct: goldChange.changePct,
      dxy: dxyData.map((p) => ({ v: p.value })),
      dxyValue: dxyChange.value,
      dxyChangePct: dxyChange.changePct,
      alt: altData.map((p) => ({ v: p.value })),
      altValue: altChange.value,
      altChangePct: altChange.changePct,
      fear: fearData.map((p) => ({ v: p.value })),
      fearValue: fearChange.value,
      fearChangePct: fearChange.changePct,
      total: totalData.map((p) => ({ v: p.value })),
      totalValue: totalChange.value * 1e9,
      totalChangePct: totalChange.changePct,
      btcDom: btcDomNorm,
      moonPhase,
      aspectCount: aspects.length,
    };
  }, [selectedTimestamp]);

  // Helper: get live-overridden value and change pct for a market
  function liveValue(marketId: string, fallbackValue: number): number {
    if (!isNow) return fallbackValue;
    const live = getLivePriceFor(snapshot, marketId);
    return live ? live.value : fallbackValue;
  }

  function liveChangePct(marketId: string, fallbackChangePct: number): number {
    if (!isNow) return fallbackChangePct;
    const live = getLivePriceFor(snapshot, marketId);
    return live ? live.changePct24h : fallbackChangePct;
  }

  // Derived live values
  const btcVal = liveValue("BTC", data.btcValue);
  const btcChg = liveChangePct("BTC", data.btcChangePct);
  const sp500Val = liveValue("SP500", data.sp500Value);
  const sp500Chg = liveChangePct("SP500", data.sp500ChangePct);
  const goldVal = liveValue("GOLD", data.goldValue);
  const goldChg = liveChangePct("GOLD", data.goldChangePct);
  const dxyVal = liveValue("DXY", data.dxyValue);
  const dxyChg = liveChangePct("DXY", data.dxyChangePct);
  const altVal = liveValue("ALTSEASON", data.altValue);
  const altChg = liveChangePct("ALTSEASON", data.altChangePct);
  const fearVal = liveValue("FEAR_GREED", data.fearValue);

  // Total market cap: backend returns value in trillions
  const rawTotalLive = getLivePriceFor(snapshot, "TOTAL_MCAP");
  const totalVal =
    isNow && rawTotalLive ? rawTotalLive.value * 1e12 : data.totalValue;
  const totalChg = liveChangePct("TOTAL_MCAP", data.totalChangePct);

  // Minutes since last update
  const minutesAgo =
    lastUpdated !== null
      ? Math.floor((Date.now() - lastUpdated.getTime()) / 60000)
      : null;

  // Sparkline ref line at 0 for visualization
  const _ = ReferenceLine;

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-display font-semibold text-xl text-foreground">
              Market Overview
            </h2>
            {isNow && isLive && (
              <div
                data-ocid="overview.live_badge.panel"
                className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 rounded-full px-2.5 py-0.5"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                </span>
                <span className="font-mono text-[9px] text-green-400 tracking-widest font-semibold">
                  LIVE
                </span>
              </div>
            )}
          </div>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            Global financial & astrological snapshot at selected time
          </p>
          {isNow && isLive && minutesAgo !== null && (
            <p className="font-mono text-[9px] text-green-400/70 mt-0.5">
              Last updated:{" "}
              {minutesAgo === 0 ? "just now" : `${minutesAgo} min ago`}
            </p>
          )}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {/* Crypto Total MCap */}
        <KPICard
          title="Crypto Market Cap"
          value={formatLargeNumber(totalVal)}
          change={totalChg}
          sparkData={data.total}
          sparkColor="#7FCFC0"
          accentColor="oklch(0.7 0.18 195)"
          icon="₿"
        />

        {/* Bitcoin */}
        <KPICard
          title="Bitcoin (BTC)"
          value={`$${btcVal.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`}
          subValue="USD per BTC"
          change={btcChg}
          sparkData={data.btc}
          sparkColor="#F7931A"
          accentColor="oklch(0.75 0.2 50)"
          icon="₿"
        />

        {/* Bitcoin Dominance */}
        {(() => {
          const btcDomValue =
            isNow && snapshot.has("BTC_DOM")
              ? (getLivePriceFor(snapshot, "BTC_DOM")?.value ?? 50)
              : Math.max(25, Math.min(65, data.btcDom));
          return (
            <KPICard
              title="BTC Dominance"
              value={`${btcDomValue.toFixed(1)}%`}
              subValue="of total crypto mcap"
              gauge={btcDomValue}
              sparkColor="#F7931A"
              accentColor="oklch(0.75 0.2 50)"
            />
          );
        })()}

        {/* Altseason Index */}
        <KPICard
          title="Altseason Index"
          value={`${altVal.toFixed(0)}/100`}
          subValue={
            altVal > 75
              ? "🚀 Altseason!"
              : altVal > 50
                ? "Alt Trending"
                : "BTC Season"
          }
          change={altChg}
          gauge={altVal}
          sparkColor="#A78BFA"
          accentColor="oklch(0.6 0.22 290)"
        />

        {/* S&P 500 */}
        <KPICard
          title="S&P 500"
          value={sp500Val.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
          change={sp500Chg}
          sparkData={data.sp500}
          sparkColor="#34D399"
          accentColor="oklch(0.72 0.2 145)"
          icon="📈"
        />

        {/* Gold */}
        <KPICard
          title="Gold (XAU/USD)"
          value={`$${goldVal.toFixed(0)}`}
          change={goldChg}
          sparkData={data.gold}
          sparkColor="#FFD700"
          accentColor="oklch(0.78 0.2 65)"
          icon="🥇"
        />

        {/* DXY */}
        <KPICard
          title="DXY (USD Index)"
          value={dxyVal.toFixed(2)}
          change={dxyChg}
          sparkData={data.dxy}
          sparkColor="#60A5FA"
          accentColor="oklch(0.65 0.22 240)"
          icon="💵"
        />

        {/* Fear & Greed */}
        <KPICard
          title="Fear & Greed"
          value={`${fearVal.toFixed(0)}/100`}
          subValue={
            fearVal > 75
              ? "Extreme Greed 🟢"
              : fearVal > 55
                ? "Greed 🟡"
                : fearVal > 45
                  ? "Neutral ⚪"
                  : fearVal > 25
                    ? "Fear 🟠"
                    : "Extreme Fear 🔴"
          }
          gauge={fearVal}
          sparkColor={
            fearVal > 55 ? "#4ADE80" : fearVal > 45 ? "#FACC15" : "#F87171"
          }
          accentColor={
            fearVal > 55
              ? "oklch(0.72 0.2 145)"
              : fearVal > 45
                ? "oklch(0.78 0.2 65)"
                : "oklch(0.62 0.22 25)"
          }
        />

        {/* Moon Phase */}
        <KPICard
          title="Moon Phase"
          value={data.moonPhase.phase}
          subValue={`${data.moonPhase.illumination.toFixed(1)}% illuminated`}
          icon={getMoonIcon(data.moonPhase.phase)}
          sparkColor="#C8C8D4"
          accentColor="oklch(0.7 0.04 265)"
        />

        {/* Active Aspects */}
        <KPICard
          title="Active Aspects"
          value={`${data.aspectCount}`}
          subValue="planetary aspects"
          icon={
            <span className="flex gap-0.5 text-xs">
              {["☿", "♃", "♄"].map((g) => (
                <span key={g}>{g}</span>
              ))}
            </span>
          }
          sparkColor="#A78BFA"
          accentColor="oklch(0.6 0.22 290)"
        />
      </div>

      {/* Active Aspects Detail */}
      <div className="mt-6 glass rounded-xl p-4 border border-border/50">
        <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
          Active Planetary Aspects
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
          {computeAspects(selectedTimestamp)
            .slice(0, 8)
            .map((aspect, idx) => (
              <div
                key={`${aspect.body1}-${aspect.body2}-${aspect.aspectType}-${idx}`}
                className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2"
              >
                <span className="text-sm">
                  {PLANET_GLYPHS[aspect.body1] ?? aspect.body1[0]}
                </span>
                <span className="font-mono text-[9px] text-muted-foreground">
                  {aspect.aspectType}
                </span>
                <span className="text-sm">
                  {PLANET_GLYPHS[aspect.body2] ?? aspect.body2[0]}
                </span>
                <span className="font-mono text-[9px] text-muted-foreground ml-auto">
                  {aspect.orb.toFixed(1)}°
                </span>
              </div>
            ))}
          {computeAspects(selectedTimestamp).length === 0 && (
            <div className="col-span-4 text-center font-mono text-xs text-muted-foreground py-2">
              No major aspects at this time
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
