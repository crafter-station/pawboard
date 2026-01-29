import {
  REALTIME_SUBSCRIBE_STATES,
  RealtimeChannel,
} from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Card, Session } from "@/db/schema";
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

export type SessionSettings = Pick<
  Session,
  "isLocked" | "movePermission" | "deletePermission"
>;

type CardEvent =
  | { type: "card:add"; card: Card }
  | { type: "card:update"; card: Card }
  | { type: "card:move"; id: string; x: number; y: number }
  | { type: "card:resize"; id: string; width: number; height: number }
  | { type: "card:delete"; id: string }
  | { type: "card:typing"; id: string; content: string }
  | { type: "card:color"; id: string; color: string }
  | { type: "card:vote"; id: string; votes: number; votedBy: string[] }
  | { type: "card:react"; id: string; reactions: Record<string, string[]> }
  | { type: "cards:sync"; cards: Card[] }
  | {
      type: "cards:cluster";
      positions: Array<{ id: string; x: number; y: number }>;
    }
  | { type: "user:join"; visitorId: string; username: string }
  | { type: "user:rename"; visitorId: string; newUsername: string }
  | { type: "session:rename"; newName: string }
  | { type: "session:settings"; settings: SessionSettings };

export function useRealtimeCards(
  sessionId: string,
  initialCards: Card[],
  userId: string,
  username: string | null,
  onUserJoinOrRename?: (visitorId: string, username: string) => void,
  onSessionRename?: (newName: string) => void,
  onSessionSettingsChange?: (settings: SessionSettings) => void,
) {
  const [cards, setCards] = useState<Card[]>(initialCards);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const cardsRef = useRef<Card[]>(initialCards);
  const onUserJoinOrRenameRef = useRef(onUserJoinOrRename);
  const onSessionRenameRef = useRef(onSessionRename);
  const onSessionSettingsChangeRef = useRef(onSessionSettingsChange);
  const usernameRef = useRef(username);

  // Keep refs updated
  useEffect(() => {
    onUserJoinOrRenameRef.current = onUserJoinOrRename;
  }, [onUserJoinOrRename]);

  useEffect(() => {
    onSessionRenameRef.current = onSessionRename;
  }, [onSessionRename]);

  useEffect(() => {
    onSessionSettingsChangeRef.current = onSessionSettingsChange;
  }, [onSessionSettingsChange]);

  useEffect(() => {
    usernameRef.current = username;
    // Broadcast when username becomes available (user loaded)
    if (username && channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "card-event",
        payload: {
          type: "user:join",
          visitorId: userId,
          username: username,
          odilUserId: userId,
        },
      });
    }
  }, [username, userId]);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  const broadcast = useCallback(
    (event: CardEvent) => {
      if (channelRef.current) {
        console.log("[Cards] Broadcasting event:", event.type);
        channelRef.current.send({
          type: "broadcast",
          event: "card-event",
          payload: { ...event, odilUserId: userId },
        });
      } else {
        console.log(
          "[Cards] Channel not ready, skipping broadcast:",
          event.type,
        );
      }
    },
    [userId],
  );

  const broadcastMove = useCallback(
    (id: string, x: number, y: number) => {
      broadcast({ type: "card:move", id, x, y });
    },
    [broadcast],
  );

  const throttledBroadcastMove = useThrottleCallback(
    broadcastMove,
    THROTTLE_MS,
  );

  const broadcastTyping = useCallback(
    (id: string, content: string) => {
      broadcast({ type: "card:typing", id, content });
    },
    [broadcast],
  );

  const throttledBroadcastTyping = useThrottleCallback(
    broadcastTyping,
    THROTTLE_MS,
  );

  const addCard = useCallback(
    (card: Card) => {
      setCards((prev) => [...prev, card]);
      broadcast({ type: "card:add", card });
    },
    [broadcast],
  );

  const updateCard = useCallback(
    (card: Card) => {
      setCards((prev) => prev.map((c) => (c.id === card.id ? card : c)));
      broadcast({ type: "card:update", card });
    },
    [broadcast],
  );

  const moveCard = useCallback(
    (id: string, x: number, y: number) => {
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, x, y } : c)));
      throttledBroadcastMove(id, x, y);
    },
    [throttledBroadcastMove],
  );

  const broadcastResize = useCallback(
    (id: string, width: number, height: number) => {
      broadcast({ type: "card:resize", id, width, height });
    },
    [broadcast],
  );

  const throttledBroadcastResize = useThrottleCallback(
    broadcastResize,
    THROTTLE_MS,
  );

  const resizeCard = useCallback(
    (id: string, width: number, height: number) => {
      setCards((prev) =>
        prev.map((c) => (c.id === id ? { ...c, width, height } : c)),
      );
      throttledBroadcastResize(id, width, height);
    },
    [throttledBroadcastResize],
  );

  const typeCard = useCallback(
    (id: string, content: string) => {
      setCards((prev) =>
        prev.map((c) => (c.id === id ? { ...c, content } : c)),
      );
      throttledBroadcastTyping(id, content);
    },
    [throttledBroadcastTyping],
  );

  const changeColor = useCallback(
    (id: string, color: string) => {
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, color } : c)));
      broadcast({ type: "card:color", id, color });
    },
    [broadcast],
  );

  const removeCard = useCallback(
    (id: string) => {
      setCards((prev) => prev.filter((c) => c.id !== id));
      broadcast({ type: "card:delete", id });
    },
    [broadcast],
  );

  const voteCard = useCallback(
    (id: string, votes: number, votedBy: string[]) => {
      setCards((prev) =>
        prev.map((c) => (c.id === id ? { ...c, votes, votedBy } : c)),
      );
      broadcast({ type: "card:vote", id, votes, votedBy });
    },
    [broadcast],
  );

  const reactCard = useCallback(
    (id: string, reactions: Record<string, string[]>) => {
      setCards((prev) =>
        prev.map((c) => (c.id === id ? { ...c, reactions } : c)),
      );
      broadcast({ type: "card:react", id, reactions });
    },
    [broadcast],
  );

  // Broadcast name change to other participants (no local card update needed - cards reference users table)
  const broadcastNameChange = useCallback(
    (visitorId: string, newUsername: string) => {
      broadcast({ type: "user:rename", visitorId, newUsername });
    },
    [broadcast],
  );

  // Broadcast session rename to other participants
  const broadcastSessionRename = useCallback(
    (newName: string) => {
      broadcast({ type: "session:rename", newName });
    },
    [broadcast],
  );

  // Broadcast session settings change to other participants
  const broadcastSessionSettings = useCallback(
    (settings: SessionSettings) => {
      broadcast({ type: "session:settings", settings });
    },
    [broadcast],
  );

  // Apply cluster positions to cards (updates local state)
  const applyClusterPositions = useCallback(
    (positions: Array<{ id: string; x: number; y: number }>) => {
      setCards((prev) =>
        prev.map((card) => {
          const newPos = positions.find((p) => p.id === card.id);
          if (newPos) {
            return { ...card, x: newPos.x, y: newPos.y };
          }
          return card;
        }),
      );
    },
    [],
  );

  // Broadcast cluster positions to other participants
  const broadcastClusterPositions = useCallback(
    (positions: Array<{ id: string; x: number; y: number }>) => {
      broadcast({ type: "cards:cluster", positions });
    },
    [broadcast],
  );

  // Batch move cards - updates local state and broadcasts in one operation
  const batchMoveCards = useCallback(
    (positions: Array<{ id: string; x: number; y: number }>) => {
      // Update local state in one batch
      applyClusterPositions(positions);

      // Broadcast once (cluster for multi, single for one)
      if (positions.length > 1) {
        broadcastClusterPositions(positions);
      } else if (positions.length === 1) {
        broadcast({ type: "card:move", ...positions[0] });
      }
    },
    [applyClusterPositions, broadcastClusterPositions, broadcast],
  );

  useEffect(() => {
    if (!userId) return;

    console.log(
      "[Cards] Setting up channel for session:",
      sessionId,
      "userId:",
      userId,
    );
    const channel = supabase.channel(`cards:${sessionId}`);

    channel
      .on("presence", { event: "join" }, () => {
        console.log(
          "[Cards] Presence join event, syncing cards:",
          cardsRef.current.length,
        );
        if (cardsRef.current.length > 0) {
          channelRef.current?.send({
            type: "broadcast",
            event: "card-event",
            payload: {
              type: "cards:sync",
              cards: cardsRef.current,
              odilUserId: userId,
            },
          });
        }
      })
      .on(
        "broadcast",
        { event: "card-event" },
        ({ payload }: { payload: CardEvent & { odilUserId: string } }) => {
          console.log(
            "[Cards] Received event:",
            payload.type,
            "from:",
            payload.odilUserId,
          );
          if (payload.odilUserId === userId) {
            console.log("[Cards] Ignoring own event");
            return;
          }

          switch (payload.type) {
            case "card:add":
              setCards((prev) => {
                if (prev.some((c) => c.id === payload.card.id)) return prev;
                return [...prev, payload.card];
              });
              break;
            case "card:update":
              setCards((prev) =>
                prev.map((c) => (c.id === payload.card.id ? payload.card : c)),
              );
              break;
            case "card:move":
              setCards((prev) =>
                prev.map((c) =>
                  c.id === payload.id
                    ? { ...c, x: payload.x, y: payload.y }
                    : c,
                ),
              );
              break;
            case "card:resize":
              setCards((prev) =>
                prev.map((c) =>
                  c.id === payload.id
                    ? { ...c, width: payload.width, height: payload.height }
                    : c,
                ),
              );
              break;
            case "card:typing":
              setCards((prev) =>
                prev.map((c) =>
                  c.id === payload.id ? { ...c, content: payload.content } : c,
                ),
              );
              break;
            case "card:color":
              setCards((prev) =>
                prev.map((c) =>
                  c.id === payload.id ? { ...c, color: payload.color } : c,
                ),
              );
              break;
            case "card:delete":
              setCards((prev) => prev.filter((c) => c.id !== payload.id));
              break;
            case "card:vote":
              setCards((prev) =>
                prev.map((c) =>
                  c.id === payload.id
                    ? { ...c, votes: payload.votes, votedBy: payload.votedBy }
                    : c,
                ),
              );
              break;
            case "card:react":
              setCards((prev) =>
                prev.map((c) =>
                  c.id === payload.id
                    ? { ...c, reactions: payload.reactions }
                    : c,
                ),
              );
              break;
            case "cards:sync":
              setCards((prev) => {
                const newCards = payload.cards.filter(
                  (nc) => !prev.some((c) => c.id === nc.id),
                );
                if (newCards.length === 0) return prev;
                return [...prev, ...newCards];
              });
              break;
            case "cards:cluster":
              // Apply cluster positions from another user
              setCards((prev) =>
                prev.map((card) => {
                  const newPos = payload.positions.find(
                    (p) => p.id === card.id,
                  );
                  if (newPos) {
                    return { ...card, x: newPos.x, y: newPos.y };
                  }
                  return card;
                }),
              );
              break;
            case "user:join":
              // New user joined - add them to participants map
              onUserJoinOrRenameRef.current?.(
                payload.visitorId,
                payload.username,
              );
              break;
            case "user:rename":
              // Notify parent component to update participants map
              onUserJoinOrRenameRef.current?.(
                payload.visitorId,
                payload.newUsername,
              );
              break;
            case "session:rename":
              // Notify parent component to update session name
              onSessionRenameRef.current?.(payload.newName);
              break;
            case "session:settings":
              // Notify parent component to update session settings
              onSessionSettingsChangeRef.current?.(payload.settings);
              break;
          }
        },
      )
      .subscribe(async (status) => {
        console.log(
          "[Cards] Channel status:",
          status,
          "for session:",
          sessionId,
        );
        if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
          console.log(
            "[Cards] Successfully subscribed, tracking userId:",
            userId,
          );
          await channel.track({ odilUserId: userId });
          channelRef.current = channel;

          // Broadcast that we joined with our username
          if (usernameRef.current) {
            console.log(
              "[Cards] Broadcasting user:join for:",
              usernameRef.current,
            );
            channel.send({
              type: "broadcast",
              event: "card-event",
              payload: {
                type: "user:join",
                visitorId: userId,
                username: usernameRef.current,
                odilUserId: userId,
              },
            });
          }
        } else if (
          status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR ||
          status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT
        ) {
          console.log("[Cards] Channel error or timeout:", status);
          channelRef.current = null;
        }
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [sessionId, userId]);

  return {
    cards,
    addCard,
    updateCard,
    moveCard,
    resizeCard,
    typeCard,
    changeColor,
    removeCard,
    voteCard,
    reactCard,
    broadcastNameChange,
    broadcastSessionRename,
    broadcastSessionSettings,
    applyClusterPositions,
    broadcastClusterPositions,
    batchMoveCards,
  };
}
