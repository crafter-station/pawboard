"use client";

import { useAuth } from "@clerk/nextjs";
import { useFingerprint } from "./use-fingerprint";

/**
 * Unified identity hook that returns the current user ID.
 *
 * - If authenticated via Clerk, returns the Clerk user ID
 * - If not authenticated, returns the fingerprint ID (anonymous user)
 *
 * Also provides access to both IDs for migration purposes.
 */
export function useCurrentUser() {
  const { userId: clerkId, isSignedIn, isLoaded: clerkLoaded } = useAuth();
  const { visitorId: fingerprintId, isLoading: fingerprintLoading } =
    useFingerprint();

  // Wait for Clerk to FULLY determine auth state (isSignedIn must be true or false, not undefined)
  // This prevents race condition where fingerprint ID is used before Clerk finishes hydrating
  const clerkDetermined = clerkLoaded && isSignedIn !== undefined;
  const isLoading = !clerkDetermined || (!isSignedIn && fingerprintLoading);

  // DON'T return a userId until we know which one to use
  // This prevents useSessionUsername from calling joinSession with the wrong ID
  const userId = isLoading ? null : isSignedIn ? clerkId : fingerprintId;

  return {
    /** Current active user ID (Clerk ID if authenticated, fingerprint if anonymous) */
    userId,
    /** Clerk user ID (null if not signed in) */
    clerkId,
    /** Fingerprint ID (always available after loading, used for migration) */
    fingerprintId,
    /** Whether the user is authenticated via Clerk */
    isAuthenticated: isSignedIn ?? false,
    /** Whether the identity is still being determined */
    isLoading,
  };
}
