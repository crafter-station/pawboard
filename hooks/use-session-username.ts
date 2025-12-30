"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getOrCreateUser,
  updateUsername as updateUsernameAction,
  joinSession,
} from "@/app/actions";

interface UseSessionUsernameProps {
  sessionId: string;
  visitorId: string | null;
}

interface UseSessionUsernameReturn {
  username: string | null;
  isLoading: boolean;
  error: string | null;
  updateUsername: (
    newUsername: string,
  ) => Promise<{ success: boolean; error?: string }>;
}

export function useSessionUsername({
  sessionId,
  visitorId,
}: UseSessionUsernameProps): UseSessionUsernameReturn {
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  // Initialize: get or create user, join session
  useEffect(() => {
    if (!visitorId || initializedRef.current) return;

    const init = async () => {
      setIsLoading(true);
      setError(null);

      // Get or create user (will generate random username if new)
      const { user, error: userError } = await getOrCreateUser(visitorId);

      if (userError || !user) {
        setError(userError ?? "Failed to load user");
        setIsLoading(false);
        return;
      }

      setUsername(user.username);

      // Join the session (creates participant record)
      const { error: joinError } = await joinSession(visitorId, sessionId);
      if (joinError) {
        console.error("Failed to join session:", joinError);
        // Non-fatal - user can still use the board
      }

      setIsLoading(false);
      initializedRef.current = true;
    };

    init();
  }, [sessionId, visitorId]);

  // Update username function (global - affects all sessions)
  const updateUsername = useCallback(
    async (
      newUsername: string,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!visitorId) {
        return { success: false, error: "Not authenticated" };
      }

      const { user, error: dbError } = await updateUsernameAction(
        visitorId,
        newUsername.trim(),
      );

      if (dbError) {
        return { success: false, error: dbError };
      }

      if (user) {
        setUsername(user.username);
        return { success: true };
      }

      return { success: false, error: "Failed to update username" };
    },
    [visitorId],
  );

  return {
    username,
    isLoading,
    error,
    updateUsername,
  };
}
