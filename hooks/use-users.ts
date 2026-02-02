"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { getUsersByIds } from "@/app/actions";
import { queryKeys } from "@/lib/query-keys";

export type CachedUser = {
  userId: string;
  username: string;
};

/**
 * Hook to get cached user data with automatic fetching for missing users.
 * Checks the individual user cache first, then fetches only missing users.
 *
 * @param userIds - Array of user IDs to resolve
 * @returns Query result with a Map of userId -> username
 */
export function useUsers(userIds: string[]) {
  const queryClient = useQueryClient();
  const uniqueIds = [...new Set(userIds)].filter(Boolean);

  return useQuery({
    queryKey: queryKeys.users.byIds(uniqueIds),
    queryFn: async () => {
      if (uniqueIds.length === 0) return new Map<string, string>();

      // Check which users are already in cache
      const cached = new Map<string, string>();
      const missing: string[] = [];

      for (const userId of uniqueIds) {
        const cachedUser = queryClient.getQueryData<CachedUser>(
          queryKeys.users.byId(userId),
        );
        if (cachedUser) {
          cached.set(userId, cachedUser.username);
        } else {
          missing.push(userId);
        }
      }

      // Fetch only missing users from server
      if (missing.length > 0) {
        const { users, error } = await getUsersByIds(missing);
        if (!error && users) {
          // Populate individual user cache entries for future reuse
          for (const user of users) {
            queryClient.setQueryData(queryKeys.users.byId(user.userId), user);
            cached.set(user.userId, user.username);
          }
        } else {
          // Mark missing users as Anonymous on error
          for (const userId of missing) {
            cached.set(userId, "Anonymous");
          }
        }
      }

      return cached;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - usernames change rarely
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    enabled: uniqueIds.length > 0,
  });
}

/**
 * Hook to prime the user cache from existing data.
 * Call this when you already have username data (e.g., from participants or editors)
 * to avoid future fetches.
 *
 * @returns A function to prime the cache with user data
 */
export function usePrimeUserCache() {
  const queryClient = useQueryClient();

  return useCallback(
    (users: Array<{ visitorId: string; username: string }>) => {
      for (const user of users) {
        queryClient.setQueryData(queryKeys.users.byId(user.visitorId), {
          userId: user.visitorId,
          username: user.username,
        } satisfies CachedUser);
      }
    },
    [queryClient],
  );
}

/**
 * Hook to get a function that retrieves a cached username.
 * Returns undefined if the user is not in cache.
 *
 * @returns A function that takes a userId and returns the cached username or undefined
 */
export function useGetCachedUsername() {
  const queryClient = useQueryClient();

  return useCallback(
    (userId: string): string | undefined => {
      const cached = queryClient.getQueryData<CachedUser>(
        queryKeys.users.byId(userId),
      );
      return cached?.username;
    },
    [queryClient],
  );
}

/**
 * Hook to invalidate user cache when a user renames themselves.
 *
 * @returns A function to invalidate a user's cached data
 */
export function useInvalidateUser() {
  const queryClient = useQueryClient();

  return useCallback(
    (userId: string) => {
      // Invalidate the specific user entry
      queryClient.invalidateQueries({
        queryKey: queryKeys.users.byId(userId),
      });
      // Also invalidate any batch queries that include this user
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            key[0] === "users" &&
            key[1] === "batch" &&
            typeof key[2] === "string" &&
            key[2].includes(userId)
          );
        },
      });
    },
    [queryClient],
  );
}
