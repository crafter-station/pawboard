import {
  REALTIME_SUBSCRIBE_STATES,
  type RealtimeChannel,
} from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { getCardById } from "@/app/actions";
import type {
  Card,
  CommentWithCreator,
  Session,
  SessionRole,
  ThreadWithDetails,
  TiptapContent,
} from "@/db/schema";
import { useThrottleCallback } from "@/hooks/use-throttle-callback";
import {
  createPlaceholderContent,
  obfuscateTiptapContent,
} from "@/lib/obfuscate";
import { createClient } from "@/lib/supabase/client";
import { extractTextFromTiptap } from "@/lib/tiptap-utils";

const supabase = createClient();

// Throttle interval for realtime broadcasts (typing, moving, resizing)
// Increased from 50ms to 100ms to prevent React error #185 (Maximum update depth exceeded)
// when fast typing causes rapid state updates on receiving clients
const THROTTLE_MS = 100;

export type SessionSettings = Pick<Session, "isLocked" | "isBlurred">;

type CardEvent =
  | { type: "card:add"; card: Card }
  | { type: "card:update"; card: Card }
  | { type: "card:move"; id: string; x: number; y: number }
  | { type: "card:resize"; id: string; width: number; height: number }
  | { type: "card:delete"; id: string }
  | { type: "card:typing"; id: string; content: TiptapContent }
  | { type: "card:typing-blur"; id: string; charCount: number }
  | { type: "card:color"; id: string; color: string }
  | { type: "card:vote"; id: string; votes: number; votedBy: string[] }
  | { type: "card:react"; id: string; reactions: Record<string, string[]> }
  | { type: "card:editors"; id: string }
  | { type: "cards:sync"; cards: Card[] }
  | { type: "cards:reveal"; cards: Card[] }
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

/**
 * Check if a card belongs to the current user.
 * After authentication, userId switches from fingerprintId to clerkId,
 * but cards created before auth still have createdById === fingerprintId.
 * We need to check both IDs to correctly identify ownership.
 */
function isOwnCard(
  card: Pick<Card, "createdById">,
  userId: string,
  fingerprintId: string | null,
): boolean {
  return (
    card.createdById === userId ||
    (fingerprintId !== null && card.createdById === fingerprintId)
  );
}

