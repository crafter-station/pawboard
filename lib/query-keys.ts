/**
 * Centralized query key factory for TanStack Query.
 * Provides consistent cache key management across the application.
 */
export const queryKeys = {
  // Card editors keys
  cardEditors: {
    all: ["cardEditors"] as const,
    byCard: (cardId: string) => [...queryKeys.cardEditors.all, cardId] as const,
    bySession: (sessionId: string) =>
      [...queryKeys.cardEditors.all, "session", sessionId] as const,
  },

  // User cache keys
  users: {
    all: ["users"] as const,
    byId: (userId: string) => [...queryKeys.users.all, userId] as const,
    byIds: (userIds: string[]) =>
      [...queryKeys.users.all, "batch", userIds.sort().join(",")] as const,
  },

  // Card edit history keys
  cardHistory: {
    all: ["cardHistory"] as const,
    byCard: (cardId: string) => [...queryKeys.cardHistory.all, cardId] as const,
  },
} as const;
