import { create } from "zustand";

interface ChatPanelState {
  isOpen: boolean;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  open: () => void;
  close: () => void;
}

export const useChatPanelStore = create<ChatPanelState>((set) => ({
  isOpen: false,
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
