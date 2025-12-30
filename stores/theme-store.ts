import { create } from "zustand";

interface ThemeTransition {
  x: number;
  y: number;
  isAnimating: boolean;
}

interface ThemeStore {
  transition: ThemeTransition | null;
  startTransition: (x: number, y: number) => void;
  endTransition: () => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  transition: null,
  startTransition: (x, y) => set({ transition: { x, y, isAnimating: true } }),
  endTransition: () => set({ transition: null }),
}));
