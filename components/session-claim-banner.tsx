"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { Clock, Shield, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { claimSession, getUserRoleInSession } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { Session } from "@/db/schema";

interface SessionClaimBannerProps {
  session: Session;
  fingerprintId: string;
  onSessionClaimed?: () => void;
}

const DISMISSED_KEY_PREFIX = "pawboard_claim_banner_dismissed_";

/**
 * Shows a banner for unclaimed sessions with expiration warning.
 * - If not signed in: Shows sign-in prompt
 * - If signed in and creator: Shows claim button
 * - If signed in but not creator: Shows info that only creator can claim
 */
export function SessionClaimBanner({
  session,
  fingerprintId,
  onSessionClaimed,
}: SessionClaimBannerProps) {
  const { isSignedIn, isLoaded } = useAuth();
  const [isCreator, setIsCreator] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  // Check if already dismissed
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(
        `${DISMISSED_KEY_PREFIX}${session.id}`,
      );
      if (dismissed === "true") {
        setIsDismissed(true);
      }
    } catch {
      // localStorage unavailable
    }
  }, [session.id]);

  // Check if user is creator using fingerprint ID
  // We use fingerprintId (not userId/Clerk ID) because the creator is stored
  // in sessionParticipants with their fingerprint ID from when they created the board
  useEffect(() => {
    if (!fingerprintId) return;

    let cancelled = false;

    async function checkRole() {
      const role = await getUserRoleInSession(fingerprintId, session.id);
      if (!cancelled) {
        setIsCreator(role === "creator");
      }
    }

    checkRole();

    return () => {
      cancelled = true;
    };
  }, [fingerprintId, session.id]);

  // Calculate time remaining
  useEffect(() => {
    if (!session.expiresAt) return;

    function updateTimeRemaining() {
      if (!session.expiresAt) return;
      const now = new Date();
      const expires = new Date(session.expiresAt);
      const diffMs = expires.getTime() - now.getTime();

      if (diffMs <= 0) {
        setTimeRemaining("Expired");
        return;
      }

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      if (hours >= 24) {
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        setTimeRemaining(
          `${days} day${days !== 1 ? "s" : ""} ${remainingHours}h`,
        );
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else {
        setTimeRemaining(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
      }
    }

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [session.expiresAt]);

  const handleClaim = useCallback(async () => {
    setIsClaiming(true);
    const { success, error } = await claimSession(session.id, fingerprintId);

    if (success) {
      // Mark as dismissed
      try {
        localStorage.setItem(`${DISMISSED_KEY_PREFIX}${session.id}`, "true");
      } catch {
        // localStorage unavailable
      }
      setIsDismissed(true);
      onSessionClaimed?.();
    } else {
      console.error("Failed to claim session:", error);
    }

    setIsClaiming(false);
  }, [session.id, fingerprintId, onSessionClaimed]);

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(`${DISMISSED_KEY_PREFIX}${session.id}`, "true");
    } catch {
      // localStorage unavailable
    }
    setIsDismissed(true);
  }, [session.id]);

  // Don't show banner if:
  // - Session is already claimed (no expiresAt means it's permanent/claimed)
  // - Banner was dismissed
  // - Still loading auth state
  if (!session.expiresAt || isDismissed || !isLoaded) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full mx-4">
      <div className="bg-card border border-border rounded-lg shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-amber-500/10 text-amber-500 shrink-0">
            <Clock className="h-5 w-5" />
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-foreground">
                  Board expires in {timeRemaining}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isSignedIn
                    ? isCreator
                      ? "Claim this board to keep it forever."
                      : "Only the board creator can claim it."
                    : "Sign in to claim this board and keep it forever."}
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

            <div className="flex gap-2">
              {isSignedIn ? (
                isCreator ? (
                  <Button
                    onClick={handleClaim}
                    disabled={isClaiming}
                    className="gap-2"
                  >
                    <Shield className="h-4 w-4" />
                    {isClaiming ? "Claiming..." : "Claim this board"}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground py-2">
                    Ask the board creator to sign in and claim it.
                  </p>
                )
              ) : (
                <SignInButton mode="modal">
                  <Button className="gap-2">
                    <Shield className="h-4 w-4" />
                    Sign in to claim
                  </Button>
                </SignInButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
