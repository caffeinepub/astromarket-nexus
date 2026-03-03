import { Toaster } from "@/components/ui/sonner";
import {
  Activity,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Globe,
  // eslint-disable-next-line @typescript-eslint/no-shadow
  Infinity as InfinityIcon,
  LayoutDashboard,
  Menu,
  Star,
  TrendingUp,
  X,
} from "lucide-react";
import { Suspense, lazy, useEffect, useState } from "react";
import { AnnotationsPanel } from "./components/AnnotationsPanel";
import { CorrelationPanel } from "./components/CorrelationPanel";
import { CosmicScalePanel } from "./components/CosmicScalePanel";
import { CyclesPanel } from "./components/CyclesPanel";
import { MarketsPanel } from "./components/MarketsPanel";
import { OverviewDashboard } from "./components/OverviewDashboard";
import { TimelineScrubber } from "./components/TimelineScrubber";
import { ZodiacWheel } from "./components/ZodiacWheel";
import {
  useFetchLiveMarketData,
  useSeedData,
  useStats,
} from "./hooks/useQueries";
import { type ActivePanel, useAppStore } from "./store/useAppStore";

// Lazy load the heavy 3D component
const SolarSystem3D = lazy(() =>
  import("./components/SolarSystem3D").then((m) => ({
    default: m.SolarSystem3D,
  })),
);

interface NavItem {
  id: ActivePanel;
  label: string;
  icon: React.ReactNode;
  ocid: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "overview",
    label: "Overview",
    icon: <LayoutDashboard className="w-4 h-4" />,
    ocid: "nav.overview.tab",
  },
  {
    id: "markets",
    label: "Markets",
    icon: <TrendingUp className="w-4 h-4" />,
    ocid: "nav.markets.tab",
  },
  {
    id: "solar_system",
    label: "Solar System",
    icon: <Globe className="w-4 h-4" />,
    ocid: "nav.solar_system.tab",
  },
  {
    id: "zodiac",
    label: "Zodiac",
    icon: <Star className="w-4 h-4" />,
    ocid: "nav.zodiac.tab",
  },
  {
    id: "correlation",
    label: "Correlation",
    icon: <Activity className="w-4 h-4" />,
    ocid: "nav.correlation.tab",
  },
  {
    id: "cycles",
    label: "Cycles",
    icon: <Activity className="w-4 h-4" />,
    ocid: "nav.cycles.tab",
  },
  {
    id: "cosmic",
    label: "Cosmic Scale",
    icon: <InfinityIcon className="w-4 h-4" />,
    ocid: "nav.cosmic.tab",
  },
  {
    id: "annotations",
    label: "Annotations",
    icon: <BookOpen className="w-4 h-4" />,
    ocid: "nav.annotations.tab",
  },
];

// Pre-computed static star field — no state needed
const STAR_DATA = Array.from({ length: 100 }, (_, i) => ({
  key: `s${i}`,
  x: ((i * 137.508) % 100).toFixed(2),
  y: ((i * 97.333) % 100).toFixed(2),
  size: i % 7 === 0 ? 2.5 : i % 3 === 0 ? 1.5 : 1,
  opacity: 0.15 + (i % 5) * 0.07,
  animated: i % 4 === 0,
  animDuration: 2 + (i % 3),
}));

function StarField() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
      {STAR_DATA.map((star) => (
        <div
          key={star.key}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            animation: star.animated
              ? `pulse-glow ${star.animDuration}s ease-in-out infinite`
              : undefined,
          }}
        />
      ))}
    </div>
  );
}

function BackendInitializer() {
  const { data: stats, isSuccess } = useStats();
  const seedData = useSeedData();

  useEffect(() => {
    if (isSuccess && stats && stats.totalAnnotations === 0n) {
      seedData.mutate();
    }
  }, [isSuccess, stats, seedData]);

  return null;
}

function LiveDataScheduler() {
  const { mutate } = useFetchLiveMarketData();

  useEffect(() => {
    mutate();
    const interval = setInterval(() => mutate(), 60_000);
    return () => clearInterval(interval);
  }, [mutate]);

  return null;
}

