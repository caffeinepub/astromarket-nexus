import { useCallback, useEffect, useRef, useState } from "react";
import type { LivePrice } from "../backend.d";

const COINGECKO_PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true";
const COINGECKO_GLOBAL_URL = "https://api.coingecko.com/api/v3/global";
const FEAR_GREED_URL = "https://api.alternative.me/fng/?limit=1&format=json";

function nowBigInt(): bigint {
  return BigInt(Math.floor(Date.now() / 1000));
}

async function fetchCoinGeckoPrices(): Promise<
  Partial<Record<string, LivePrice>>
> {
  const res = await fetch(COINGECKO_PRICE_URL, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`CoinGecko prices: HTTP ${res.status}`);
  const json = await res.json();

  const result: Partial<Record<string, LivePrice>> = {};
  const ts = nowBigInt();

  if (json.bitcoin) {
    const btcPrice: number = json.bitcoin.usd ?? 0;
    const btcChange: number = json.bitcoin.usd_24h_change ?? 0;
    const btcPrev = btcPrice / (1 + btcChange / 100);
    result.BTC = {
      marketId: "BTC",
      value: btcPrice,
      change24h: btcPrice - btcPrev,
      changePct24h: btcChange,
      lastUpdated: ts,
    };
  }

  if (json.ethereum) {
    const ethPrice: number = json.ethereum.usd ?? 0;
    const ethChange: number = json.ethereum.usd_24h_change ?? 0;
    const ethPrev = ethPrice / (1 + ethChange / 100);
    result.ETH = {
      marketId: "ETH",
      value: ethPrice,
      change24h: ethPrice - ethPrev,
      changePct24h: ethChange,
      lastUpdated: ts,
    };
  }

  return result;
}

async function fetchCoinGeckoGlobal(): Promise<
  Partial<Record<string, LivePrice>>
> {
  const res = await fetch(COINGECKO_GLOBAL_URL, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`CoinGecko global: HTTP ${res.status}`);
  const json = await res.json();
  const data = json.data;
  if (!data) throw new Error("CoinGecko global: missing data");

  const result: Partial<Record<string, LivePrice>> = {};
  const ts = nowBigInt();

  // Total market cap in trillions
  const totalMcapUsd: number = data.total_market_cap?.usd ?? 0;
  const totalMcapTrillion = totalMcapUsd / 1e12;
  const totalChange24h: number = data.market_cap_change_percentage_24h_usd ?? 0;
  result.TOTAL_MCAP = {
    marketId: "TOTAL_MCAP",
    value: totalMcapTrillion,
    change24h: 0,
    changePct24h: totalChange24h,
    lastUpdated: ts,
  };

  // BTC dominance (0-100 percentage)
  const btcDom: number = data.market_cap_percentage?.btc ?? 0;
  result.BTC_DOM = {
    marketId: "BTC_DOM",
    value: btcDom,
    change24h: 0,
    changePct24h: 0,
    lastUpdated: ts,
  };

  return result;
}

async function fetchFearGreed(): Promise<Partial<Record<string, LivePrice>>> {
  const res = await fetch(FEAR_GREED_URL, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Fear & Greed: HTTP ${res.status}`);
  const json = await res.json();
  const entry = json.data?.[0];
  if (!entry) throw new Error("Fear & Greed: missing data");

  const ts = nowBigInt();
  const fgValue: number = Number(entry.value) ?? 50;

  return {
    FEAR_GREED: {
      marketId: "FEAR_GREED",
      value: fgValue,
      change24h: 0,
      changePct24h: 0,
      lastUpdated: ts,
    },
  };
}

export function useBrowserLiveData(): {
  data: Map<string, LivePrice>;
  isLive: boolean;
  lastUpdated: Date | null;
} {
  const [data, setData] = useState<Map<string, LivePrice>>(new Map());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    const merged: Map<string, LivePrice> = new Map();

    // Run all three fetches in parallel; catch individual failures gracefully
    const results = await Promise.allSettled([
      fetchCoinGeckoPrices(),
      fetchCoinGeckoGlobal(),
      fetchFearGreed(),
    ]);

    for (const result of results) {
      if (result.status === "fulfilled") {
        for (const [key, val] of Object.entries(result.value)) {
          if (val) merged.set(key, val);
        }
      }
      // silently swallow rejections — partial data is better than nothing
    }

    if (merged.size > 0) {
      setData(merged);
      setLastUpdated(new Date());
    }
  }, []);

  useEffect(() => {
    fetchAll();
    intervalRef.current = setInterval(fetchAll, 60_000);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [fetchAll]);

  const isLive =
    lastUpdated !== null && Date.now() - lastUpdated.getTime() < 5 * 60 * 1000;

  return { data, isLive, lastUpdated };
}
