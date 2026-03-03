import { create } from "zustand";

// Unix timestamps
const NOW = Math.floor(Date.now() / 1000);

export type PlaySpeed = 86400 | 604800 | 2592000 | 31536000; // 1d/s, 7d/s, 30d/s, 365d/s

export type ActivePanel =
  | "overview"
  | "markets"
  | "solar_system"
  | "zodiac"
  | "correlation"
  | "cycles"
  | "cosmic"
  | "annotations";

interface AppState {
  selectedTimestamp: number;
  isPlaying: boolean;
  playSpeed: PlaySpeed;
  selectedMarkets: string[];
  selectedBodies: string[];
  activePanel: ActivePanel;

  setSelectedTimestamp: (ts: number) => void;
  setIsPlaying: (playing: boolean) => void;
  togglePlaying: () => void;
  setPlaySpeed: (speed: PlaySpeed) => void;
  setSelectedMarkets: (markets: string[]) => void;
  setSelectedBodies: (bodies: string[]) => void;
  setActivePanel: (panel: ActivePanel) => void;
  jumpToNow: () => void;
}

// Min = 1970, Max = year 2100
const MIN_UNIX = 0;
const MAX_UNIX = 4102444800; // Jan 1 2100

export const MIN_TIMESTAMP = MIN_UNIX;
export const MAX_TIMESTAMP = MAX_UNIX;

export const useAppStore = create<AppState>((set) => ({
  selectedTimestamp: NOW,
  isPlaying: false,
  playSpeed: 86400,
  selectedMarkets: ["BTC", "SP500", "GOLD", "DXY"],
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
    set({
      selectedTimestamp: Math.max(MIN_UNIX, Math.min(MAX_UNIX, ts)),
    }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  togglePlaying: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setPlaySpeed: (speed) => set({ playSpeed: speed }),
  setSelectedMarkets: (markets) => set({ selectedMarkets: markets }),
  setSelectedBodies: (bodies) => set({ selectedBodies: bodies }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  jumpToNow: () => set({ selectedTimestamp: Math.floor(Date.now() / 1000) }),
}));
