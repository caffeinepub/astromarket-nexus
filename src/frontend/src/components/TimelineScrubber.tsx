import { format } from "date-fns";
import { Pause, Play, SkipForward } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { type PlaySpeed, useAppStore } from "../store/useAppStore";

const MIN_UNIX = 0; // Jan 1, 1970
const MAX_UNIX = 2208988800; // Jan 1, 2040 approx

function formatTimestamp(ts: number): string {
  return format(new Date(ts * 1000), "MMM d, yyyy");
}

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

  const animate = useCallback(
    (now: number) => {
      if (lastTimeRef.current !== null) {
        const elapsed = (now - lastTimeRef.current) / 1000; // seconds
        setSelectedTimestamp(
          Math.min(selectedTimestamp + playSpeed * elapsed, MAX_UNIX),
        );
      }
      lastTimeRef.current = now;
      animFrameRef.current = requestAnimationFrame(animate);
    },
    [selectedTimestamp, playSpeed, setSelectedTimestamp],
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

  const sliderValue =
    ((selectedTimestamp - MIN_UNIX) / (MAX_UNIX - MIN_UNIX)) * 100;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = Number.parseFloat(e.target.value) / 100;
    setSelectedTimestamp(Math.floor(MIN_UNIX + pct * (MAX_UNIX - MIN_UNIX)));
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

  const SPEEDS: Array<{ label: string; value: PlaySpeed }> = [
    { label: "1d/s", value: 86400 },
    { label: "7d/s", value: 604800 },
    { label: "30d/s", value: 2592000 },
    { label: "365d/s", value: 31536000 },
  ];

  const dateInputValue = format(
    new Date(selectedTimestamp * 1000),
    "yyyy-MM-dd",
  );

  return (
    <div className="flex items-center gap-3 px-4 py-2 w-full">
      {/* Date display */}
      <div className="font-mono text-xs text-neon-teal whitespace-nowrap min-w-[100px]">
        {formatTimestamp(selectedTimestamp)}
      </div>

      {/* Slider */}
      <div className="flex-1 relative group">
        {/* Year markers */}
        <div className="absolute -top-3 left-0 right-0 flex justify-between pointer-events-none">
          {[1970, 1980, 1990, 2000, 2010, 2020, 2030, 2040].map((year) => (
            <span
              key={year}
              className="font-mono text-[9px] text-muted-foreground/50"
              style={{ marginLeft: year === 1970 ? 0 : "auto" }}
            >
              {year}
            </span>
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={0.0001}
          value={sliderValue}
          onChange={handleSliderChange}
          className="w-full h-1.5 appearance-none rounded-full cursor-pointer
            bg-gradient-to-r from-neon-blue/20 via-neon-teal/20 to-neon-purple/20
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
            background: `linear-gradient(to right, oklch(0.7 0.18 195 / 0.6) 0%, oklch(0.7 0.18 195 / 0.6) ${sliderValue}%, oklch(0.25 0.04 265 / 0.4) ${sliderValue}%, oklch(0.25 0.04 265 / 0.4) 100%)`,
          }}
          data-ocid="timeline.scrubber.input"
        />
      </div>

      {/* Play/Pause */}
      <button
        type="button"
        onClick={togglePlaying}
        className={`flex items-center justify-center w-7 h-7 rounded-full border transition-all duration-200
          ${
            isPlaying
              ? "bg-neon-teal/20 border-neon-teal text-neon-teal shadow-neon-teal"
              : "bg-muted border-border text-muted-foreground hover:border-neon-blue hover:text-neon-blue"
          }`}
        data-ocid="timeline.play_button"
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
        className="font-mono text-xs bg-muted border border-border rounded px-1.5 py-1 
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

      {/* Date picker */}
      <input
        type="date"
        value={dateInputValue}
        min="1970-01-01"
        max="2040-12-31"
        onChange={handleDateInput}
        className="font-mono text-xs bg-muted border border-border rounded px-2 py-1 
          text-foreground cursor-pointer hover:border-neon-blue transition-colors
          focus:outline-none focus:ring-1 focus:ring-neon-blue w-32
          [color-scheme:dark]"
        data-ocid="timeline.date.input"
      />

      {/* Now button */}
      <button
        type="button"
        onClick={jumpToNow}
        className="flex items-center gap-1 font-mono text-xs px-2 py-1 rounded border 
          border-border text-muted-foreground hover:border-neon-teal hover:text-neon-teal 
          transition-all duration-200"
        data-ocid="timeline.now_button"
      >
        <SkipForward className="w-3 h-3" />
        Now
      </button>
    </div>
  );
}
