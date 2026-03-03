# AstroMarket Nexus — Full Rebuild

## Current State

The app exists with:
- A Motoko backend that stores market data, planetary positions, aspect events, moon phases, and annotations. HTTP outcall stubs for live market data (BTC, ETH, total mcap, BTC dominance, fear & greed) exist but the actual fetch logic is empty (no-op functions).
- A React frontend with 8 panels: Overview, Markets, SolarSystem3D, Zodiac, Correlation, Cycles, Annotations, CosmicScale.
- Market data is 100% simulated via seeded pseudo-random deterministic generation (not live).
- Live price data is fetched client-side from CoinGecko/Alternative.me via browser fetch (not backend outcalls).
- The UI has scaling issues, inconsistent data quality, and several stubs/broken features (BTC dominance stuck, correlation engine partially simulated, cycles panel incomplete).
- The app uses a dark space-themed design with neon accents, custom CSS, Recharts for charting, React Three Fiber for 3D solar system.

## Requested Changes (Diff)

### Add

**Backend (Motoko):**
- Real HTTP outcall implementations fetching:
  - CoinGecko `/global` for crypto market cap, BTC dominance, ETH price, BTC price, altcoin season estimate
  - Alternative.me Fear & Greed Index
  - Coinpaprika or Yahoo Finance proxies for stock indices (SP500, NASDAQ, DAX, NIKKEI, FTSE)
  - Yahoo Finance/Metals-API for Gold, Silver, Oil, DXY, VIX
- A `fetchAllLiveData()` composite function calling all subcategory fetchers
- A scheduled heartbeat to auto-refresh data every 60s
- `LiveMarketSnapshot` type with marketId, value, change24h, changePct24h, lastUpdated, source
- Endpoint to return all live snapshots keyed by marketId
- Annotation CRUD with tags, research notes (existing, cleaned up)
- `ResearchNote` type for storing named correlations discovered by users
- `getSystemStatus()` endpoint returning last fetch times and source health per feed

**Frontend:**
- Complete responsive layout: top bar + collapsible left sidebar + main content, works on mobile/tablet/desktop
- Overview panel: live KPI grid (10+ markets), active aspects, moon phase, altseason gauge, fear & greed gauge, market breadth summary, today's important astro events
- Markets panel: tabbed (Crypto / Stocks / Commodities / Forex+Macro / Precious Metals), per-market interactive line charts with astro event overlay bands, synchronized to global timeline scrubber, time range selector 1M/3M/1Y/5Y/10Y/20Y/All, live price reference line when viewing present
- Solar System 3D panel: interactive WebGL orrery using React Three Fiber, correct planet scale/position from computed ephemeris, animated time playback, planet selection, aspect lines drawn between selected planets, info tooltip on hover
- Zodiac Wheel panel: SVG zodiac wheel with all planet glyphs rendered at computed longitudes, aspect lines, retrograde indicators, current transits list
- Correlation Engine panel: 
  - Pearson correlation heatmap (markets × astro series) computed over selected time window
  - Auto-detected pattern table (aspect event study) with statistical significance stars, average return, t-stat, p-value
  - Pattern history chart: click any row → shows full price history with event bands overlaid
  - Rolling correlation chart (90d / 180d window)
  - CSV export
- Cycles Analysis panel: DFT power spectrum per market, phase synchronization matrix against planetary periods, resonance detection table, Fourier beat diagram
- Cosmic Scale panel: scale comparison visualization from quantum → solar → galactic → universe scale
- Annotations panel: research notes CRUD, tag filtering, timeline annotation overlay, export
- Global timeline scrubber in top bar: drag slider from 1970 to 2040+, play/pause/speed buttons, jump-to-now, date display
- Astro event bar: horizontal scrollable event timeline below charts showing moon phases, retrogrades, conjunctions as colored chips
- Live data feed status bar in Markets panel

### Modify

**Backend:**
- Replace empty no-op fetch functions with real HTTP outcall logic using the outcall module
- Transform responses correctly (strip headers that break consensus)
- Add proper error handling and caching (store last good value, don't fail on network error)

**Frontend:**
- Fix all responsive scaling: sidebar collapses to icon-only on tablet, hidden on mobile with hamburger menu
- Fix BTC Dominance: always read from live data or real computed value, remove broken simulated formula
- Fix all data labels and formatting (large numbers, % formatting, price precision)
- Improve chart performance: memo all chart data, use virtualization for large ranges
- Improve 3D solar system: smoother planet orbits, better lighting, planet rings (Saturn), moon orbit visible
- Add proper error states and loading skeletons throughout
- Ensure all interactive elements have deterministic data-ocid markers
- Fix timeline scrubber to correctly drive all panels simultaneously
- Add keyboard shortcuts: Space = play/pause, Left/Right arrows = step time

### Remove

- Broken/stub correlation computation in backend (replaced with real frontend engine)
- Dead `seedData` function (keep empty for backward compat)
- Duplicate live-data fetching (consolidate to backend outcalls only, remove browser-side CoinGecko calls)

## Implementation Plan

1. **Backend Motoko**: Implement real HTTP outcalls for all market feeds with caching, error handling, transform function, heartbeat. Expose `fetchAllLiveData`, `getLiveMarketSnapshot`, `getSystemStatus`, `getAnnotations`, `addAnnotation`, `updateAnnotation`, `deleteAnnotation`.

2. **Store / State**: Rebuild `useAppStore` with all state: selectedTimestamp, timeRange, playback, selectedMarkets, selectedBodies, activePanels, research notes.

3. **Utility layer**: Keep `astroCalc.ts` (extend with better ephemeris), keep `marketData.ts` (historical simulation for pre-live eras), add `liveDataAdapter.ts` to normalize backend live prices into the app data model.

4. **Component tree**:
   - `App.tsx`: layout shell (topbar + sidebar + main), global keyboard listeners
   - `TimelineScrubber.tsx`: timeline bar in header
   - `OverviewDashboard.tsx`: KPI grid + aspects + events
   - `MarketsPanel.tsx`: tabbed charts with event overlay
   - `SolarSystem3D.tsx`: R3F orrery
   - `ZodiacWheel.tsx`: SVG zodiac
   - `CorrelationPanel.tsx`: heatmap + event study + rolling chart
   - `CyclesPanel.tsx`: FFT + phase sync
   - `CosmicScalePanel.tsx`: scale visualization
   - `AnnotationsPanel.tsx`: research notes
   - `AstroEventBar.tsx`: event timeline bar
   - Shared UI: `KPICard`, `LiveBadge`, `DataStatusBar`, `ChartContainer`, `LoadingSkeleton`

5. **Responsive**: CSS grid + flex, sidebar widths via CSS variables, breakpoints at 768px and 1024px.

6. **Validation**: TypeScript strict, biome lint, vite build.
