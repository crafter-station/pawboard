import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { getCardEditors, getSessionCardEditors } from "@/app/actions";

export const cardEditorsKeys = {
  all: ["cardEditors"] as const,
  byCard: (cardId: string) => [...cardEditorsKeys.all, cardId] as const,
  bySession: (sessionId: string) =>
    [...cardEditorsKeys.all, "session", sessionId] as const,
};

// Fetch all editors for a session at once (preferred - reduces POST requests)
export function useSessionCardEditors(sessionId: string) {
  return useQuery({
    queryKey: cardEditorsKeys.bySession(sessionId),
    queryFn: () => getSessionCardEditors(sessionId),
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Fetch editors for a single card (kept for backwards compatibility)
export function useCardEditors(cardId: string) {
  return useQuery({
    queryKey: cardEditorsKeys.byCard(cardId),
    queryFn: () => getCardEditors(cardId),
    staleTime: 30 * 1000,
  });
}

export function useInvalidateCardEditors() {
  const queryClient = useQueryClient();

  return useCallback(
    (cardId: string, sessionId?: string) => {
      // Invalidate the specific card query (for backwards compat)
      queryClient.invalidateQueries({
        queryKey: cardEditorsKeys.byCard(cardId),
      });
      // Invalidate session-level query if sessionId provided
      if (sessionId) {
        queryClient.invalidateQueries({
          queryKey: cardEditorsKeys.bySession(sessionId),
        });
      }
    },
    [queryClient],
  );
}
