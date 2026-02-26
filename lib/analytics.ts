import { track } from "@vercel/analytics";
import { track as trackServer } from "@vercel/analytics/server";

// ─── Event Definitions ───────────────────────────────────────────
// Each key is the exact event name string sent to Vercel Analytics.
// The value type defines the allowed properties for that event.

type EventMap = {
  // P0 - Core Funnel
  "Session Created": { source: "home" | "sessions_page" };
  "Session Joined": {
    role: string;
    participantCount: number;
    cardCount: number;
    isNewSession: boolean;
  };
  "Card Created": {
    source: "button" | "shortcut" | "context_menu" | "duplicate" | "paste";
  };
  "Card Edited": {
    hasContent: boolean;
    isOwnCard: boolean;
  };
  "Session Shared": Record<string, never>;
  "Session Claimed": Record<string, never>;
  "User Signed In": Record<string, never>;
  "Sessions List Viewed": { sessionCount: number };

  // P1 - Feature Adoption
  "AI Chat Sent": { messageLength: number };
  "AI Refine Used": { textLength: number };
  "Voice Input Used": Record<string, never>;
  "Card Voted": { action: "added" | "removed" };
  "Card Reacted": { action: "added" | "removed"; emoji: string };
  "Cluster Cards Used": {
    cardsProcessed: number;
    clusterCount: number;
  };
  "Thread Created": { target: "canvas" | "card" };
  "Session Locked": { isLocked: boolean };
  "Session Blurred": { isBlurred: boolean };

  // P2 - Fine-grained
  "Feedback Portal Opened": { source: "home_footer" | "command_menu" };
  "Command Menu Opened": Record<string, never>;
  "Anonymous Work Claimed": {
    cardsCreated: number;
    commentsCreated: number;
  };
  "Card Color Changed": Record<string, never>;
  "Card Deleted": Record<string, never>;
  "Session Deleted": Record<string, never>;
};

// ─── Client-side tracking ────────────────────────────────────────

export function trackEvent<E extends keyof EventMap>(
  event: E,
  ...args: EventMap[E] extends Record<string, never>
    ? []
    : [properties: EventMap[E]]
): void {
  const properties = args[0];
  if (properties && Object.keys(properties).length > 0) {
    track(
      event,
      properties as Record<string, string | number | boolean | null>,
    );
  } else {
    track(event);
  }
}

// ─── Server-side tracking ────────────────────────────────────────

export async function trackServerEvent<E extends keyof EventMap>(
  event: E,
  ...args: EventMap[E] extends Record<string, never>
    ? []
    : [properties: EventMap[E]]
): Promise<void> {
  const properties = args[0];
  try {
    if (properties && Object.keys(properties).length > 0) {
      await trackServer(
        event,
        properties as Record<string, string | number | boolean | null>,
      );
    } else {
      await trackServer(event);
    }
  } catch {
    // Silently fail — analytics should never break the app
  }
}
