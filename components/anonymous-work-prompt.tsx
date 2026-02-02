"use client";

import { AlertCircle, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  claimAnonymousWorkOnBoard,
  getAnonymousHistoryOnBoard,
  joinSessionAsClerkUser,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { Session } from "@/db/schema";
import { useCurrentUser } from "@/hooks/use-current-user";

interface AnonymousWorkPromptProps {
  sessionId: string;
  session: Session;
  onWorkClaimed?: () => void;
  onStartFresh?: () => void;
}

const DISMISSED_KEY_PREFIX = "pawboard_anon_prompt_dismissed_";

/**
 * Shows a prompt when an authenticated user has anonymous history on the current board.
 * Offers two options:
 * - "Claim my work" - migrates anonymous contributions to their Clerk account
 * - "Start fresh" - keeps anonymous work separate, joins as new participant
 */
export function AnonymousWorkPrompt({
  sessionId,
  session,
  onWorkClaimed,
  onStartFresh,
}: AnonymousWorkPromptProps) {
  const { isAuthenticated, fingerprintId, isLoading } = useCurrentUser();
  const [hasHistory, setHasHistory] = useState(false);
  const [stats, setStats] = useState<{
    role: string | null;
    cardsCreated: number;
    commentsCreated: number;
  } | null>(null);
  const [isClaimingWork, setIsClaimingWork] = useState(false);
  const [isStartingFresh, setIsStartingFresh] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isCheckingHistory, setIsCheckingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check localStorage for dismissal
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(
        `${DISMISSED_KEY_PREFIX}${sessionId}`,
      );
      if (dismissed === "true") {
        setIsDismissed(true);
      }
    } catch {
      // localStorage unavailable
    }
  }, [sessionId]);

  // Check for anonymous history when authenticated
  useEffect(() => {
    if (isLoading || !isAuthenticated || !fingerprintId || isDismissed) {
      setIsCheckingHistory(false);
      return;
    }

    let cancelled = false;

    async function checkHistory() {
      if (!fingerprintId) return;
      setIsCheckingHistory(true);
      const result = await getAnonymousHistoryOnBoard(sessionId, fingerprintId);

      if (cancelled) return;

      setHasHistory(result.hasHistory);
      setStats(result.stats);
      setIsCheckingHistory(false);
    }

    checkHistory();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, fingerprintId, sessionId, isLoading, isDismissed]);

  const handleClaimWork = useCallback(async () => {
    if (!fingerprintId) return;

    setIsClaimingWork(true);
    setError(null);
    const { success, error: claimError } = await claimAnonymousWorkOnBoard(
      sessionId,
      fingerprintId,
    );

    if (success) {
      // Mark as dismissed so we don't show again
      try {
        localStorage.setItem(`${DISMISSED_KEY_PREFIX}${sessionId}`, "true");
      } catch {
        // localStorage unavailable
      }
      setIsDismissed(true);
      onWorkClaimed?.();
    } else {
      console.error("Failed to claim work:", claimError);
      setError(claimError ?? "Failed to claim work. Please try again.");
    }

    setIsClaimingWork(false);
  }, [fingerprintId, sessionId, onWorkClaimed]);

  const handleStartFresh = useCallback(async () => {
    setIsStartingFresh(true);
    setError(null);
    const { success, error: joinError } =
      await joinSessionAsClerkUser(sessionId);

    if (success) {
      // Mark as dismissed
      try {
        localStorage.setItem(`${DISMISSED_KEY_PREFIX}${sessionId}`, "true");
      } catch {
        // localStorage unavailable
      }
      setIsDismissed(true);
      onStartFresh?.();
    } else {
      console.error("Failed to start fresh:", joinError);
      setError(joinError ?? "Failed to join session. Please try again.");
    }

    setIsStartingFresh(false);
  }, [sessionId, onStartFresh]);

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(`${DISMISSED_KEY_PREFIX}${sessionId}`, "true");
    } catch {
      // localStorage unavailable
    }
    setIsDismissed(true);
  }, [sessionId]);

  // Don't show if:
  // - Still loading
  // - Not authenticated
  // - No anonymous history on this board
  // - Already dismissed
  // - User is creator of an unclaimed board (SessionClaimBanner handles this case)
  const isCreatorOfUnclaimedBoard =
    session.expiresAt && stats?.role === "creator";

  if (
    isLoading ||
    isCheckingHistory ||
    !isAuthenticated ||
    !hasHistory ||
    isDismissed ||
    isCreatorOfUnclaimedBoard
  ) {
    return null;
  }

  const totalContributions =
    (stats?.cardsCreated ?? 0) + (stats?.commentsCreated ?? 0);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full mx-4">
      <div className="bg-card border border-border rounded-lg shadow-lg p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground">
              You worked on this board before
            </h3>
            <p className="text-sm text-muted-foreground">
              {totalContributions > 0 ? (
                <>
                  {stats?.cardsCreated ?? 0} card
                  {(stats?.cardsCreated ?? 0) !== 1 ? "s" : ""} created
                  {(stats?.commentsCreated ?? 0) > 0 && (
                    <>
                      , {stats?.commentsCreated} comment
                      {(stats?.commentsCreated ?? 0) !== 1 ? "s" : ""}
                    </>
                  )}
                </>
              ) : (
                "You have activity on this board from before signing in."
              )}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleClaimWork}
            disabled={isClaimingWork || isStartingFresh}
            className="flex-1"
          >
            {isClaimingWork ? "Claiming..." : "Claim my work"}
          </Button>
          <Button
            variant="outline"
            onClick={handleStartFresh}
            disabled={isClaimingWork || isStartingFresh}
            className="flex-1"
          >
            {isStartingFresh ? "Joining..." : "Start fresh"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          &quot;Claim my work&quot; transfers your previous contributions to
          your account. &quot;Start fresh&quot; keeps them separate.
        </p>
      </div>
    </div>
  );
}
