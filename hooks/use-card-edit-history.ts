"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getCardEditHistoryRaw } from "@/app/actions";
import { useUsers } from "@/hooks/use-users";
import { queryKeys } from "@/lib/query-keys";

// Raw history entry from server (no username)
type RawEditHistoryEntry = {
  id: string;
  cardId: string;
  userId: string;
  editedAt: Date;
};

// History entry with resolved username
export type EditHistoryWithUsername = RawEditHistoryEntry & {
  username: string;
};

/**
 * Hook to fetch card edit history with cached user resolution.
 * Separates history fetch from user resolution to leverage the user cache.
 *
 * @param cardId - The card ID to fetch history for
 * @param enabled - Whether to enable the query (defaults to true)
 * @returns Object with history array, loading state, and error
 */
export function useCardEditHistory(cardId: string, enabled = true) {
  // Step 1: Fetch raw history (just IDs and timestamps, no username resolution)
  const historyQuery = useQuery({
    queryKey: queryKeys.cardHistory.byCard(cardId),
    queryFn: () => getCardEditHistoryRaw(cardId),
    staleTime: 30 * 1000, // 30 seconds
    enabled,
  });

  // Step 2: Extract user IDs from history entries
  const userIds = useMemo(
    () => historyQuery.data?.history?.map((h) => h.userId) ?? [],
    [historyQuery.data?.history],
  );

  // Step 3: Resolve usernames via cached user data
  // This will check the cache first and only fetch missing users
  const usersQuery = useUsers(userIds);

  // Step 4: Combine history with resolved usernames
  const historyWithUsernames: EditHistoryWithUsername[] | undefined =
    useMemo(() => {
      if (!historyQuery.data?.history || !usersQuery.data) {
        return undefined;
      }

      return historyQuery.data.history.map((entry) => ({
        ...entry,
        username: usersQuery.data.get(entry.userId) ?? "Anonymous",
      }));
    }, [historyQuery.data?.history, usersQuery.data]);

  return {
    history: historyWithUsernames,
    isLoading:
      historyQuery.isLoading || (userIds.length > 0 && usersQuery.isLoading),
    error: historyQuery.data?.error ?? null,
  };
}
