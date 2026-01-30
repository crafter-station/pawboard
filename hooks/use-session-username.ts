"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  joinSession,
  updateUsername as updateUsernameAction,
} from "@/app/actions";
import type { SessionRole } from "@/db/schema";

interface UseSessionUsernameProps {
  sessionId: string;
  visitorId: string | null;
}

interface UseSessionUsernameReturn {
  username: string | null;
  role: SessionRole | null;
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
  const [role, setRole] = useState<SessionRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  // Initialize: join session (which also creates user if needed)
  useEffect(() => {
    if (!visitorId || initializedRef.current) return;

    // Use cancelled flag for race condition prevention
    let cancelled = false;

    const init = async () => {
      setIsLoading(true);
      setError(null);

      // Join the session - this also calls getOrCreateUser internally
      // and returns user, role, and any error
      const {
        role: userRole,
        error: joinError,
        user,
      } = await joinSession(visitorId, sessionId);

      // Prevent state updates if effect was cleaned up (component unmounted
      // or dependencies changed before async operation completed)
      if (cancelled) return;

      if (joinError) {
        setError(joinError);
        setIsLoading(false);
        return;
      }

      if (user) {
        setUsername(user.username);
      }

      if (userRole) {
        setRole(userRole);
      }

      setIsLoading(false);
      initializedRef.current = true;
    };

    init();

    return () => {
      cancelled = true;
    };
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
    role,
    isLoading,
    error,
    updateUsername,
  };
}
