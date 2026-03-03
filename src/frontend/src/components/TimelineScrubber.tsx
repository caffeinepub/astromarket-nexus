import { format } from "date-fns";
import { Pause, Play, SkipForward } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import {
  MAX_TIMESTAMP,
  MIN_TIMESTAMP,
  type PlaySpeed,
  useAppStore,
} from "../store/useAppStore";

const YEAR_TICKS = [1970, 1980, 1990, 2000, 2010, 2020, 2030, 2040];
const MIN_UNIX = MIN_TIMESTAMP;
const MAX_UNIX = MAX_TIMESTAMP;

function tsToPercent(ts: number): number {
  return ((ts - MIN_UNIX) / (MAX_UNIX - MIN_UNIX)) * 100;
}

function percentToTs(pct: number): number {
  return Math.floor(MIN_UNIX + (pct / 100) * (MAX_UNIX - MIN_UNIX));
}

const SPEEDS: Array<{ label: string; value: PlaySpeed }> = [
  { label: "1d/s", value: 86400 },
  { label: "7d/s", value: 604800 },
  { label: "30d/s", value: 2592000 },
  { label: "1y/s", value: 31536000 },
];

export function TimelineScrubber() {
  const {
    selectedTimestamp,
    isPlaying,
    playSpeed,
    setSelectedTimestamp,
    togglePlaying,
    setPlaySpeed,
    jumpToNow,
  } = useAppStore();

  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const tsRef = useRef(selectedTimestamp);
  tsRef.current = selectedTimestamp;

  const animate = useCallback(
    (now: number) => {
      if (lastTimeRef.current !== null) {
        const elapsed = (now - lastTimeRef.current) / 1000;
        const next = Math.min(tsRef.current + playSpeed * elapsed, MAX_UNIX);
        setSelectedTimestamp(next);
        if (next >= MAX_UNIX) {
          useAppStore.getState().setIsPlaying(false);
          return;
        }
      }
      lastTimeRef.current = now;
      animFrameRef.current = requestAnimationFrame(animate);
    },
    [playSpeed, setSelectedTimestamp],
  );

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = null;
      animFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    }
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, animate]);

  const sliderValue = tsToPercent(selectedTimestamp);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = Number.parseFloat(e.target.value);
    setSelectedTimestamp(percentToTs(pct));
  };

  const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      const ts = Math.floor(new Date(val).getTime() / 1000);
      if (!Number.isNaN(ts)) {
        setSelectedTimestamp(Math.max(MIN_UNIX, Math.min(MAX_UNIX, ts)));
      }
    }
  };

  const dateInputValue = format(
    new Date(selectedTimestamp * 1000),
    "yyyy-MM-dd",
  );
  const dateLabel = format(new Date(selectedTimestamp * 1000), "MMM d, yyyy");

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 w-full px-1 sm:px-2">
      {/* Date display — hidden on very small screens */}
      <div className="hidden md:flex items-center gap-1 flex-shrink-0 min-w-[90px]">
        <span className="font-mono text-[10px] text-neon-teal whitespace-nowrap">
          {dateLabel}
        </span>
      </div>

      {/* Slider with year ticks */}
      <div className="flex-1 min-w-0 relative pt-3">
        {/* Year tick labels */}
        <div
          className="absolute -top-0.5 left-0 right-0 flex items-center pointer-events-none"
          aria-hidden="true"
        >
          {YEAR_TICKS.map((year) => {
            const pct = tsToPercent(new Date(`${year}-01-01`).getTime() / 1000);
            return (
              <span
                key={year}
                className="absolute font-mono text-[7px] sm:text-[8px] text-muted-foreground/40 -translate-x-1/2"
                style={{ left: `${pct}%` }}
              >
                {year}
              </span>
            );
          })}
        </div>

        <input
          type="range"
          min={0}
          max={100}
          step={0.00001}
          value={sliderValue}
          onChange={handleSliderChange}
          className="w-full h-1.5 appearance-none rounded-full cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-neon-teal
            [&::-webkit-slider-thumb]:shadow-neon-teal
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3
            [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-neon-teal
            [&::-moz-range-thumb]:border-0"
          style={{
            background: `linear-gradient(to right, oklch(0.7 0.18 195 / 0.7) 0%, oklch(0.7 0.18 195 / 0.7) ${sliderValue}%, oklch(0.25 0.04 265 / 0.4) ${sliderValue}%, oklch(0.25 0.04 265 / 0.4) 100%)`,
          }}
          data-ocid="timeline.scrubber.input"
        />
      </div>

      {/* Play/Pause */}
      <button
        type="button"
        onClick={togglePlaying}
        className={[
          "flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full border transition-all duration-200",
          isPlaying
            ? "bg-neon-teal/20 border-neon-teal text-neon-teal shadow-neon-teal"
            : "bg-muted border-border text-muted-foreground hover:border-neon-blue hover:text-neon-blue",
        ].join(" ")}
        data-ocid="timeline.play_button"
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <Pause className="w-3 h-3" />
        ) : (
          <Play className="w-3 h-3" />
        )}
      </button>

      {/* Speed selector */}
      <select
        value={playSpeed}
        onChange={(e) => setPlaySpeed(Number(e.target.value) as PlaySpeed)}
        className="flex-shrink-0 font-mono text-[10px] sm:text-xs bg-muted border border-border rounded px-1 sm:px-1.5 py-1 
          text-foreground cursor-pointer hover:border-neon-blue transition-colors
          focus:outline-none focus:ring-1 focus:ring-neon-blue"
        data-ocid="timeline.speed.select"
      >
        {SPEEDS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      {/* Date picker — hidden on mobile */}
      <input
        type="date"
        value={dateInputValue}
        min="1970-01-01"
        max="2100-01-01"
        onChange={handleDateInput}
        className="hidden sm:block flex-shrink-0 font-mono text-[10px] sm:text-xs bg-muted border border-border rounded px-1.5 py-1 
          text-foreground cursor-pointer hover:border-neon-blue transition-colors
          focus:outline-none focus:ring-1 focus:ring-neon-blue w-28 sm:w-32
          [color-scheme:dark]"
        data-ocid="timeline.date.input"
      />

      {/* Now button */}
      <button
        type="button"
        onClick={jumpToNow}
        className="flex-shrink-0 flex items-center gap-1 font-mono text-[10px] sm:text-xs px-1.5 sm:px-2 py-1 rounded border 
          border-border text-muted-foreground hover:border-neon-teal hover:text-neon-teal 
          transition-all duration-200 whitespace-nowrap"
        data-ocid="timeline.now_button"
      >
        <SkipForward className="w-3 h-3" />
        <span className="hidden sm:inline">Now</span>
      </button>
    </div>
  );
}