export default function App() {
  const { activePanel, setActivePanel } = useAppStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentYear = new Date().getFullYear();
  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "";

  // Keyboard shortcuts
  useEffect(() => {
    const {
      togglePlaying,
      setSelectedTimestamp,
      selectedTimestamp,
      playSpeed,
    } = useAppStore.getState();

    const handleKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      const state = useAppStore.getState();
      if (e.code === "Space") {
        e.preventDefault();
        state.togglePlaying();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        state.setSelectedTimestamp(state.selectedTimestamp - state.playSpeed);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        state.setSelectedTimestamp(state.selectedTimestamp + state.playSpeed);
      }
    };

    // suppress unused variable warnings
    void togglePlaying;
    void setSelectedTimestamp;
    void selectedTimestamp;
    void playSpeed;

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden relative">
      <BackendInitializer />
      <LiveDataScheduler />
      <StarField />
      <Toaster
        theme="dark"
        position="top-right"
        toastOptions={{
          className: "font-mono text-xs glass border-border/50",
        }}
      />

      {/* ── Top Bar ── */}
      <header className="flex-shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 border-b border-border/40 glass-strong relative z-20 min-h-[52px]">
        {/* Mobile hamburger */}
        <button
          type="button"
          className="lg:hidden flex-shrink-0 p-1.5 rounded hover:bg-muted transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Open navigation"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Logo — hide text on small screens */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative flex-shrink-0">
            <img
              src="/assets/generated/astromarket-logo-transparent.dim_200x200.png"
              alt="AstroMarket Nexus logo"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover"
              style={{
                filter: "drop-shadow(0 0 4px oklch(0.7 0.18 195 / 0.5))",
              }}
            />
          </div>
          <div className="hidden sm:block">
            <div className="font-display font-bold text-sm tracking-wide leading-none">
              <span className="neon-text-teal">Astro</span>
              <span className="neon-text-blue">Market</span>
              <span className="text-muted-foreground font-normal text-xs ml-1">
                Nexus
              </span>
            </div>
            <div className="font-mono text-[8px] text-muted-foreground/50 leading-none mt-0.5">
              COSMIC CORRELATION PLATFORM
            </div>
          </div>
        </div>

        {/* Timeline (flex-1, takes remaining width) */}
        <div className="flex-1 min-w-0">
          <TimelineScrubber />
        </div>

        {/* Live status dot */}
        <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
          </span>
          <span className="font-mono text-[9px] text-muted-foreground">
            LIVE
          </span>
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="flex flex-1 min-h-0 relative z-10">
        {/* ── Sidebar ── */}
        <aside
          className={[
            "flex-shrink-0 flex flex-col border-r border-border/40 glass-strong transition-all duration-300 ease-in-out relative z-20",
            sidebarCollapsed ? "w-14" : "w-52",
            mobileMenuOpen
              ? "absolute left-0 top-0 bottom-0 z-30 w-52"
              : "hidden lg:flex",
          ].join(" ")}
        >
          {/* Close button in mobile */}
          {mobileMenuOpen && (
            <button
              type="button"
              className="absolute top-2 right-2 lg:hidden p-1 rounded hover:bg-muted"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <nav className="flex-1 py-3 overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              const isActive = activePanel === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActivePanel(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={[
                    "flex items-center gap-3 py-2.5 mx-1.5 my-0.5 rounded-lg transition-all duration-150 font-mono text-xs group",
                    isActive
                      ? "bg-neon-blue/15 text-neon-blue border border-neon-blue/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent",
                    sidebarCollapsed
                      ? "px-3 w-[44px]"
                      : "px-3 w-[calc(100%-12px)]",
                  ].join(" ")}
                  data-ocid={item.ocid}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!sidebarCollapsed && (
                    <>
                      <span className="truncate flex-1">{item.label}</span>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-neon-blue animate-pulse-glow flex-shrink-0" />
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Collapse toggle */}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="flex items-center justify-center h-8 border-t border-border/30 
              text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            aria-label={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>
        </aside>

        {/* Mobile overlay backdrop */}
        {mobileMenuOpen && (
          <button
            type="button"
            className="lg:hidden fixed inset-0 bg-black/60 z-20 w-full h-full border-0 cursor-default"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          />
        )}

        {/* ── Panel content ── */}
        <main className="flex-1 min-w-0 overflow-hidden">
          {activePanel === "overview" && <OverviewDashboard />}
          {activePanel === "markets" && <MarketsPanel />}

          {activePanel === "solar_system" && (
            <Suspense
              fallback={
                <div className="h-full flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full border-2 border-neon-blue border-t-transparent animate-spin"
                      style={{
                        boxShadow: "0 0 20px oklch(0.65 0.22 240 / 0.3)",
                      }}
                    />
                    <span className="font-mono text-xs text-muted-foreground">
                      Loading 3D Solar System…
                    </span>
                  </div>
                </div>
              }
            >
              <SolarSystem3D />
            </Suspense>
          )}

          {activePanel === "zodiac" && <ZodiacWheel />}
          {activePanel === "correlation" && <CorrelationPanel />}
          {activePanel === "cycles" && <CyclesPanel />}
          {activePanel === "cosmic" && <CosmicScalePanel />}
          {activePanel === "annotations" && <AnnotationsPanel />}
        </main>
      </div>

      {/* ── Footer ── */}
      <footer className="flex-shrink-0 flex items-center justify-between px-4 py-1.5 border-t border-border/20 glass-strong relative z-10">
        <div className="font-mono text-[9px] text-muted-foreground/50 hidden sm:block">
          AstroMarket Nexus — Scientific Correlation Research Platform
        </div>
        <div className="font-mono text-[9px] text-muted-foreground/50 ml-auto">
          © {currentYear}. Built with ❤ using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neon-teal/70 hover:text-neon-teal transition-colors"
          >
            caffeine.ai
          </a>
        </div>
      </footer>
    </div>
  );
}
