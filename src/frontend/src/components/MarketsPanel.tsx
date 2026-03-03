import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { memo, useMemo, useState } from "react";
import {
  CartesianGrid,
  Label,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LivePrice } from "../backend.d";
import { getLivePriceFor, useLiveSnapshot } from "../hooks/useLiveData";
import { useAppStore } from "../store/useAppStore";
import { type DataPoint, generateMarketData } from "../utils/marketData";
import { AstroEventBar } from "./AstroEventBar";

type TimeRange = "1M" | "3M" | "1Y" | "5Y" | "10Y" | "20Y" | "All";

const TIME_RANGE_SECONDS: Record<TimeRange, number> = {
  "1M": 30 * 86400,
  "3M": 90 * 86400,
  "1Y": 365 * 86400,
  "5Y": 5 * 365 * 86400,
  "10Y": 10 * 365 * 86400,
  "20Y": 20 * 365 * 86400,
  All: 54 * 365 * 86400,
};

const MARKET_TABS = {
  Crypto: [
    { id: "BTC", name: "Bitcoin", color: "#F7931A" },
    { id: "ETH", name: "Ethereum", color: "#627EEA" },
    { id: "TOTAL_MCAP", name: "Total MCap", color: "#7FCFC0" },
    { id: "ALTSEASON", name: "Altseason Index", color: "#A78BFA" },
  ],
  Stocks: [
    { id: "SP500", name: "S&P 500", color: "#34D399" },
    { id: "NASDAQ", name: "NASDAQ", color: "#60A5FA" },
    { id: "DAX", name: "DAX", color: "#FACC15" },
    { id: "NIKKEI", name: "Nikkei 225", color: "#F87171" },
    { id: "FTSE", name: "FTSE 100", color: "#A78BFA" },
  ],
  Commodities: [
    { id: "GOLD", name: "Gold", color: "#FFD700" },
    { id: "SILVER", name: "Silver", color: "#C0C0C0" },
    { id: "OIL", name: "Oil WTI", color: "#FB923C" },
    { id: "NATGAS", name: "Natural Gas", color: "#86EFAC" },
  ],
  "Forex/Macro": [
    { id: "DXY", name: "DXY (USD)", color: "#60A5FA" },
    { id: "VIX", name: "VIX", color: "#F87171" },
  ],
} as const;

const ALL_MARKET_IDS = [
  ...Object.values(MARKET_TABS).flatMap((markets) => markets.map((m) => m.id)),
  "BTC_DOM",
  "FEAR_GREED",
];

type MarketId = (typeof MARKET_TABS)[keyof typeof MARKET_TABS][number]["id"];

interface MarketChartProps {
  marketId: MarketId | string;
  name: string;
  color: string;
  startUnix: number;
  endUnix: number;
  selectedTimestamp: number;
  liveSnapshot: Map<string, LivePrice>;
  isNow: boolean;
}

