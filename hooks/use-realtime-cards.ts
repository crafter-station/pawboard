import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  REALTIME_SUBSCRIBE_STATES,
  RealtimeChannel,
} from "@supabase/supabase-js";
import type { Card } from "@/db/schema";

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

type CardEvent =
  | { type: "card:add"; card: Card }
  | { type: "card:update"; card: Card }
  | { type: "card:move"; id: string; x: number; y: number }
  | { type: "card:delete"; id: string }
  | { type: "card:typing"; id: string; content: string }
  | { type: "card:color"; id: string; color: string }
  | { type: "card:vote"; id: string; votes: number; votedBy: string[] }
  | { type: "cards:sync"; cards: Card[] }
  | { type: "user:join"; visitorId: string; username: string }
  | { type: "user:rename"; visitorId: string; newUsername: string }
  | { type: "session:rename"; newName: string };

export function useRealtimeCards(
  sessionId: string,
  initialCards: Card[],
  userId: string,
  username: string | null,
  onUserJoinOrRename?: (visitorId: string, username: string) => void,
  onSessionRename?: (newName: string) => void,
) {
  const [cards, setCards] = useState<Card[]>(initialCards);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const cardsRef = useRef<Card[]>(initialCards);
  const onUserJoinOrRenameRef = useRef(onUserJoinOrRename);
  const onSessionRenameRef = useRef(onSessionRename);
  const usernameRef = useRef(username);

  // Keep refs updated
  useEffect(() => {
    onUserJoinOrRenameRef.current = onUserJoinOrRename;
  }, [onUserJoinOrRename]);

  useEffect(() => {
    onSessionRenameRef.current = onSessionRename;
  }, [onSessionRename]);

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
      channelRef.current?.send({
        type: "broadcast",
        event: "card-event",
        payload: { ...event, odilUserId: userId },
      });
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

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(`cards:${sessionId}`);

    channel
      .on("presence", { event: "join" }, () => {
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
          if (payload.odilUserId === userId) return;

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
            case "cards:sync":
              setCards((prev) => {
                const newCards = payload.cards.filter(
                  (nc) => !prev.some((c) => c.id === nc.id),
                );
                if (newCards.length === 0) return prev;
                return [...prev, ...newCards];
              });
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
          }
        },
      )
      .subscribe(async (status) => {
        if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
          await channel.track({ odilUserId: userId });
          channelRef.current = channel;

          // Broadcast that we joined with our username
          if (usernameRef.current) {
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
    typeCard,
    changeColor,
    removeCard,
    voteCard,
    broadcastNameChange,
    broadcastSessionRename,
  };
}
