import { create } from "zustand";

export type SidebarTab = "chat" | "threads" | "participants";

interface SidebarStore {
  isOpen: boolean;
  activeTab: SidebarTab;

  setOpen: (open: boolean) => void;
  toggle: () => void;
  setActiveTab: (tab: SidebarTab) => void;
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  isOpen: false,
  activeTab: "chat",

  setOpen: (isOpen) => set({ isOpen }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setActiveTab: (activeTab) => set({ activeTab }),
}));