const MarketChart = memo(function MarketChart({
  marketId,
  name,
  color,
  startUnix,
  endUnix,
  selectedTimestamp,
  liveSnapshot,
  isNow,
}: MarketChartProps) {
  const data = useMemo(
    () => generateMarketData(marketId, startUnix, endUnix, 300),
    [marketId, startUnix, endUnix],
  );

  const cursorTs = Math.min(selectedTimestamp, endUnix);
  const latestPoint = data[data.length - 1];
  const firstPoint = data[0];

  const liveEntry = isNow ? getLivePriceFor(liveSnapshot, marketId) : undefined;
  const changePct = liveEntry
    ? liveEntry.changePct24h
    : firstPoint
      ? ((latestPoint.value - firstPoint.value) / firstPoint.value) * 100
      : 0;

  const isPositive = changePct >= 0;
  const lineColor = isPositive ? color : "#F87171";

  const formatXTick = (ts: number) => {
    const totalDays = (endUnix - startUnix) / 86400;
    if (totalDays > 365 * 3) return format(new Date(ts * 1000), "yyyy");
    if (totalDays > 90) return format(new Date(ts * 1000), "MMM yy");
    return format(new Date(ts * 1000), "MMM d");
  };

  const formatYTick = (v: number) => {
    if (v >= 1_000_000_000_000) return `${(v / 1e12).toFixed(1)}T`;
    if (v >= 1_000_000) return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
    return v.toFixed(
      marketId === "ALTSEASON" ||
        marketId === "VIX" ||
        marketId === "FEAR_GREED"
        ? 0
        : 2,
    );
  };

  const formatLiveLabel = (v: number) => {
    if (v >= 1_000_000_000_000) return `$${(v / 1e12).toFixed(2)}T`;
    if (v >= 1_000_000) return `$${(v / 1e6).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1000).toFixed(1)}K`;
    return v.toFixed(
      marketId === "ALTSEASON" ||
        marketId === "VIX" ||
        marketId === "FEAR_GREED"
        ? 0
        : 2,
    );
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
      <div className="glass rounded-lg px-3 py-2 border border-border/50 font-mono text-xs z-50">
        <div className="text-muted-foreground">
          {label ? format(new Date(label * 1000), "MMM d, yyyy") : ""}
        </div>
        <div className="text-foreground font-semibold mt-1">
          {formatYTick(payload[0].value)}
        </div>
      </div>
    );
  };

  return (
    <div
      className="glass rounded-xl p-3 border border-border/30 flex flex-col"
      style={{ minHeight: "200px" }}
    >
      <div className="flex items-baseline justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }}
          />
          <span className="font-mono text-xs text-muted-foreground truncate">
            {name}
          </span>
          {isNow && liveEntry && (
            <span className="hidden sm:flex items-center gap-1 bg-green-500/10 border border-green-500/20 rounded-full px-1.5 py-0.5 flex-shrink-0">
              <span className="relative flex h-1 w-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1 w-1 bg-green-500" />
              </span>
              <span className="font-mono text-[8px] text-green-400">LIVE</span>
            </span>
          )}
        </div>
        <span
          className={`font-mono text-xs font-semibold flex-shrink-0 ${isPositive ? "text-green-400" : "text-red-400"}`}
        >
          {isPositive ? "+" : ""}
          {changePct.toFixed(2)}%
        </span>
      </div>

      <div className="flex-1" style={{ minHeight: "160px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data as DataPoint[]}
            margin={{ top: 2, right: 4, left: 0, bottom: 2 }}
          >
            <CartesianGrid strokeDasharray="2 4" strokeOpacity={0.2} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatXTick}
              tick={{ fontSize: 9, fontFamily: "JetBrains Mono" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={formatYTick}
              tick={{ fontSize: 9, fontFamily: "JetBrains Mono" }}
              tickLine={false}
              axisLine={false}
              width={42}
            />
            <Tooltip
              content={customTooltip as any}
              cursor={{ stroke: color, strokeWidth: 1, strokeOpacity: 0.4 }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={1.5}
              dot={false}
              strokeOpacity={0.9}
            />
            {cursorTs > startUnix && cursorTs < endUnix && (
              <ReferenceLine
                x={cursorTs}
                stroke="#F7C948"
                strokeWidth={1.5}
                strokeDasharray="4 2"
              />
            )}
            {isNow && liveEntry && (
              <ReferenceLine
                y={liveEntry.value}
                stroke="#4ADE80"
                strokeWidth={1.5}
                strokeDasharray="3 2"
              >
                <Label
                  value={formatLiveLabel(liveEntry.value)}
                  position="insideTopRight"
                  fill="#4ADE80"
                  fontSize={8}
                  fontFamily="JetBrains Mono"
                />
              </ReferenceLine>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

interface LiveDataStatusBarProps {
  snapshot: Map<string, LivePrice>;
  isLive: boolean;
  lastUpdated: Date | null;
}

const LiveDataStatusBar = memo(function LiveDataStatusBar({
  snapshot,
  isLive,
  lastUpdated,
}: LiveDataStatusBarProps) {
  const liveCount = ALL_MARKET_IDS.filter((id) => snapshot.has(id)).length;
  const totalCount = ALL_MARKET_IDS.length;
  const minutesAgo =
    lastUpdated !== null
      ? Math.floor((Date.now() - lastUpdated.getTime()) / 60000)
      : null;

  let dotColor = "bg-red-500";
  let dotPing = false;
  let statusText = "Not yet fetched";

  if (lastUpdated !== null && minutesAgo !== null) {
    if (minutesAgo < 5) {
      dotColor = "bg-green-500";
      dotPing = true;
      statusText =
        minutesAgo === 0 ? "Updated just now" : `Updated ${minutesAgo}m ago`;
    } else if (minutesAgo < 30) {
      dotColor = "bg-yellow-400";
      statusText = `Updated ${minutesAgo}m ago`;
    } else {
      dotColor = "bg-red-500";
      statusText = `Stale — ${minutesAgo}m ago`;
    }
  }

  return (
    <div
      data-ocid="markets.live_status.panel"
      className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-muted/30 border border-border/20"
    >
      <span className="relative flex h-2 w-2 flex-shrink-0">
        {dotPing && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-75`}
          />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`}
        />
      </span>
      <span className="font-mono text-[9px] text-foreground/70">
        Live feeds:{" "}
        <span className={isLive ? "text-green-400" : "text-muted-foreground"}>
          {liveCount}/{totalCount}
        </span>
      </span>
      <span className="font-mono text-[9px] text-muted-foreground/60 ml-auto">
        {statusText}
      </span>
    </div>
  );
});

export function MarketsPanel() {
  const { selectedTimestamp } = useAppStore();
  const [timeRange, setTimeRange] = useState<TimeRange>("1Y");
  const [activeTab, setActiveTab] = useState("Crypto");
  const { snapshot, isLive, lastUpdated } = useLiveSnapshot();

  const isNow = Math.abs(selectedTimestamp - Date.now() / 1000) < 3600;

  const { startUnix, endUnix } = useMemo(() => {
    const end = selectedTimestamp;
    const rangeSeconds = TIME_RANGE_SECONDS[timeRange];
    const start = Math.max(0, end - rangeSeconds);
    return { startUnix: start, endUnix: end };
  }, [selectedTimestamp, timeRange]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3 sm:p-4 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div>
            <h2 className="font-display font-semibold text-lg sm:text-xl text-foreground">
              Global Markets
            </h2>
            <p className="font-mono text-xs text-muted-foreground mt-0.5">
              Synchronized to timeline cursor
            </p>
          </div>

          {/* Time range buttons */}
          <div className="flex flex-wrap gap-1">
            {(["1M", "3M", "1Y", "5Y", "10Y", "20Y", "All"] as TimeRange[]).map(
              (r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTimeRange(r)}
                  className={`font-mono text-[10px] sm:text-xs px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded border transition-all duration-150
                    ${
                      timeRange === r
                        ? "bg-neon-blue/20 border-neon-blue text-neon-blue"
                        : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                  data-ocid={`markets.timerange.${r.toLowerCase()}.button`}
                >
                  {r}
                </button>
              ),
            )}
          </div>
        </div>

        {/* Live status */}
        <div className="mb-3">
          <LiveDataStatusBar
            snapshot={snapshot}
            isLive={isLive}
            lastUpdated={lastUpdated}
          />
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <div className="px-3 sm:px-4 flex-shrink-0">
          <TabsList className="bg-muted/50 border border-border/30 h-auto flex flex-wrap gap-0.5">
            <TabsTrigger
              value="Crypto"
              className="font-mono text-[10px] sm:text-xs data-[state=active]:bg-neon-blue/20 data-[state=active]:text-neon-blue py-1.5"
              data-ocid="markets.crypto.tab"
            >
              Crypto
            </TabsTrigger>
            <TabsTrigger
              value="Stocks"
              className="font-mono text-[10px] sm:text-xs data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400 py-1.5"
              data-ocid="markets.stocks.tab"
            >
              Stocks
            </TabsTrigger>
            <TabsTrigger
              value="Commodities"
              className="font-mono text-[10px] sm:text-xs data-[state=active]:bg-neon-amber/20 data-[state=active]:text-neon-amber py-1.5"
              data-ocid="markets.commodities.tab"
            >
              Commodities
            </TabsTrigger>
            <TabsTrigger
              value="Forex/Macro"
              className="font-mono text-[10px] sm:text-xs data-[state=active]:bg-neon-purple/20 data-[state=active]:text-neon-purple py-1.5"
              data-ocid="markets.forex.tab"
            >
              Forex/Macro
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto">
          {Object.entries(MARKET_TABS).map(([tab, markets]) => (
            <TabsContent key={tab} value={tab} className="m-0 p-3 sm:p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {markets.map((market) => (
                  <MarketChart
                    key={market.id}
                    marketId={market.id}
                    name={market.name}
                    color={market.color}
                    startUnix={startUnix}
                    endUnix={endUnix}
                    selectedTimestamp={selectedTimestamp}
                    liveSnapshot={snapshot}
                    isNow={isNow}
                  />
                ))}
              </div>

              <div className="mt-4">
                <AstroEventBar startUnix={startUnix} endUnix={endUnix} />
              </div>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
