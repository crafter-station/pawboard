import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { getCardEditors } from "@/app/actions";

export const cardEditorsKeys = {
  all: ["cardEditors"] as const,
  byCard: (cardId: string) => [...cardEditorsKeys.all, cardId] as const,
};

export function useCardEditors(cardId: string) {
  return useQuery({
    queryKey: cardEditorsKeys.byCard(cardId),
    queryFn: () => getCardEditors(cardId),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useInvalidateCardEditors() {
  const queryClient = useQueryClient();

  return useCallback(
    (cardId: string) => {
      queryClient.invalidateQueries({
        queryKey: cardEditorsKeys.byCard(cardId),
      });
    },
    [queryClient],
  );
}
