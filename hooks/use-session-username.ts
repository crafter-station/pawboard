"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getOrCreateUser,
  joinSession,
  updateUsername as updateUsernameAction,
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
  const mountedRef = useRef(true);

  // Cleanup mounted ref on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Initialize: get or create user, join session
  useEffect(() => {
    if (!visitorId || initializedRef.current) return;

    const init = async () => {
      if (!mountedRef.current) return;
      setIsLoading(true);
      setError(null);

      // Get or create user (will generate random username if new)
      const { user, error: userError } = await getOrCreateUser(visitorId);

      if (!mountedRef.current) return;

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

      if (mountedRef.current) {
        setIsLoading(false);
        initializedRef.current = true;
      }
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
        if (mountedRef.current) {
          setUsername(user.username);
        }
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