export function useRealtimeCards(
  sessionId: string,
  initialCards: Card[],
  initialThreads: ThreadWithDetails[],
  userId: string,
  fingerprintId: string | null,
  username: string | null,
  isBlurred: boolean,
  userRole: SessionRole | null,
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
  const isBlurredRef = useRef(isBlurred);
  const fingerprintIdRef = useRef(fingerprintId);
  const userRoleRef = useRef(userRole);
  const onUserJoinOrRenameRef = useRef(onUserJoinOrRename);
  const onSessionRenameRef = useRef(onSessionRename);
  const onSessionSettingsChangeRef = useRef(onSessionSettingsChange);
  const onEditorsChangedRef = useRef(onEditorsChanged);
  const usernameRef = useRef(username);

  // Ground-truth content for own cards during blur mode.
  // Only updated by local user actions and DB hydration — never from wire data.
  // This prevents any broadcast/sync event from corrupting own-card content.
  const ownCardTruthRef = useRef<Map<string, TiptapContent>>(new Map());

  // Keep blur/role/fingerprint refs updated
  useEffect(() => {
    isBlurredRef.current = isBlurred;
  }, [isBlurred]);

  useEffect(() => {
    fingerprintIdRef.current = fingerprintId;
  }, [fingerprintId]);

  useEffect(() => {
    userRoleRef.current = userRole;
  }, [userRole]);

  // Keep callback refs updated - consolidated into single effect
  useEffect(() => {
    onUserJoinOrRenameRef.current = onUserJoinOrRename;
    onSessionRenameRef.current = onSessionRename;
    onSessionSettingsChangeRef.current = onSessionSettingsChange;
    onEditorsChangedRef.current = onEditorsChanged;
  }, [
    onUserJoinOrRename,
    onSessionRename,
    onSessionSettingsChange,
    onEditorsChanged,
  ]);

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

  // Wrapper for setCards used by broadcast receivers (untrusted wire data).
  // Ensures own-card content is never overwritten by wire data during blur.
  const safeSetCards = useCallback(
    (updater: Card[] | ((prev: Card[]) => Card[])) => {
      setCards((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        const truthMap = ownCardTruthRef.current;
        if (truthMap.size === 0) return next;
        // Restore own-card content from truth map
        return next.map((card) => {
          const truth = truthMap.get(card.id);
          return truth !== undefined ? { ...card, content: truth } : card;
        });
      });
    },
    [],
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
      // Register in truth map so wire data can't corrupt own card content
      if (isBlurredRef.current) {
        ownCardTruthRef.current.set(card.id, card.content);
      }
      setCards((prev) => [...prev, card]);
      if (isBlurredRef.current) {
        // Broadcast card with obfuscated content so others can't read it
        broadcast({
          type: "card:add",
          card: {
            ...card,
            content: obfuscateTiptapContent(card.content),
          },
        });
      } else {
        broadcast({ type: "card:add", card });
      }
    },
    [broadcast],
  );

  const updateCard = useCallback(
    (card: Card) => {
      // Update truth map if this is our card
      if (ownCardTruthRef.current.has(card.id)) {
        ownCardTruthRef.current.set(card.id, card.content);
      }
      setCards((prev) => prev.map((c) => (c.id === card.id ? card : c)));
      if (isBlurredRef.current) {
        broadcast({
          type: "card:update",
          card: {
            ...card,
            content: obfuscateTiptapContent(card.content),
          },
        });
      } else {
        broadcast({ type: "card:update", card });
      }
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
      // Update truth map if this is our card
      if (ownCardTruthRef.current.has(id)) {
        ownCardTruthRef.current.set(id, content);
      }
      // Always update local state with real content (user can see own cards)
      setCards((prev) =>
        prev.map((c) => (c.id === id ? { ...c, content } : c)),
      );
      if (isBlurredRef.current) {
        // Only broadcast card ID + character count, no actual content
        const charCount = extractTextFromTiptap(content).length;
        broadcast({ type: "card:typing-blur", id, charCount });
      } else {
        throttledBroadcastTyping(id, content);
      }
    },
    [throttledBroadcastTyping, broadcast],
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
      ownCardTruthRef.current.delete(id);
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

  // Blur mode: replace all card state with real content (used when blur is turned off)
  const revealAllCards = useCallback((realCards: Card[]) => {
    ownCardTruthRef.current.clear();
    setCards(realCards);
  }, []);

  // Blur mode: patch own cards into state (replace obfuscated SSR data with real content)
  const patchOwnCards = useCallback((myCards: Card[]) => {
    // Populate truth map with real content from DB
    for (const card of myCards) {
      ownCardTruthRef.current.set(card.id, card.content);
    }
    setCards((prev) =>
      prev.map((c) => {
        const real = myCards.find((m) => m.id === c.id);
        return real ?? c;
      }),
    );
  }, []);

  // Blur mode: broadcast real cards to all participants when revealing
  const broadcastRevealCards = useCallback(
    (realCards: Card[]) => {
      broadcast({ type: "cards:reveal", cards: realCards });
    },
    [broadcast],
  );

  // React to blur being turned ON/OFF: manage obfuscation and truth map
  const prevBlurredRef = useRef(isBlurred);
  useEffect(() => {
    if (isBlurred && !prevBlurredRef.current) {
      // Blur just turned ON — obfuscate all non-own cards in state
      setCards((prev) =>
        prev.map((c) =>
          isOwnCard(c, userId, fingerprintId)
            ? c
            : { ...c, content: obfuscateTiptapContent(c.content) },
        ),
      );
    } else if (!isBlurred && prevBlurredRef.current) {
      // Blur just turned OFF — clear truth map (no longer needed)
      ownCardTruthRef.current.clear();
    }
    prevBlurredRef.current = isBlurred;
  }, [isBlurred, userId, fingerprintId]);

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

    // Track if component is mounted to prevent state updates after unmount
    let isMounted = true;

    const channel = supabase.channel(`cards:${sessionId}`);

    channel
      .on("presence", { event: "join" }, () => {
        // Sync cards to newly joined participants.
        // Skip entirely during blur mode: each client gets cards from SSR
        // + hydration, and sending syncs risks leaking obfuscated data
        // (e.g. after SSR reload where cardsRef contains all-obfuscated
        // initial data).
        if (!isBlurredRef.current && cardsRef.current.length > 0) {
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
            case "card:add": {
              const incomingCard = payload.card;
              const ownCard = isOwnCard(
                incomingCard,
                userId,
                fingerprintIdRef.current,
              );

              if (isBlurredRef.current && ownCard) {
                // Own card during blur: wire content is obfuscated for security.
                // Add the card, then immediately fetch real content from DB.
                safeSetCards((prev) => {
                  if (prev.some((c) => c.id === incomingCard.id)) return prev;
                  return [...prev, incomingCard];
                });
                getCardById(incomingCard.id).then((realCard) => {
                  if (realCard) {
                    // Update truth map with real content from DB
                    ownCardTruthRef.current.set(realCard.id, realCard.content);
                    safeSetCards((prev) =>
                      prev.map((c) => (c.id === realCard.id ? realCard : c)),
                    );
                  }
                });
              } else {
                // Not our card — obfuscate (defense-in-depth)
                const cardToStore = isBlurredRef.current
                  ? {
                      ...incomingCard,
                      content: obfuscateTiptapContent(incomingCard.content),
                    }
                  : incomingCard;
                safeSetCards((prev) => {
                  if (prev.some((c) => c.id === cardToStore.id)) return prev;
                  return [...prev, cardToStore];
                });
              }
              break;
            }
            case "card:update": {
              const updatedCard = payload.card;
              const ownUpdatedCard = isOwnCard(
                updatedCard,
                userId,
                fingerprintIdRef.current,
              );

              if (isBlurredRef.current && ownUpdatedCard) {
                // Own card during blur: preserve local content (wire content
                // is obfuscated for security), update non-content fields only,
                // then fetch real content from DB to pick up actual changes.
                safeSetCards((prev) =>
                  prev.map((c) =>
                    c.id === updatedCard.id
                      ? { ...updatedCard, content: c.content }
                      : c,
                  ),
                );
                getCardById(updatedCard.id).then((realCard) => {
                  if (realCard) {
                    // Update truth map with real content from DB
                    ownCardTruthRef.current.set(realCard.id, realCard.content);
                    safeSetCards((prev) =>
                      prev.map((c) => (c.id === realCard.id ? realCard : c)),
                    );
                  }
                });
              } else {
                // Not our card — obfuscate (defense-in-depth)
                const cardToUpdate = isBlurredRef.current
                  ? {
                      ...updatedCard,
                      content: obfuscateTiptapContent(updatedCard.content),
                    }
                  : updatedCard;
                safeSetCards((prev) =>
                  prev.map((c) =>
                    c.id === cardToUpdate.id ? cardToUpdate : c,
                  ),
                );
              }
              break;
            }
            case "card:move":
              safeSetCards((prev) =>
                prev.map((c) =>
                  c.id === payload.id
                    ? { ...c, x: payload.x, y: payload.y }
                    : c,
                ),
              );
              break;
            case "card:resize":
              safeSetCards((prev) =>
                prev.map((c) =>
                  c.id === payload.id
                    ? { ...c, width: payload.width, height: payload.height }
                    : c,
                ),
              );
              break;
            case "card:typing":
              // During blur, ignore raw typing events — only card:typing-blur is safe
              if (isBlurredRef.current) break;
              safeSetCards((prev) =>
                prev.map((c) =>
                  c.id === payload.id
                    ? { ...c, content: payload.content as TiptapContent }
                    : c,
                ),
              );
              break;
            case "card:typing-blur":
              // Someone is typing on a blurred card — show placeholder content
              safeSetCards((prev) =>
                prev.map((c) =>
                  c.id === payload.id
                    ? {
                        ...c,
                        content: createPlaceholderContent(payload.charCount),
                      }
                    : c,
                ),
              );
              break;
            case "card:color":
              safeSetCards((prev) =>
                prev.map((c) =>
                  c.id === payload.id ? { ...c, color: payload.color } : c,
                ),
              );
              break;
            case "card:delete":
              safeSetCards((prev) => prev.filter((c) => c.id !== payload.id));
              break;
            case "card:vote":
              safeSetCards((prev) =>
                prev.map((c) =>
                  c.id === payload.id
                    ? { ...c, votes: payload.votes, votedBy: payload.votedBy }
                    : c,
                ),
              );
              break;
            case "card:react":
              safeSetCards((prev) =>
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
            case "cards:sync": {
              const fpId = fingerprintIdRef.current;
              // Defense-in-depth: obfuscate non-own cards when blur is on
              const syncCards = isBlurredRef.current
                ? payload.cards.map((c) =>
                    isOwnCard(c, userId, fpId)
                      ? c
                      : {
                          ...c,
                          content: obfuscateTiptapContent(c.content),
                        },
                  )
                : payload.cards;
              safeSetCards((prev) => {
                const newCards = syncCards.filter(
                  (nc) => !prev.some((c) => c.id === nc.id),
                );
                if (newCards.length === 0) return prev;
                return [...prev, ...newCards];
              });
              break;
            }
            case "cards:reveal":
              // Creator turned off blur — replace all cards with real content
              ownCardTruthRef.current.clear();
              safeSetCards(payload.cards);
              break;
            case "cards:cluster":
              // Apply cluster positions from another user
              safeSetCards((prev) =>
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

          // Exit early if component unmounted during async operation
          if (!isMounted) return;

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
      isMounted = false;
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [sessionId, userId, safeSetCards]);

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
    // Blur mode functions
    revealAllCards,
    patchOwnCards,
    broadcastRevealCards,
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
