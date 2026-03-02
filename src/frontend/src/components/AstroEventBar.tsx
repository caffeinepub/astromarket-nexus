import { format } from "date-fns";
import { useMemo, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { type AstroEvent, computeAstroEvents } from "../utils/astroCalc";

interface AstroEventBarProps {
  startUnix: number;
  endUnix: number;
}

const EVENT_STYLES: Record<
  AstroEvent["type"],
  { color: string; emoji: string; bg: string }
> = {
  conjunction: {
    color: "#A78BFA",
    emoji: "⚷",
    bg: "oklch(0.6 0.22 290 / 0.2)",
  },
  eclipse: {
    color: "#FACC15",
    emoji: "🌑",
    bg: "oklch(0.78 0.2 65 / 0.2)",
  },
  retrograde_start: {
    color: "#F87171",
    emoji: "℞",
    bg: "oklch(0.62 0.22 25 / 0.2)",
  },
  retrograde_end: {
    color: "#34D399",
    emoji: "℞",
    bg: "oklch(0.72 0.2 145 / 0.2)",
  },
  full_moon: {
    color: "#C8C8D4",
    emoji: "🌕",
    bg: "oklch(0.7 0.04 265 / 0.2)",
  },
  new_moon: {
    color: "#94A3B8",
    emoji: "🌑",
    bg: "oklch(0.5 0.04 265 / 0.2)",
  },
  opposition: {
    color: "#FF6060",
    emoji: "☍",
    bg: "oklch(0.62 0.22 25 / 0.2)",
  },
};

export function AstroEventBar({ startUnix, endUnix }: AstroEventBarProps) {
  const { setSelectedTimestamp } = useAppStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoveredEvent, setHoveredEvent] = useState<AstroEvent | null>(null);

  const events = useMemo(() => {
    // Limit computation to prevent slowdown on large ranges
    const maxDays = 365 * 2;
    const rangeSeconds = endUnix - startUnix;
    const stepStart =
      rangeSeconds > maxDays * 86400 ? endUnix - maxDays * 86400 : startUnix;
    return computeAstroEvents(stepStart, endUnix);
  }, [startUnix, endUnix]);

  const totalRange = endUnix - startUnix;

  return (
    <div>
      <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
        Astrological Events
      </h3>
      <div
        ref={scrollRef}
        className="relative h-14 rounded-lg border border-border/30 bg-muted/20 overflow-x-auto overflow-y-hidden"
        style={{ scrollbarWidth: "thin" }}
      >
        {/* Timeline base line */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-border/40 -translate-y-1/2 min-w-full" />

        <div
          className="relative h-full"
          style={{
            minWidth: "100%",
            width: `${Math.max(100, events.length * 30)}px`,
          }}
        >
          {events.map((event, i) => {
            const pct = ((event.timestamp - startUnix) / totalRange) * 100;
            if (pct < 0 || pct > 100) return null;

            const style = EVENT_STYLES[event.type];
            const key = `${event.timestamp}-${event.type}-${i}`;
            return (
              <button
                type="button"
                key={key}
                className="absolute -translate-x-1/2 flex flex-col items-center cursor-pointer group border-0 bg-transparent p-0"
                style={{
                  left: `${pct}%`,
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                }}
                onClick={() => setSelectedTimestamp(event.timestamp)}
                onMouseEnter={() => setHoveredEvent(event)}
                onMouseLeave={() => setHoveredEvent(null)}
              >
                {/* Tick mark */}
                <div
                  className="w-px h-3 mb-0.5 transition-all duration-150 group-hover:h-5"
                  style={{ backgroundColor: style.color }}
                />
                {/* Event dot */}
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] 
                    transition-transform duration-150 group-hover:scale-125"
                  style={{
                    backgroundColor: style.bg,
                    border: `1px solid ${style.color}40`,
                    color: style.color,
                  }}
                >
                  {style.emoji}
                </div>
              </button>
            );
          })}
        </div>

        {/* Tooltip */}
        {hoveredEvent && (
          <div
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 glass rounded-lg px-3 py-2 
              border border-border/50 font-mono text-xs z-50 whitespace-nowrap pointer-events-none"
          >
            <div className="text-foreground font-semibold">
              {hoveredEvent.label}
            </div>
            <div className="text-muted-foreground">
              {format(new Date(hoveredEvent.timestamp * 1000), "MMM d, yyyy")}
            </div>
            {hoveredEvent.body2 && (
              <div className="text-muted-foreground text-[9px]">
                {hoveredEvent.body1} — {hoveredEvent.body2}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2">
        {Object.entries(EVENT_STYLES).map(([type, style]) => (
          <div key={type} className="flex items-center gap-1">
            <span className="text-[10px]" style={{ color: style.color }}>
              {style.emoji}
            </span>
            <span className="font-mono text-[9px] text-muted-foreground capitalize">
              {type.replace(/_/g, " ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
