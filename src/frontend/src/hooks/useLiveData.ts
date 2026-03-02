import { useMemo } from "react";
import type { LivePrice } from "../backend.d";
import { useBrowserLiveData } from "./useBrowserLiveData";
import { useLiveMarketSnapshot } from "./useQueries";

export function useLiveSnapshot(): {
  snapshot: Map<string, LivePrice>;
  isLive: boolean;
  lastUpdated: Date | null;
} {
  const { data: backendData } = useLiveMarketSnapshot();
  const {
    data: browserData,
    isLive: browserIsLive,
    lastUpdated: browserLastUpdated,
  } = useBrowserLiveData();

  // Merge: browser data takes priority over backend data
  const snapshot = useMemo(() => {
    const merged = new Map<string, LivePrice>();

    // First add backend data as baseline
    const backendSnapshot = backendData ?? new Map<string, LivePrice>();
    for (const [key, val] of backendSnapshot.entries()) {
      merged.set(key, val);
    }

    // Override / add with browser-fetched live data (higher priority)
    for (const [key, val] of browserData.entries()) {
      merged.set(key, val);
    }

    return merged;
  }, [backendData, browserData]);

  // Find the most recent lastUpdated timestamp across all entries
  let maxLastUpdated = 0n;
  for (const entry of snapshot.values()) {
    if (entry.lastUpdated > maxLastUpdated) {
      maxLastUpdated = entry.lastUpdated;
    }
  }

  // Prefer browser lastUpdated since it's more reliable
  const lastUpdated =
    browserLastUpdated ??
    (maxLastUpdated > 0n ? new Date(Number(maxLastUpdated) * 1000) : null);

  const isLive =
    browserIsLive ||
    (lastUpdated !== null &&
      Date.now() - lastUpdated.getTime() < 5 * 60 * 1000);

  return { snapshot, isLive, lastUpdated };
}

export function getLivePriceFor(
  snapshot: Map<string, LivePrice>,
  marketId: string,
): LivePrice | undefined {
  return snapshot.get(marketId);
}
