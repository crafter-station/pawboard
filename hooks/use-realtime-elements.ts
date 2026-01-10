import {
  REALTIME_SUBSCRIBE_STATES,
  RealtimeChannel,
} from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Element, ElementData } from "@/db/schema";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

const THROTTLE_MS = 50;

function useThrottleCallback<Params extends unknown[], Return>(
  callback: (...args: Params) => Return,
  delay: number,
) {
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
}

type ElementEvent =
  | { type: "element:add"; element: Element }
  | { type: "element:update"; element: Element }
  | { type: "element:move"; id: string; x: number; y: number }
  | {
      type: "element:resize";
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | { type: "element:data"; id: string; data: ElementData }
  | { type: "element:delete"; id: string }
  | { type: "elements:sync"; elements: Element[] };

export function useRealtimeElements(
  sessionId: string,
  initialElements: Element[],
  userId: string,
) {
  const [elements, setElements] = useState<Element[]>(initialElements);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const elementsRef = useRef<Element[]>(initialElements);

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  const broadcast = useCallback(
    (event: ElementEvent) => {
      channelRef.current?.send({
        type: "broadcast",
        event: "element-event",
        payload: { ...event, odilUserId: userId },
      });
    },
    [userId],
  );

  const broadcastMove = useCallback(
    (id: string, x: number, y: number) => {
      broadcast({ type: "element:move", id, x, y });
    },
    [broadcast],
  );

  const throttledBroadcastMove = useThrottleCallback(
    broadcastMove,
    THROTTLE_MS,
  );

  const broadcastResize = useCallback(
    (id: string, x: number, y: number, width: number, height: number) => {
      broadcast({ type: "element:resize", id, x, y, width, height });
    },
    [broadcast],
  );

  const throttledBroadcastResize = useThrottleCallback(
    broadcastResize,
    THROTTLE_MS,
  );

  const addElement = useCallback(
    (element: Element) => {
      setElements((prev) => [...prev, element]);
      broadcast({ type: "element:add", element });
    },
    [broadcast],
  );

  const updateElement = useCallback(
    (element: Element) => {
      setElements((prev) =>
        prev.map((e) => (e.id === element.id ? element : e)),
      );
      broadcast({ type: "element:update", element });
    },
    [broadcast],
  );

  const moveElement = useCallback(
    (id: string, x: number, y: number) => {
      setElements((prev) =>
        prev.map((e) => (e.id === id ? { ...e, x, y } : e)),
      );
      throttledBroadcastMove(id, x, y);
    },
    [throttledBroadcastMove],
  );

  const resizeElement = useCallback(
    (id: string, x: number, y: number, width: number, height: number) => {
      setElements((prev) =>
        prev.map((e) => (e.id === id ? { ...e, x, y, width, height } : e)),
      );
      throttledBroadcastResize(id, x, y, width, height);
    },
    [throttledBroadcastResize],
  );

  const updateElementData = useCallback(
    (id: string, data: ElementData) => {
      setElements((prev) =>
        prev.map((e) => (e.id === id ? { ...e, data } : e)),
      );
      broadcast({ type: "element:data", id, data });
    },
    [broadcast],
  );

  const removeElement = useCallback(
    (id: string) => {
      setElements((prev) => prev.filter((e) => e.id !== id));
      broadcast({ type: "element:delete", id });
    },
    [broadcast],
  );

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(`elements:${sessionId}`);

    channel
      .on("presence", { event: "join" }, () => {
        if (elementsRef.current.length > 0) {
          channelRef.current?.send({
            type: "broadcast",
            event: "element-event",
            payload: {
              type: "elements:sync",
              elements: elementsRef.current,
              odilUserId: userId,
            },
          });
        }
      })
      .on(
        "broadcast",
        { event: "element-event" },
        ({ payload }: { payload: ElementEvent & { odilUserId: string } }) => {
          if (payload.odilUserId === userId) return;

          switch (payload.type) {
            case "element:add":
              setElements((prev) => {
                if (prev.some((e) => e.id === payload.element.id)) return prev;
                return [...prev, payload.element];
              });
              break;
            case "element:update":
              setElements((prev) =>
                prev.map((e) =>
                  e.id === payload.element.id ? payload.element : e,
                ),
              );
              break;
            case "element:move":
              setElements((prev) =>
                prev.map((e) =>
                  e.id === payload.id
                    ? { ...e, x: payload.x, y: payload.y }
                    : e,
                ),
              );
              break;
            case "element:resize":
              setElements((prev) =>
                prev.map((e) =>
                  e.id === payload.id
                    ? {
                        ...e,
                        x: payload.x,
                        y: payload.y,
                        width: payload.width,
                        height: payload.height,
                      }
                    : e,
                ),
              );
              break;
            case "element:data":
              setElements((prev) =>
                prev.map((e) =>
                  e.id === payload.id ? { ...e, data: payload.data } : e,
                ),
              );
              break;
            case "element:delete":
              setElements((prev) => prev.filter((e) => e.id !== payload.id));
              break;
            case "elements:sync":
              setElements((prev) => {
                const newElements = payload.elements.filter(
                  (ne) => !prev.some((e) => e.id === ne.id),
                );
                if (newElements.length === 0) return prev;
                return [...prev, ...newElements];
              });
              break;
          }
        },
      )
      .subscribe(async (status) => {
        if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
          await channel.track({ odilUserId: userId });
          channelRef.current = channel;
        } else if (
          status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR ||
          status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT
        ) {
          channelRef.current = null;
        }
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [sessionId, userId]);

  return {
    elements,
    addElement,
    updateElement,
    moveElement,
    resizeElement,
    updateElementData,
    removeElement,
  };
}
