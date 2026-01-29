import { createClient } from "@supabase/supabase-js";
import type { Card } from "@/db/schema";
import { getClientEnv } from "@/lib/env";

// Use a dedicated client for server-side broadcasts
const {
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY,
} = getClientEnv();

const supabase = createClient(
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY,
);

// AI broadcasts use a special userId so all clients (including the requester) process the event
const AI_USER_ID = "ai-assistant";

type CardEvent =
  | { type: "card:add"; card: Card }
  | { type: "card:update"; card: Card }
  | { type: "card:delete"; id: string }
  | { type: "card:color"; id: string; color: string }
  | {
      type: "cards:cluster";
      positions: Array<{ id: string; x: number; y: number }>;
    };

export async function broadcastCardEvent(
  sessionId: string,
  event: CardEvent,
): Promise<void> {
  const channel = supabase.channel(`cards:${sessionId}`);

  // Use httpSend for server-side broadcasts (REST API, no WebSocket needed)
  await channel.httpSend("card-event", { ...event, odilUserId: AI_USER_ID });

  // Clean up the channel reference
  supabase.removeChannel(channel);
}
