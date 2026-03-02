# AstroMarket Nexus

## Current State

The platform has:
- A Motoko backend with placeholder HTTP outcall methods (`fetchBtcPrice`, `fetchEthPrice`, `fetchTotalMcap`, `fetchBtcDominance`, `fetchFearGreedIndex`) that are empty stubs — no real HTTP requests are made
- A `getLiveMarketSnapshot()` returning an empty livePricesStore
- A frontend `CorrelationPanel` computing Pearson correlation between market series and continuous planetary longitude series over 5-year windows
- An `OverviewDashboard` computing BTC dominance via a broken formula capped at 80%
- No correlation between discrete aspect *events* (conjunctions, oppositions, retrogrades, full moons) and market price movements
- No automatic surfacing of statistically significant patterns

## Requested Changes (Diff)

### Add

- **Aspect-Event Correlation Engine (frontend)**: Compute market price changes in windows around aspect events (e.g. ±7 days, ±3 days, ±1 day around conjunctions/oppositions/full moons/retrogrades). For each market+aspect_type pair, compute: average return in window, t-statistic, p-value, sample count. Surface top significant patterns automatically (p < 0.05).
- **`AspectCorrelationResult` type**: `{ aspectType, body1, body2, market, windowDays, avgReturn, tStat, pValue, sampleCount, significance }`
- **`computeAspectEventCorrelation()` utility** in `astroCalc.ts`: given a list of aspect event timestamps, a market ID, a window size, and a time range, computes the event-study statistics
- **`AspectPatternPanel` section in `CorrelationPanel`**: Table of automatically-detected significant patterns (p < 0.1), sortable by p-value, showing aspect type, bodies, market, window, avg return, significance stars
- **Live BTC Dominance**: Fetch from CoinGecko global endpoint (`/global`) which returns `market_cap_percentage.btc` directly. Store as a `BTC_DOM` key in livePricesStore.
- **Backend real HTTP outcalls**: Implement `fetchBtcPrice`, `fetchEthPrice`, `fetchTotalMcap`, `fetchBtcDominance`, `fetchFearGreedIndex` with actual HTTP outcall calls to CoinGecko and Alternative.me APIs. Parse JSON responses and store in livePricesStore with correct values.
- **`BTC_DOM` mapping in frontend**: Map the `BTC_DOM` live price to the BTC Dominance KPI card in OverviewDashboard, replacing the broken computed formula.
- **Stock/commodity price feeds**: Add stooq-based feeds for SP500, NASDAQ, GOLD, DXY to the backend heartbeat fetcher.

### Modify

- `OverviewDashboard.tsx`: Replace broken btcDom formula with live `BTC_DOM` value from snapshot (fallback to computed only when not live)
- `CorrelationPanel.tsx`: Add new "Aspect Patterns" tab/section showing `AspectPatternPanel` with auto-detected significant patterns
- `main.mo`: Replace all empty stub functions with real HTTP outcall implementations using `OutcallModule`

### Remove

- The broken btcDom clamping formula in OverviewDashboard (lines 262-263)

## Implementation Plan

1. **Backend (Motoko)**: Implement `fetchBtcPrice` → CoinGecko `/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true`; `fetchEthPrice` → same endpoint with `ethereum`; `fetchTotalMcap` + `fetchBtcDominance` → CoinGecko `/global` (parses total_market_cap.usd and market_cap_percentage.btc); `fetchFearGreedIndex` → Alternative.me `/fng/`. Store each in livePricesStore with marketId keys: `BTC`, `ETH`, `TOTAL_MCAP`, `BTC_DOM`, `FEAR_GREED`.
2. **`computeAspectEventCorrelation()` utility**: Takes aspect events in a time range, groups by aspect type, for each event computes the market return in a ±windowDays window using `generateMarketData`, aggregates mean and t-stat using paired t-test approximation.
3. **`CorrelationPanel` Aspect Patterns section**: Runs event-study for all (market × aspect_type) combinations over the selected time window, ranks by p-value, shows top 10 significant findings with color-coded significance stars.
4. **Fix BTC Dominance in OverviewDashboard**: Use `getLivePriceFor(snapshot, 'BTC_DOM')` when live, else fall back to a reasonable estimate using BTC price / total mcap ratio from simulated data.
