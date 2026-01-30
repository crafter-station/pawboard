import {
  REALTIME_SUBSCRIBE_STATES,
  type RealtimeChannel,
} from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Card,
  CommentWithCreator,
  Session,
  ThreadWithDetails,
  TiptapContent,
} from "@/db/schema";
import { useThrottleCallback } from "@/hooks/use-throttle-callback";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

// Throttle interval for realtime broadcasts (typing, moving, resizing)
// Increased from 50ms to 100ms to prevent React error #185 (Maximum update depth exceeded)
// when fast typing causes rapid state updates on receiving clients
const THROTTLE_MS = 100;

export type SessionSettings = Pick<Session, "isLocked">;

type CardEvent =
  | { type: "card:add"; card: Card }
  | { type: "card:update"; card: Card }
  | { type: "card:move"; id: string; x: number; y: number }
  | { type: "card:resize"; id: string; width: number; height: number }
  | { type: "card:delete"; id: string }
  | { type: "card:typing"; id: string; content: TiptapContent }
  | { type: "card:color"; id: string; color: string }
  | { type: "card:vote"; id: string; votes: number; votedBy: string[] }
  | { type: "card:react"; id: string; reactions: Record<string, string[]> }
  | { type: "card:editors"; id: string }
  | { type: "cards:sync"; cards: Card[] }
  | {
      type: "cards:cluster";
      positions: Array<{ id: string; x: number; y: number }>;
    }
  | { type: "user:join"; visitorId: string; username: string }
  | { type: "user:rename"; visitorId: string; newUsername: string }
  | { type: "session:rename"; newName: string }
  | { type: "session:settings"; settings: SessionSettings }
  // Thread events
  | { type: "thread:add"; thread: ThreadWithDetails }
  | { type: "thread:move"; id: string; x: number; y: number }
  | { type: "thread:attach"; threadId: string; cardId: string }
  | { type: "thread:detach"; threadId: string; x: number; y: number }
  | { type: "thread:resolve"; id: string; isResolved: boolean }
  | { type: "thread:delete"; id: string }
  | { type: "comment:add"; threadId: string; comment: CommentWithCreator }
  | {
      type: "comment:update";
      threadId: string;
      commentId: string;
      content: string;
    }
  | { type: "comment:delete"; threadId: string; commentId: string }
  | { type: "threads:sync"; threads: ThreadWithDetails[] };

