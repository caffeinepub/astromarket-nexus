import { create } from "zustand";

// Unix timestamps
const J2000_UNIX = 946728000; // Jan 1.5, 2000 in unix seconds
const NOW = Math.floor(Date.now() / 1000);
const START_DEFAULT = J2000_UNIX; // Jan 1 2000

export type PlaySpeed = 86400 | 604800 | 2592000 | 31536000; // 1d/s, 7d/s, 30d/s, 365d/s

export type ActivePanel =
  | "overview"
  | "markets"
  | "solar_system"
  | "zodiac"
  | "correlation"
  | "cycles"
  | "annotations";

interface AppState {
  selectedTimestamp: number;
  startTimestamp: number;
  endTimestamp: number;
  isPlaying: boolean;
  playSpeed: PlaySpeed;
  selectedMarkets: string[];
  selectedBodies: string[];
  activePanel: ActivePanel;

  setSelectedTimestamp: (ts: number) => void;
  setStartTimestamp: (ts: number) => void;
  setEndTimestamp: (ts: number) => void;
  setIsPlaying: (playing: boolean) => void;
  togglePlaying: () => void;
  setPlaySpeed: (speed: PlaySpeed) => void;
  setSelectedMarkets: (markets: string[]) => void;
  setSelectedBodies: (bodies: string[]) => void;
  setActivePanel: (panel: ActivePanel) => void;
  jumpToNow: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedTimestamp: NOW,
  startTimestamp: START_DEFAULT,
  endTimestamp: NOW,
  isPlaying: false,
  playSpeed: 86400,
  selectedMarkets: ["BTC", "SP500", "Gold", "DXY"],
  selectedBodies: [
    "Sun",
    "Moon",
    "Mercury",
    "Venus",
    "Mars",
    "Jupiter",
    "Saturn",
  ],
  activePanel: "overview",

  setSelectedTimestamp: (ts) =>
    set({ selectedTimestamp: Math.min(ts, 2208988800) }), // cap at 2040
  setStartTimestamp: (ts) => set({ startTimestamp: ts }),
  setEndTimestamp: (ts) => set({ endTimestamp: ts }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  togglePlaying: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setPlaySpeed: (speed) => set({ playSpeed: speed }),
  setSelectedMarkets: (markets) => set({ selectedMarkets: markets }),
  setSelectedBodies: (bodies) => set({ selectedBodies: bodies }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  jumpToNow: () => set({ selectedTimestamp: Math.floor(Date.now() / 1000) }),
}));
