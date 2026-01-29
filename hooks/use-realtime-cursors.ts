import {
  REALTIME_SUBSCRIBE_STATES,
  RealtimeChannel,
} from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Point {
  x: number;
  y: number;
}

/**
 * Throttle a callback to a certain delay, It will only call the callback if the delay has passed, with the arguments
 * from the last call
 */
const useThrottleCallback = <Params extends unknown[], Return>(
  callback: (...args: Params) => Return,
  delay: number,
) => {
  const lastCall = useRef(0);
  const timeout = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    (...args: Params) => {
      const now = Date.now();
      const remainingTime = delay - (now - lastCall.current);

      if (remainingTime <= 0) {
        if (timeout.current) {
          clearTimeout(timeout.current);
          timeout.current = null;
        }
        lastCall.current = now;
        callback(...args);
      } else if (!timeout.current) {
        timeout.current = setTimeout(() => {
          lastCall.current = Date.now();
          timeout.current = null;
          callback(...args);
        }, remainingTime);
      }
    },
    [callback, delay],
  );
};

const supabase = createClient();

const CURSOR_VARIANTS = [
  { image: "/paw-cursor-purple.png", color: "#8b5cf6" },
  { image: "/paw-cursor-green.png", color: "#22c55e" },
  { image: "/paw-cursor-orange.png", color: "#f97316" },
  { image: "/paw-cursor-black.png", color: "#1a1a1a" },
  { image: "/paw-cursor-white.png", color: "#f5f5f5" },
] as const;

const getRandomVariant = () =>
  CURSOR_VARIANTS[Math.floor(Math.random() * CURSOR_VARIANTS.length)];

const generateRandomId = () => Math.random().toString(36).substring(2, 15);

const EVENT_NAME = "realtime-cursor-move";

type CursorEventPayload = {
  position: {
    x: number;
    y: number;
  };
  user: {
    id: string;
    name: string;
  };
  color: string;
  cursorImage: string;
  timestamp: number;
};

export const useRealtimeCursors = ({
  roomName,
  username,
  throttleMs,
  screenToWorld,
}: {
  roomName: string;
  username: string;
  throttleMs: number;
  screenToWorld: (screen: Point) => Point;
}) => {
  const [variant] = useState(getRandomVariant);
  const [userId] = useState(generateRandomId);
  const [cursors, setCursors] = useState<Record<string, CursorEventPayload>>(
    {},
  );
  const cursorPayload = useRef<CursorEventPayload | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);

  const callback = useCallback(
    (event: MouseEvent) => {
      const { clientX, clientY } = event;

      // Convert screen coordinates to world coordinates
      const worldPos = screenToWorld({ x: clientX, y: clientY });

      const payload: CursorEventPayload = {
        position: {
          x: worldPos.x,
          y: worldPos.y,
        },
        user: {
          id: userId,
          name: username,
        },
        color: variant.color,
        cursorImage: variant.image,
        timestamp: new Date().getTime(),
      };

      cursorPayload.current = payload;

      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: EVENT_NAME,
          payload: payload,
        });
      }
    },
    [variant, userId, username, screenToWorld],
  );

  const handleMouseMove = useThrottleCallback(callback, throttleMs);

  useEffect(() => {
    const channel = supabase.channel(roomName);

    channel
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        leftPresences.forEach(function (element) {
          // Remove cursor when user leaves
          setCursors((prev) => {
            if (prev[element.key]) {
              delete prev[element.key];
            }

            return { ...prev };
          });
        });
      })
      .on("presence", { event: "join" }, () => {
        if (!cursorPayload.current) return;

        // All cursors broadcast their position when a new cursor joins
        channelRef.current?.send({
          type: "broadcast",
          event: EVENT_NAME,
          payload: cursorPayload.current,
        });
      })
      .on(
        "broadcast",
        { event: EVENT_NAME },
        (data: { payload: CursorEventPayload }) => {
          const { user } = data.payload;
          // Don't render your own cursor
          if (user.id === userId) {
            return;
          }

          setCursors((prev) => ({
            ...prev,
            [user.id]: data.payload,
          }));
        },
      )
      .subscribe(async (status) => {
        if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
          await channel.track({ key: userId });
          channelRef.current = channel;
        } else {
          setCursors({});
          channelRef.current = null;
        }
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [roomName, userId]);

  useEffect(() => {
    // Add event listener for mousemove
    window.addEventListener("mousemove", handleMouseMove);

    // Cleanup on unmount
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [handleMouseMove]);

  return { cursors };
};