export function useRealtimeCards(
  sessionId: string,
  initialCards: Card[],
  initialThreads: ThreadWithDetails[],
  userId: string,
  username: string | null,
  onUserJoinOrRename?: (visitorId: string, username: string) => void,
  onSessionRename?: (newName: string) => void,
  onSessionSettingsChange?: (settings: SessionSettings) => void,
  onEditorsChanged?: (cardId: string) => void,
) {
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [threads, setThreads] = useState<ThreadWithDetails[]>(initialThreads);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const cardsRef = useRef<Card[]>(initialCards);
  const threadsRef = useRef<ThreadWithDetails[]>(initialThreads);
  const onUserJoinOrRenameRef = useRef(onUserJoinOrRename);
  const onSessionRenameRef = useRef(onSessionRename);
  const onSessionSettingsChangeRef = useRef(onSessionSettingsChange);
  const onEditorsChangedRef = useRef(onEditorsChanged);
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
    onEditorsChangedRef.current = onEditorsChanged;
  }, [onEditorsChanged]);

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

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  const broadcast = useCallback(
    (event: CardEvent) => {
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "card-event",
          payload: { ...event, odilUserId: userId },
        });
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
    (id: string, content: TiptapContent) => {
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
    (id: string, content: TiptapContent) => {
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

  // Broadcast editors changed to other participants (so they refetch)
  const broadcastEditorsChanged = useCallback(
    (cardId: string) => {
      broadcast({ type: "card:editors", id: cardId });
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

  // Thread functions
  const addThread = useCallback(
    (thread: ThreadWithDetails) => {
      setThreads((prev) => [thread, ...prev]);
      broadcast({ type: "thread:add", thread });
    },
    [broadcast],
  );

  const broadcastMoveThread = useCallback(
    (id: string, x: number, y: number) => {
      broadcast({ type: "thread:move", id, x, y });
    },
    [broadcast],
  );

  const throttledBroadcastMoveThread = useThrottleCallback(
    broadcastMoveThread,
    THROTTLE_MS,
  );

  const moveThread = useCallback(
    (id: string, x: number, y: number) => {
      setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, x, y } : t)));
      throttledBroadcastMoveThread(id, x, y);
    },
    [throttledBroadcastMoveThread],
  );

  const attachThread = useCallback(
    (threadId: string, cardId: string) => {
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId ? { ...t, cardId, x: null, y: null } : t,
        ),
      );
      broadcast({ type: "thread:attach", threadId, cardId });
    },
    [broadcast],
  );

  const detachThread = useCallback(
    (threadId: string, x: number, y: number) => {
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, cardId: null, x, y } : t)),
      );
      broadcast({ type: "thread:detach", threadId, x, y });
    },
    [broadcast],
  );

  const resolveThread = useCallback(
    (id: string, isResolved: boolean) => {
      setThreads((prev) =>
        prev.map((t) => (t.id === id ? { ...t, isResolved } : t)),
      );
      broadcast({ type: "thread:resolve", id, isResolved });
    },
    [broadcast],
  );

  const removeThread = useCallback(
    (id: string) => {
      setThreads((prev) => prev.filter((t) => t.id !== id));
      broadcast({ type: "thread:delete", id });
    },
    [broadcast],
  );

  const addCommentToThread = useCallback(
    (threadId: string, comment: CommentWithCreator) => {
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId ? { ...t, comments: [...t.comments, comment] } : t,
        ),
      );
      broadcast({ type: "comment:add", threadId, comment });
    },
    [broadcast],
  );

  const updateCommentInThread = useCallback(
    (threadId: string, commentId: string, content: string) => {
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId
            ? {
                ...t,
                comments: t.comments.map((c) =>
                  c.id === commentId ? { ...c, content } : c,
                ),
              }
            : t,
        ),
      );
      broadcast({ type: "comment:update", threadId, commentId, content });
    },
    [broadcast],
  );

  const removeCommentFromThread = useCallback(
    (threadId: string, commentId: string) => {
      setThreads((prev) => {
        const thread = prev.find((t) => t.id === threadId);
        // If this is the last comment, remove the entire thread
        if (thread && thread.comments.length === 1) {
          return prev.filter((t) => t.id !== threadId);
        }
        // Otherwise just remove the comment
        return prev.map((t) =>
          t.id === threadId
            ? { ...t, comments: t.comments.filter((c) => c.id !== commentId) }
            : t,
        );
      });
      broadcast({ type: "comment:delete", threadId, commentId });
    },
    [broadcast],
  );

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(`cards:${sessionId}`);

    channel
      .on("presence", { event: "join" }, () => {
        // Sync cards
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
        // Sync threads
        if (threadsRef.current.length > 0) {
          channelRef.current?.send({
            type: "broadcast",
            event: "card-event",
            payload: {
              type: "threads:sync",
              threads: threadsRef.current,
              odilUserId: userId,
            },
          });
        }
      })
      .on(
        "broadcast",
        { event: "card-event" },
        ({ payload }: { payload: CardEvent & { odilUserId: string } }) => {
          if (payload.odilUserId === userId) {
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
                  c.id === payload.id
                    ? { ...c, content: payload.content as TiptapContent }
                    : c,
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
            case "card:editors":
              // Notify parent component to invalidate editors cache for this card
              onEditorsChangedRef.current?.(payload.id);
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
            // Thread events
            case "thread:add":
              setThreads((prev) => {
                if (prev.some((t) => t.id === payload.thread.id)) return prev;
                return [payload.thread, ...prev];
              });
              break;
            case "thread:move":
              setThreads((prev) =>
                prev.map((t) =>
                  t.id === payload.id
                    ? { ...t, x: payload.x, y: payload.y }
                    : t,
                ),
              );
              break;
            case "thread:attach":
              setThreads((prev) =>
                prev.map((t) =>
                  t.id === payload.threadId
                    ? { ...t, cardId: payload.cardId, x: null, y: null }
                    : t,
                ),
              );
              break;
            case "thread:detach":
              setThreads((prev) =>
                prev.map((t) =>
                  t.id === payload.threadId
                    ? { ...t, cardId: null, x: payload.x, y: payload.y }
                    : t,
                ),
              );
              break;
            case "thread:resolve":
              setThreads((prev) =>
                prev.map((t) =>
                  t.id === payload.id
                    ? { ...t, isResolved: payload.isResolved }
                    : t,
                ),
              );
              break;
            case "thread:delete":
              setThreads((prev) => prev.filter((t) => t.id !== payload.id));
              break;
            case "comment:add":
              setThreads((prev) =>
                prev.map((t) =>
                  t.id === payload.threadId
                    ? { ...t, comments: [...t.comments, payload.comment] }
                    : t,
                ),
              );
              break;
            case "comment:update":
              setThreads((prev) =>
                prev.map((t) =>
                  t.id === payload.threadId
                    ? {
                        ...t,
                        comments: t.comments.map((c) =>
                          c.id === payload.commentId
                            ? { ...c, content: payload.content }
                            : c,
                        ),
                      }
                    : t,
                ),
              );
              break;
            case "comment:delete":
              setThreads((prev) => {
                const thread = prev.find((t) => t.id === payload.threadId);
                // If this is the last comment, remove the entire thread
                if (thread && thread.comments.length === 1) {
                  return prev.filter((t) => t.id !== payload.threadId);
                }
                // Otherwise just remove the comment
                return prev.map((t) =>
                  t.id === payload.threadId
                    ? {
                        ...t,
                        comments: t.comments.filter(
                          (c) => c.id !== payload.commentId,
                        ),
                      }
                    : t,
                );
              });
              break;
            case "threads:sync":
              setThreads((prev) => {
                const newThreads = payload.threads.filter(
                  (nt) => !prev.some((t) => t.id === nt.id),
                );
                if (newThreads.length === 0) return prev;
                return [...newThreads, ...prev];
              });
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
    resizeCard,
    typeCard,
    changeColor,
    removeCard,
    voteCard,
    reactCard,
    broadcastNameChange,
    broadcastSessionRename,
    broadcastSessionSettings,
    broadcastEditorsChanged,
    applyClusterPositions,
    broadcastClusterPositions,
    batchMoveCards,
    // Thread functions
    threads,
    addThread,
    moveThread,
    attachThread,
    detachThread,
    resolveThread,
    removeThread,
    addCommentToThread,
    updateCommentInThread,
    removeCommentFromThread,
  };
}
