# AstroMarket Nexus

## Current State

The platform has 6 panels: Overview Dashboard, Markets Panel (with live price feeds), Solar System 3D, Zodiac Wheel, Correlation Engine, and Annotations. The Correlation Engine runs a 5-year Aspect Event Study with lookback window fixed at 5 years, showing a flat table of patterns ranked by p-value. The Markets panel has 1M/3M/1Y/5Y/All time range buttons. There is no "pattern history" chart that overlays astrological events on prices. The event study window is hard-coded to 7 days.

## Requested Changes (Diff)

### Add

1. **Extended Lookback Windows (10Y, 20Y)** in the Aspect Event Study. The user should be able to select the study period: 1Y, 5Y, 10Y, 20Y. The matrix correlation window and rolling correlation window should also be adjustable (5Y, 10Y, 20Y).

2. **Pattern History Chart** — a new chart in the Correlation panel that, for any selected (market, aspect type) pair from the study results, renders a full price chart and overlays vertical marker lines at each historical occurrence of that aspect event. Hovering a marker shows event date, price at event, and window return. This allows visual inspection of every occurrence.

3. **Event Window Selector** — let the user pick the event window width: 3 days, 7 days, 14 days, 30 days.

4. **Market Navigator enhancement** — add 10Y and 20Y buttons to the Markets panel time range selector (in addition to existing 1M/3M/1Y/5Y/All).

5. **Cycle Analysis Panel (new tab)** — a dedicated panel called "Cycles" that shows:
   - Fourier / periodogram analysis: identifies dominant periodicity in any market vs any astro series (e.g. "BTC has a 398-day dominant cycle that aligns with Jupiter's synodic period")
   - A visual spectral chart showing power vs period
   - A "phase synchronization" score showing how well market cycles are phase-locked to a planetary cycle

6. **Aspect Calendar** — a new scrollable calendar/timeline in the Correlation panel that shows upcoming and past astrological events in a calendar-style grid with the market performance overlaid as color coding (green = positive return post-event, red = negative).

7. **Statistical Summary Cards** in Correlation panel header — showing: total events analyzed, most bullish aspect, most bearish aspect, strongest correlation pair.

8. **Export hint** — add a copy-to-clipboard button on the aspect study table to export results as CSV text.

### Modify

- `CorrelationPanel.tsx`: Add lookback window selector (1Y/5Y/10Y/20Y), event window selector (3d/7d/14d/30d), pattern history chart section, statistical summary cards, aspect calendar section, CSV export button.
- `MarketsPanel.tsx`: Add 10Y and 20Y buttons to time range buttons row.
- `astroCalc.ts`: Add `runAspectEventStudyExtended` export that accepts explicit `windowDays` and start/end (already has this but the UI wasn't wiring it). Add `computeDominantPeriods` function for Fourier periodogram. Add `computePhaseSync` function.
- `App.tsx`: Add "Cycles" panel to NAV_ITEMS with a FlaskConical or Activity icon. Add `CyclesPanel` to panel routing.
- New file `CyclesPanel.tsx`: Fourier analysis UI.

### Remove

- Nothing removed.

## Implementation Plan

1. **Extend `astroCalc.ts`**:
   - Add `computeDominantPeriods(series: number[], sampleRateDays: number): Array<{period: number, power: number}>` using DFT approximation
   - Add `computePhaseSync(series1: number[], series2: number[], periodDays: number): number` using circular statistics
   - Export constants for known planetary synodic periods

2. **Extend `MarketsPanel.tsx`**:
   - Add `"10Y"` and `"20Y"` to `TimeRange` type and `TIME_RANGE_SECONDS` map
   - Add the two new buttons to the time range row

3. **Update `CorrelationPanel.tsx`**:
   - Add `studyWindow` state: `"1Y" | "5Y" | "10Y" | "20Y"` (default `"5Y"`)
   - Add `eventWindowDays` state: `3 | 7 | 14 | 30` (default `7`)
   - Wire both into `runAspectEventStudy` call
   - Add statistical summary cards at top: total events, most bullish, most bearish, best r pair
   - Add Pattern History Chart: when user clicks a row in the aspect study table, open an inline expanded chart showing the full price history with vertical lines at each event occurrence
   - Add Aspect Calendar section: scrollable 6-month calendar with colored squares per day based on significant events
   - Add CSV export clipboard button in the table header

4. **Create `CyclesPanel.tsx`**:
   - Market selector + astro series selector
   - Compute DFT on the combined/individual series
   - Plot power spectrum (period on x-axis, power on y-axis) as a bar/area chart
   - Highlight known planetary synodic periods as reference lines
   - Phase synchronization score display

5. **Update `App.tsx`**:
   - Add `"cycles"` to `ActivePanel` type
   - Add Cycles nav item
   - Render `<CyclesPanel />` for `activePanel === "cycles"`

6. **Wire everything and validate** (typecheck + build).
