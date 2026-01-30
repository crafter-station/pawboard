import { create } from "zustand";

interface ThreadFocusStore {
  focusedThreadId: string | null;
  setFocusedThread: (threadId: string | null) => void;
  clearFocusedThread: () => void;
}

export const useThreadFocusStore = create<ThreadFocusStore>((set) => ({
  focusedThreadId: null,
  setFocusedThread: (threadId) => set({ focusedThreadId: threadId }),
  clearFocusedThread: () => set({ focusedThreadId: null }),
}));
