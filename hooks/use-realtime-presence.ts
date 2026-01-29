import {
  REALTIME_SUBSCRIBE_STATES,
  type RealtimeChannel,
} from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

interface PresenceState {
  odilUserId: string;
}

/**
 * Hook to track which users are currently online in a session
 * Uses Supabase Realtime presence to detect active connections
 */
export const useRealtimePresence = ({
  roomName,
  userId,
}: {
  roomName: string;
  userId: string;
}) => {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(`presence:${roomName}`);

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceState>();
        const users = new Set<string>();

        // Extract all unique user IDs from presence state
        for (const presences of Object.values(state)) {
          for (const presence of presences) {
            if (presence.odilUserId) {
              users.add(presence.odilUserId);
            }
          }
        }

        setOnlineUsers(users);
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          for (const presence of newPresences) {
            const userId = (presence as unknown as PresenceState).odilUserId;
            if (userId) {
              next.add(userId);
            }
          }
          return next;
        });
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          for (const presence of leftPresences) {
            const userId = (presence as unknown as PresenceState).odilUserId;
            if (userId) {
              next.delete(userId);
            }
          }
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
          await channel.track({ odilUserId: userId });
          channelRef.current = channel;
        } else {
          channelRef.current = null;
        }
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [roomName, userId]);

  return { onlineUsers };
};
