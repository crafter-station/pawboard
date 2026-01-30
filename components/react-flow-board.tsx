"use client";

import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  MiniMap,
  type Node,
  type NodeChange,
  type NodeTypes,
  type OnNodesChange,
  type OnSelectionChangeFunc,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Check,
  Command,
  Home,
  Lock,
  Maximize2,
  MessageSquarePlus,
  Minus,
  Pencil,
  Plus,
  Share2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addComment as addCommentAction,
  attachThreadToCard as attachThreadToCardAction,
  createCard,
  createThread as createThreadAction,
  deleteCard,
  deleteComment as deleteCommentAction,
  deleteEmptyCards,
  deleteSession,
  deleteThread as deleteThreadAction,
  detachThreadFromCard as detachThreadFromCardAction,
  moveThread as moveThreadAction,
  resizeCard,
  resolveThread as resolveThreadAction,
  toggleReaction,
  updateCard,
  updateSessionName,
  updateSessionSettings,
  voteCard as voteCardAction,
} from "@/app/actions";
import { ChatPanel, ChatTrigger } from "@/components/chat/chat-drawer";
import { ClusterCardsDialog } from "@/components/cluster-cards-dialog";
import { CommandMenu } from "@/components/command-menu";
import { EditNameDialog } from "@/components/edit-name-dialog";
import {
  IdeaCardNode,
  setIdeaCardNodeCallbacks,
} from "@/components/idea-card-node";
import { RealtimeCursors } from "@/components/realtime-cursors";
import { CreateThreadPanel, ThreadNode } from "@/components/threads";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserBadge } from "@/components/user-badge";
import type {
  Card,
  Session,
  ThreadWithDetails,
  TiptapContent,
} from "@/db/schema";
import { DEFAULT_TIPTAP_CONTENT } from "@/db/schema";
import {
  useInvalidateCardEditors,
  useSessionCardEditors,
} from "@/hooks/use-card-editors";
import { useCatSound } from "@/hooks/use-cat-sound";
import { useFingerprint } from "@/hooks/use-fingerprint";
import type { SessionSettings } from "@/hooks/use-realtime-cards";
import { useRealtimeCards } from "@/hooks/use-realtime-cards";
import { useRealtimePresence } from "@/hooks/use-realtime-presence";
import { useSessionUsername } from "@/hooks/use-session-username";
import { DARK_COLORS, LIGHT_COLORS } from "@/lib/colors";
import { findCardAtPoint, getThreadBubbleCenter } from "@/lib/geometry-utils";
import { generateCardId } from "@/lib/nanoid";
import { canAddCard } from "@/lib/permissions";
import {
  CARD_HEIGHT,
  CARD_HEIGHT_MOBILE,
  CARD_WIDTH,
  CARD_WIDTH_MOBILE,
  type CardThreadHandlers,
  calculateCardsBounds,
  cardsToNodes,
  DEFAULT_CARD_HEIGHT,
  DEFAULT_CARD_WIDTH,
  type IdeaCardNode as IdeaCardNodeType,
  type ThreadNode as ThreadNodeType,
  threadsToNodes,
  updateNodeData,
} from "@/lib/react-flow-utils";
import { createTiptapContent } from "@/lib/tiptap-utils";
import { cn, getAvatarForUser } from "@/lib/utils";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useThreadFocusStore } from "@/stores/thread-focus-store";

// Stable empty object to avoid creating new references on each render
const EMPTY_EDITORS: Record<
  string,
  Array<{ userId: string; username: string }>
> = {};

export interface Participant {
  visitorId: string;
  username: string;
}

interface ReactFlowBoardProps {
  sessionId: string;
  initialSession: Session;
  initialCards: Card[];
  initialThreads: ThreadWithDetails[];
  initialParticipants: Participant[];
}

// Register node types
const nodeTypes: NodeTypes = {
  ideaCard: IdeaCardNode,
  thread: ThreadNode,
};

// Minimum zoom and maximum zoom
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;

function ReactFlowBoardInner({
  sessionId,
  initialSession,
  initialCards,
  initialThreads,
  initialParticipants,
}: ReactFlowBoardProps) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { visitorId, isLoading: isFingerprintLoading } = useFingerprint();
  const playSound = useCatSound();
  const isSidebarOpen = useSidebarStore((state) => state.isOpen);
  const setFocusedThread = useThreadFocusStore((s) => s.setFocusedThread);
  const invalidateCardEditors = useInvalidateCardEditors();

  // React Flow hooks
  const {
    fitView,
    zoomIn,
    zoomOut,
    setViewport,
    setCenter,
    screenToFlowPosition,
    flowToScreenPosition,
  } = useReactFlow();

  // Create stable ref for screenToFlowPosition to avoid infinite loops
  // (useReactFlow returns new function references on every render)
  const screenToFlowPositionRef = useRef(screenToFlowPosition);
  useEffect(() => {
    screenToFlowPositionRef.current = screenToFlowPosition;
  });

  const stableScreenToFlowPosition = useCallback(
    (position: { x: number; y: number }) =>
      screenToFlowPositionRef.current(position),
    [],
  );

  // State
  const [cardNodes, setCardNodes] = useState<IdeaCardNodeType[]>([]);
  const [threadNodes, setThreadNodes] = useState<ThreadNodeType[]>([]);
  // Combined nodes for React Flow
  const nodes = useMemo(
    () =>
      [...cardNodes, ...threadNodes] as (IdeaCardNodeType | ThreadNodeType)[],
    [cardNodes, threadNodes],
  );
  const setNodes = setCardNodes; // For backwards compatibility with card node updates
  const [copied, setCopied] = useState(false);
  const [newCardId, setNewCardId] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editSessionNameOpen, setEditSessionNameOpen] = useState(false);
  const [clusterDialogOpen, setClusterDialogOpen] = useState(false);
  const [deleteSessionDialogOpen, setDeleteSessionDialogOpen] = useState(false);
  const [session, setSession] = useState<Session>(initialSession);
  const [participants, setParticipants] = useState<Map<string, string>>(
    () => new Map(initialParticipants.map((p) => [p.visitorId, p.username])),
  );
  const [copiedCard, setCopiedCard] = useState<{
    content: TiptapContent;
    color: string;
    width: number;
    height: number;
  } | null>(null);
  // Use ref for mouse position - it's a transient value that doesn't need to trigger re-renders
  const mousePositionRef = useRef<{ x: number; y: number } | null>(null);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(
    new Set(),
  );
  const [zoom, setZoom] = useState(1);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isReactFlowReady, setIsReactFlowReady] = useState(false);
  const [showResolvedThreads] = useState(true);
  // Context menu position for right-click actions
  const [contextMenuPosition, setContextMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  // Board context menu open state (controlled)
  const [boardMenuOpen, setBoardMenuOpen] = useState(false);
  // Magnetic thread attachment state
  const [magneticTargetCardId, setMagneticTargetCardId] = useState<
    string | null
  >(null);
  const hasInitializedViewRef = useRef(false);
  // Ref to store duplicate callback to avoid stale closures in useEffect
  const handleDuplicateCardRef = useRef<((card: Card) => void) | null>(null);
  // Ref to store add thread to card callback
  const handleAddThreadToCardRef = useRef<((cardId: string) => void) | null>(
    null,
  );
  // Track component mount state for async operations
  const mountedRef = useRef(true);
  // Ref to access current cards value without adding to callback dependencies
  const cardsRef = useRef<Card[]>(initialCards);
  // Ref for the board container - used to constrain hover card positioning
  const boardContainerRef = useRef<HTMLDivElement>(null);

  // Cleanup mounted ref on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Derive isMobile from viewportSize - avoids recalculating in multiple places
  const isMobile = viewportSize.width > 0 && viewportSize.width < 640;

  const {
    username,
    role: sessionRole,
    isLoading: isUsernameLoading,
    updateUsername,
  } = useSessionUsername({
    sessionId,
    visitorId,
  });

  // Derived state - use sessionRole directly instead of syncing via useEffect
  const userRole = sessionRole ?? null;
  const isSessionCreator = userRole === "creator";
  const isLocked = session.isLocked;

  // Track online presence for participants
  const { onlineUsers } = useRealtimePresence({
    roomName: sessionId,
    userId: visitorId || "",
  });

  // Fetch all card editors for the session in one request
  const { data: sessionEditorsData } = useSessionCardEditors(sessionId);
  const sessionEditors = sessionEditorsData?.editors ?? EMPTY_EDITORS;

  // Derive participants map with current user included
  // This is better than using useEffect to sync state
  const participantsWithCurrentUser = useMemo(() => {
    if (!visitorId || !username) return participants;
    const updated = new Map(participants);
    updated.set(visitorId, username);
    return updated;
  }, [participants, visitorId, username]);

  // Update viewport size
  useEffect(() => {
    const updateViewportSize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };

    updateViewportSize();
    window.addEventListener("resize", updateViewportSize);
    return () => window.removeEventListener("resize", updateViewportSize);
  }, []);

  // Track mouse position for intelligent paste (using ref - no re-renders needed)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePositionRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Restore clipboard from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("pawboard_clipboard");
      if (stored) {
        const parsed = JSON.parse(stored);
        // Handle legacy string content format
        if (typeof parsed.content === "string") {
          parsed.content = createTiptapContent(parsed.content);
        }
        setCopiedCard(parsed);
      }
    } catch (error) {
      console.warn("Failed to restore clipboard from sessionStorage:", error);
    }
  }, []);

  // Helper to get username for a user ID - derive from participantsWithCurrentUser
  const getUsernameForId = useCallback(
    (userId: string): string => {
      return participantsWithCurrentUser.get(userId) ?? "Unknown";
    },
    [participantsWithCurrentUser],
  );

  // Handle incoming name change events from realtime
  const handleRemoteNameChange = useCallback(
    (userId: string, newName: string) => {
      setParticipants((prev) => {
        const next = new Map(prev);
        next.set(userId, newName);
        return next;
      });
    },
    [],
  );

  // Handle incoming session rename events from realtime
  const handleRemoteSessionRename = useCallback((newName: string) => {
    setSession((prev) => ({ ...prev, name: newName }));
  }, []);

  // Handle incoming session settings change events from realtime
  const handleRemoteSessionSettingsChange = useCallback(
    (settings: SessionSettings) => {
      setSession((prev) => ({ ...prev, ...settings }));
    },
    [],
  );

  // Handle incoming editors change events from realtime (invalidate cache)
  const handleRemoteEditorsChange = useCallback(
    (cardId: string) => {
      invalidateCardEditors(cardId);
    },
    [invalidateCardEditors],
  );

  const {
    cards,
    addCard,
    resizeCard: realtimeResizeCard,
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
    removeCommentFromThread,
  } = useRealtimeCards(
    sessionId,
    initialCards,
    initialThreads,
    visitorId || "",
    username,
    handleRemoteNameChange,
    handleRemoteSessionRename,
    handleRemoteSessionSettingsChange,
    handleRemoteEditorsChange,
  );

  // Keep cardsRef in sync with cards state for use in callbacks
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  // Create thread handlers for card-attached threads
  const cardThreadHandlers = useMemo<CardThreadHandlers>(
    () => ({
      onAddComment: async (threadId: string, content: string) => {
        if (!visitorId) return;
        const { comment, error } = await addCommentAction(
          threadId,
          content,
          visitorId,
        );
        if (error || !comment) {
          console.error("Failed to add comment:", error);
          return;
        }
        addCommentToThread(threadId, comment);
      },
      onDeleteComment: async (threadId: string, commentId: string) => {
        if (!visitorId) return;
        const { error } = await deleteCommentAction(commentId, visitorId);
        if (error) {
          console.error("Failed to delete comment:", error);
          return;
        }
        removeCommentFromThread(threadId, commentId);
      },
      onResolve: async (threadId: string, isResolved: boolean) => {
        if (!visitorId) return;
        const { error } = await resolveThreadAction(
          threadId,
          isResolved,
          visitorId,
        );
        if (error) {
          console.error("Failed to resolve thread:", error);
          return;
        }
        resolveThread(threadId, isResolved);
      },
      onDeleteThread: async (threadId: string) => {
        if (!visitorId) return;
        const { error } = await deleteThreadAction(threadId, visitorId);
        if (error) {
          console.error("Failed to delete thread:", error);
          return;
        }
        removeThread(threadId);
      },
      onDetach: async (
        threadId: string,
        position: { x: number; y: number },
      ) => {
        if (!visitorId) return;
        // Optimistic update
        detachThread(threadId, position.x, position.y);
        // Persist to database
        const { error } = await detachThreadFromCardAction(
          threadId,
          position.x,
          position.y,
          visitorId,
        );
        if (error) {
          console.error("Failed to detach thread:", error);
          // Note: Could revert optimistic update here if needed
        }
      },
      screenToFlowPosition: stableScreenToFlowPosition,
    }),
    [
      visitorId,
      addCommentToThread,
      removeCommentFromThread,
      resolveThread,
      removeThread,
      detachThread,
      stableScreenToFlowPosition,
    ],
  );

  // Group card-attached threads by cardId
  const threadsByCardId = useMemo(() => {
    const map = new Map<string, typeof threads>();
    for (const thread of threads) {
      if (thread.cardId) {
        const list = map.get(thread.cardId) ?? [];
        list.push(thread);
        map.set(thread.cardId, list);
      }
    }
    return map;
  }, [threads]);

  // Sync cards to nodes - skip during drag to prevent flickering
  // BUT we need to update during drag if magneticTargetCardId changes
  useEffect(() => {
    if (!visitorId) return;
    // Skip full sync during drag, but allow magnetic highlight updates
    if (isDragging && magneticTargetCardId === null) return;

    setNodes((currentNodes) => {
      if (currentNodes.length === 0 && cards.length > 0) {
        // Initial load
        return cardsToNodes(
          cards,
          session,
          userRole,
          visitorId,
          getUsernameForId,
          newCardId,
          threadsByCardId,
          cardThreadHandlers,
          magneticTargetCardId,
          sessionEditors,
        );
      }
      // Update existing nodes
      return updateNodeData(
        currentNodes,
        cards,
        session,
        userRole,
        visitorId,
        getUsernameForId,
        threadsByCardId,
        cardThreadHandlers,
        magneticTargetCardId,
        sessionEditors,
      );
    });
  }, [
    cards,
    session,
    userRole,
    visitorId,
    getUsernameForId,
    newCardId,
    isDragging,
    threadsByCardId,
    cardThreadHandlers,
    magneticTargetCardId,
    sessionEditors,
  ]);

  // Thread action handlers
  const handleAddCommentToThread = useCallback(
    async (threadId: string, content: string) => {
      if (!visitorId) return;
      const { comment, error } = await addCommentAction(
        threadId,
        content,
        visitorId,
      );
      if (error || !comment) {
        console.error("Failed to add comment:", error);
        return;
      }
      addCommentToThread(threadId, comment);
    },
    [visitorId, addCommentToThread],
  );

  const handleDeleteCommentFromThread = useCallback(
    async (threadId: string, commentId: string) => {
      if (!visitorId) return;
      const { error } = await deleteCommentAction(commentId, visitorId);
      if (error) {
        console.error("Failed to delete comment:", error);
        return;
      }
      removeCommentFromThread(threadId, commentId);
    },
    [visitorId, removeCommentFromThread],
  );

  const handleResolveThread = useCallback(
    async (threadId: string, isResolved: boolean) => {
      if (!visitorId) return;
      const { error } = await resolveThreadAction(
        threadId,
        isResolved,
        visitorId,
      );
      if (error) {
        console.error("Failed to resolve thread:", error);
        return;
      }
      resolveThread(threadId, isResolved);
    },
    [visitorId, resolveThread],
  );

  const handleDeleteThread = useCallback(
    async (threadId: string) => {
      if (!visitorId) return;
      const { error } = await deleteThreadAction(threadId, visitorId);
      if (error) {
        console.error("Failed to delete thread:", error);
        return;
      }
      removeThread(threadId);
    },
    [visitorId, removeThread],
  );

  // Handle focusing on a thread from the sidebar
  const handleFocusThread = useCallback(
    (threadId: string) => {
      const thread = threads.find((t) => t.id === threadId);
      if (!thread) return;

      // Determine the position to focus on
      let focusX: number;
      let focusY: number;

      if (thread.cardId) {
        // Thread is attached to a card - find the card position
        const card = cards.find((c) => c.id === thread.cardId);
        if (card) {
          focusX = card.x + (card.width || DEFAULT_CARD_WIDTH) / 2;
          focusY = card.y + (card.height || DEFAULT_CARD_HEIGHT) / 2;
        } else {
          return;
        }
      } else if (thread.x !== null && thread.y !== null) {
        // Canvas thread - use its position
        focusX = thread.x;
        focusY = thread.y;
      } else {
        return;
      }

      // Pan to center on the thread/card
      setCenter(focusX, focusY, { zoom: 1, duration: 300 });

      // Set focused thread shortly after pan starts to trigger expansion
      setTimeout(() => {
        setFocusedThread(threadId);
      }, 150);
    },
    [threads, cards, setCenter, setFocusedThread],
  );

  // Sync threads to nodes
  useEffect(() => {
    if (!visitorId || isDragging) return;

    // Filter threads based on resolved state
    const filteredThreads = showResolvedThreads
      ? threads
      : threads.filter((t) => !t.isResolved);

    setThreadNodes(
      threadsToNodes(
        filteredThreads,
        userRole,
        visitorId,
        session.isLocked,
        {
          onAddComment: handleAddCommentToThread,
          onDeleteComment: handleDeleteCommentFromThread,
          onResolve: handleResolveThread,
          onDeleteThread: handleDeleteThread,
        },
        boardContainerRef.current,
      ),
    );
  }, [
    threads,
    userRole,
    visitorId,
    session.isLocked,
    isDragging,
    showResolvedThreads,
    handleAddCommentToThread,
    handleDeleteCommentFromThread,
    handleResolveThread,
    handleDeleteThread,
  ]);

  // Set up node callbacks
  useEffect(() => {
    setIdeaCardNodeCallbacks({
      onType: typeCard,
      onChangeColor: changeColor,
      onDelete: removeCard,
      onVote: async (id: string) => {
        if (!visitorId) return;

        // Use ref to access current cards without adding to dependencies
        const card = cardsRef.current.find((c) => c.id === id);
        if (!card) return;

        if (card.createdById === visitorId) return;

        const hasVoted = card.votedBy?.includes(visitorId) || false;
        const newVotes = hasVoted ? card.votes - 1 : card.votes + 1;
        const newVotedBy = hasVoted
          ? (card.votedBy || []).filter((v) => v !== visitorId)
          : [...(card.votedBy || []), visitorId];

        voteCard(id, newVotes, newVotedBy);
        await voteCardAction(id, visitorId);
      },
      onReact: async (id: string, emoji: string) => {
        if (!visitorId) return;

        // Use ref to access current cards without adding to dependencies
        const card = cardsRef.current.find((c) => c.id === id);
        if (!card) return;

        if (card.createdById === visitorId) return;

        const currentReactions = card.reactions || {};
        const usersForEmoji = currentReactions[emoji] || [];
        const hasReacted = usersForEmoji.includes(visitorId);

        const newUsersForEmoji = hasReacted
          ? usersForEmoji.filter((u) => u !== visitorId)
          : [...usersForEmoji, visitorId];

        const newReactions = { ...currentReactions };
        if (newUsersForEmoji.length === 0) {
          delete newReactions[emoji];
        } else {
          newReactions[emoji] = newUsersForEmoji;
        }

        reactCard(id, newReactions);
        await toggleReaction(id, emoji, visitorId);
      },
      onPersistContent: async (id: string, content: TiptapContent) => {
        if (!visitorId) return;
        const { card: updatedCard } = await updateCard(
          id,
          { content },
          visitorId,
        );
        if (updatedCard) {
          // Invalidate local editors cache so the UI updates with new edit history
          invalidateCardEditors(id);
          // Broadcast to other clients so they also refetch editors
          broadcastEditorsChanged(id);
        }
      },
      onPersistColor: async (id: string, color: string) => {
        if (!visitorId) return;
        await updateCard(id, { color }, visitorId);
      },
      onPersistDelete: async (id: string) => {
        if (!visitorId) return;
        await deleteCard(id, visitorId);
      },
      onDuplicate: (cardId: string) => {
        // Use ref to access current cards without adding to dependencies
        const card = cardsRef.current.find((c) => c.id === cardId);
        if (card && handleDuplicateCardRef.current) {
          handleDuplicateCardRef.current(card);
        }
      },
      onFocused: (id: string) => {
        if (id === newCardId) {
          setNewCardId(null);
        }
      },
      onResize: (id: string, width: number, height: number) => {
        realtimeResizeCard(id, width, height);
      },
      onPersistResize: async (id: string, width: number, height: number) => {
        if (!visitorId) return;
        await resizeCard(id, width, height, sessionId, visitorId);
      },
      onAddThread: (cardId: string) => {
        handleAddThreadToCardRef.current?.(cardId);
      },
    });
  }, [
    visitorId,
    typeCard,
    changeColor,
    removeCard,
    voteCard,
    reactCard,
    newCardId,
    realtimeResizeCard,
    sessionId,
    invalidateCardEditors,
    broadcastEditorsChanged,
  ]);

  // Handle node position changes from drag - let React Flow manage positions
  const handleNodesChange: OnNodesChange<IdeaCardNodeType | ThreadNodeType> =
    useCallback((changes: NodeChange<IdeaCardNodeType | ThreadNodeType>[]) => {
      // Separate changes for card nodes and thread nodes
      const cardChanges = changes.filter(
        (c) => !("id" in c) || !c.id.startsWith("thread-"),
      ) as NodeChange<IdeaCardNodeType>[];
      const threadChanges = changes.filter(
        (c) => "id" in c && c.id.startsWith("thread-"),
      ) as NodeChange<ThreadNodeType>[];

      if (cardChanges.length > 0) {
        setCardNodes(
          (nds) => applyNodeChanges(cardChanges, nds) as IdeaCardNodeType[],
        );
      }
      if (threadChanges.length > 0) {
        setThreadNodes(
          (nds) => applyNodeChanges(threadChanges, nds) as ThreadNodeType[],
        );
      }
    }, []);

  // Handle drag start - prevent cards sync during drag
  const handleNodeDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  // Handle drag to show magnetic attachment feedback
  const handleNodeDrag = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Only process thread nodes
      if (!node.id.startsWith("thread-")) {
        setMagneticTargetCardId(null);
        return;
      }

      const threadId = node.id.replace("thread-", "");
      const thread = threads.find((t) => t.id === threadId);

      // Only show magnetic feedback for canvas threads (not already attached)
      if (!thread || thread.cardId) {
        setMagneticTargetCardId(null);
        return;
      }

      // Calculate thread bubble center position
      const bubbleCenter = getThreadBubbleCenter(node.position);

      // Check if over a card
      const targetCard = findCardAtPoint(bubbleCenter, cards);
      setMagneticTargetCardId(targetCard?.id ?? null);
    },
    [threads, cards],
  );

  // Handle drag end - sync to cards state and persist to database
  const handleNodeDragStop = useCallback(
    async (_event: React.MouseEvent, _node: Node, draggedNodes: Node[]) => {
      if (!visitorId) {
        setIsDragging(false);
        return;
      }

      // Separate card nodes from thread nodes
      const cardNodes = draggedNodes.filter((n) => !n.id.startsWith("thread-"));
      const threadNodesArr = draggedNodes.filter((n) =>
        n.id.startsWith("thread-"),
      );

      // Handle card nodes
      if (cardNodes.length > 0) {
        const positions = cardNodes.map((n) => ({
          id: n.id,
          x: n.position.x,
          y: n.position.y,
        }));

        // Update cards state + broadcast in ONE operation
        batchMoveCards(positions);

        // Persist cards to database
        await Promise.all(
          positions.map((pos) =>
            updateCard(pos.id, { x: pos.x, y: pos.y }, visitorId),
          ),
        );
      }

      // Handle thread nodes
      if (threadNodesArr.length > 0) {
        for (const node of threadNodesArr) {
          const threadId = node.id.replace("thread-", "");
          const thread = threads.find((t) => t.id === threadId);

          // Only process canvas threads (not already card-attached)
          if (thread && !thread.cardId) {
            // Calculate thread bubble center position
            const bubbleCenter = getThreadBubbleCenter(node.position);

            // Check if dropped over a card
            const targetCard = findCardAtPoint(bubbleCenter, cards);

            if (targetCard) {
              // Magnetic attach!
              attachThread(threadId, targetCard.id);
              await attachThreadToCardAction(
                threadId,
                targetCard.id,
                visitorId,
              );
            } else {
              // Normal position update
              moveThread(threadId, node.position.x, node.position.y);
              await moveThreadAction(
                threadId,
                node.position.x,
                node.position.y,
                visitorId,
              );
            }
          }
        }
      }

      // Re-enable cards sync AFTER state is updated
      setIsDragging(false);
      setMagneticTargetCardId(null);
    },
    [visitorId, batchMoveCards, moveThread, threads, cards, attachThread],
  );

  // Handle selection changes
  const handleSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes }: { nodes: Node[] }) => {
      setSelectedCardIds(new Set(selectedNodes.map((n: Node) => n.id)));
    },
    [],
  );

  // Track viewport changes for zoom display
  const handleMoveEnd = useCallback(
    (_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
      setZoom(viewport.zoom);
    },
    [],
  );

  // Fit all cards in view
  const fitAllCards = useCallback(() => {
    if (cards.length === 0) {
      setViewport({ x: 0, y: 0, zoom: 1 });
      return;
    }

    fitView({ padding: 0.2 });
  }, [cards.length, fitView, setViewport]);

  // Initialize view centered on cards on first load
  useEffect(() => {
    if (hasInitializedViewRef.current) return;
    if (!isReactFlowReady) return; // Wait for React Flow to be ready
    if (nodes.length === 0) return; // Wait for nodes to be synced

    hasInitializedViewRef.current = true;

    const isMobile = window.innerWidth < 640;
    const bounds = calculateCardsBounds(cards, isMobile);
    if (!bounds) return;

    // Center on cards at 100% zoom
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    // Calculate viewport offset to center on cards
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;

    setViewport({
      x: viewportCenterX - centerX,
      y: viewportCenterY - centerY,
      zoom: 1,
    });
  }, [cards, nodes.length, isReactFlowReady, setViewport]);

  // Keyboard shortcut for fit all (key "1")
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "1" && !e.metaKey && !e.ctrlKey) {
        fitAllCards();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fitAllCards]);

  const getRandomColor = useCallback(() => {
    const colors = resolvedTheme === "dark" ? DARK_COLORS : LIGHT_COLORS;
    return colors[Math.floor(Math.random() * colors.length)];
  }, [resolvedTheme]);

  const handleAddCard = useCallback(async () => {
    if (!username || !visitorId) return;

    // Check if session allows adding cards
    if (!canAddCard(session, userRole ?? "participant")) return;

    playSound();

    const isMobile = window.innerWidth < 640;
    const cardWidth = isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH;
    const cardHeight = isMobile ? CARD_HEIGHT_MOBILE : CARD_HEIGHT;

    const isFirstCard = cards.length === 0;

    let x: number;
    let y: number;

    if (isFirstCard) {
      x = -cardWidth / 2;
      y = -cardHeight / 2;
    } else {
      // Get center of current viewport in flow coordinates
      const flowCenter = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      const offsetRange = 100;
      x =
        flowCenter.x -
        cardWidth / 2 +
        (Math.random() * offsetRange * 2 - offsetRange);
      y =
        flowCenter.y -
        cardHeight / 2 +
        (Math.random() * offsetRange * 2 - offsetRange);
    }

    const cardId = generateCardId();
    const newCard: Card = {
      id: cardId,
      sessionId,
      content: DEFAULT_TIPTAP_CONTENT,
      color: getRandomColor(),
      x,
      y,
      width: DEFAULT_CARD_WIDTH,
      height: DEFAULT_CARD_HEIGHT,
      votes: 0,
      votedBy: [],
      reactions: {},
      embedding: null,
      createdById: visitorId,
      updatedAt: new Date(),
    };

    if (isFirstCard) {
      // Center viewport on the new card
      setViewport({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        zoom: 1,
      });
    }

    setNewCardId(cardId);
    addCard(newCard);
    await createCard(newCard, visitorId);
  }, [
    username,
    visitorId,
    session,
    userRole,
    playSound,
    screenToFlowPosition,
    sessionId,
    getRandomColor,
    addCard,
    cards.length,
    setViewport,
  ]);

  // State for new thread creation
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [pendingThreadPosition, setPendingThreadPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  // Screen position for the creation panel
  const [createPanelScreenPosition, setCreatePanelScreenPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  // For card-attached threads
  const [pendingCardThreadId, setPendingCardThreadId] = useState<string | null>(
    null,
  );

  const handleAddThread = useCallback(() => {
    if (!visitorId || isLocked) return;

    // Get center of current viewport in screen coordinates
    const screenCenter = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };

    // Convert to flow coordinates for the thread position
    const flowCenter = screenToFlowPosition(screenCenter);

    // Set both flow position (for DB) and screen position (for panel)
    setPendingThreadPosition({
      x: flowCenter.x,
      y: flowCenter.y,
    });
    setCreatePanelScreenPosition(screenCenter);
    setIsCreatingThread(true);
  }, [visitorId, isLocked, screenToFlowPosition]);

  const handleCreateThreadWithComment = useCallback(
    async (initialComment: string, cardId?: string) => {
      if (!visitorId) return;

      // Determine if this is a card-attached thread or canvas thread
      const targetCardId = cardId || pendingCardThreadId;

      // For canvas threads, we need a position
      if (!targetCardId && !pendingThreadPosition) return;

      const { thread, error } = await createThreadAction(
        {
          sessionId,
          // Either use cardId or position
          ...(targetCardId
            ? { cardId: targetCardId }
            : {
                x: pendingThreadPosition?.x ?? 0,
                y: pendingThreadPosition?.y ?? 0,
              }),
          initialComment,
        },
        visitorId,
      );

      if (error || !thread) {
        console.error("Failed to create thread:", error);
        return;
      }

      addThread(thread);
      setIsCreatingThread(false);
      setPendingThreadPosition(null);
      setPendingCardThreadId(null);
      setCreatePanelScreenPosition(null);

      // Auto-expand the newly created thread so it shows as ThreadPanel
      setFocusedThread(thread.id);
    },
    [
      visitorId,
      sessionId,
      pendingThreadPosition,
      pendingCardThreadId,
      addThread,
      setFocusedThread,
    ],
  );

  const handleCancelThreadCreation = useCallback(() => {
    setIsCreatingThread(false);
    setPendingThreadPosition(null);
    setPendingCardThreadId(null);
    setCreatePanelScreenPosition(null);
  }, []);

  // Handle adding thread to a specific card (from card context menu)
  const handleAddThreadToCard = useCallback(
    (cardId: string) => {
      if (!visitorId || isLocked) return;

      // Find the card to get its position
      const card = cards.find((c) => c.id === cardId);
      if (card) {
        // Convert card position to screen coordinates
        // Position the panel at the bottom-right of the card
        const screenPos = flowToScreenPosition({
          x: card.x + (card.width ?? DEFAULT_CARD_WIDTH),
          y: card.y + (card.height ?? DEFAULT_CARD_HEIGHT) / 2,
        });
        setCreatePanelScreenPosition(screenPos);
      } else {
        // Fallback to center of screen
        setCreatePanelScreenPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
      }

      setPendingCardThreadId(cardId);
      setIsCreatingThread(true);
    },
    [visitorId, isLocked, cards, flowToScreenPosition],
  );

  // Handle adding thread from context menu (at specific position)
  const handleAddThreadAtPosition = useCallback(() => {
    if (!visitorId || isLocked || !contextMenuPosition) return;

    // Convert screen position to flow coordinates
    const flowPosition = screenToFlowPosition(contextMenuPosition);

    setPendingThreadPosition({
      x: flowPosition.x,
      y: flowPosition.y,
    });
    // Store screen position for the panel before clearing context menu
    setCreatePanelScreenPosition(contextMenuPosition);
    setIsCreatingThread(true);
    setContextMenuPosition(null);
    setBoardMenuOpen(false);
  }, [visitorId, isLocked, contextMenuPosition, screenToFlowPosition]);

  // Handle adding card at cursor position (for keyboard shortcut)
  const handleAddCardAtCursor = useCallback(async () => {
    if (!username || !visitorId) return;
    if (!canAddCard(session, userRole ?? "participant")) return;

    playSound();

    // Use mouse position if available, otherwise fall back to viewport center
    const screenPosition = mousePositionRef.current ?? {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };

    // Convert screen position to flow coordinates
    const flowPosition = screenToFlowPosition(screenPosition);

    // Position card at exact cursor position (top-left corner)
    const x = flowPosition.x;
    const y = flowPosition.y;

    const cardId = generateCardId();
    const newCard: Card = {
      id: cardId,
      sessionId,
      content: DEFAULT_TIPTAP_CONTENT,
      color: getRandomColor(),
      x,
      y,
      width: DEFAULT_CARD_WIDTH,
      height: DEFAULT_CARD_HEIGHT,
      votes: 0,
      votedBy: [],
      reactions: {},
      embedding: null,
      createdById: visitorId,
      updatedAt: new Date(),
    };

    setNewCardId(cardId);
    addCard(newCard);
    await createCard(newCard, visitorId);
  }, [
    username,
    visitorId,
    session,
    userRole,
    playSound,
    screenToFlowPosition,
    sessionId,
    getRandomColor,
    addCard,
  ]);

  // Handle adding thread at cursor position (for keyboard shortcut)
  const handleAddThreadAtCursor = useCallback(() => {
    if (!visitorId || isLocked) return;

    // Use mouse position if available, otherwise fall back to viewport center
    const screenPosition = mousePositionRef.current ?? {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };

    // Convert screen position to flow coordinates
    const flowPosition = screenToFlowPosition(screenPosition);

    setPendingThreadPosition({
      x: flowPosition.x,
      y: flowPosition.y,
    });
    // Store screen position for the panel
    setCreatePanelScreenPosition(screenPosition);
    setIsCreatingThread(true);
  }, [visitorId, isLocked, screenToFlowPosition]);

  // Handle pane right-click (empty space on the board)
  const handlePaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      setContextMenuPosition({ x: event.clientX, y: event.clientY });
      setBoardMenuOpen(true);
    },
    [],
  );

  // Handle adding card from context menu (at specific position)
  const handleAddCardAtPosition = useCallback(async () => {
    if (!username || !visitorId || !contextMenuPosition) return;
    if (!canAddCard(session, userRole ?? "participant")) return;

    playSound();

    // Convert screen position to flow coordinates
    const flowPosition = screenToFlowPosition(contextMenuPosition);

    // Position card at exact cursor position (top-left corner)
    const x = flowPosition.x;
    const y = flowPosition.y;

    const cardId = generateCardId();
    const newCard: Card = {
      id: cardId,
      sessionId,
      content: DEFAULT_TIPTAP_CONTENT,
      color: getRandomColor(),
      x,
      y,
      width: DEFAULT_CARD_WIDTH,
      height: DEFAULT_CARD_HEIGHT,
      votes: 0,
      votedBy: [],
      reactions: {},
      embedding: null,
      createdById: visitorId,
      updatedAt: new Date(),
    };

    setNewCardId(cardId);
    addCard(newCard);
    setContextMenuPosition(null);
    setBoardMenuOpen(false);
    await createCard(newCard, visitorId);
  }, [
    username,
    visitorId,
    contextMenuPosition,
    session,
    userRole,
    playSound,
    screenToFlowPosition,
    sessionId,
    getRandomColor,
    addCard,
  ]);

  const handleDuplicateCard = useCallback(
    async (card: Card) => {
      if (!username || !visitorId) return;

      // Check if session allows adding cards
      if (!canAddCard(session, userRole ?? "participant")) return;

      playSound();

      const isMobile = window.innerWidth < 640;
      const cardWidth = isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH;
      const cardHeight = isMobile ? CARD_HEIGHT_MOBILE : CARD_HEIGHT;

      // Try different offsets to find a free position
      const offsets = [
        { x: 30, y: 30 },
        { x: -30, y: 30 },
        { x: 30, y: -30 },
        { x: -30, y: -30 },
        { x: 60, y: 0 },
        { x: -60, y: 0 },
        { x: 0, y: 60 },
        { x: 0, y: -60 },
      ];

      let x = card.x + 30;
      let y = card.y + 30;

      // Find a position without collision
      for (const offset of offsets) {
        const testX = card.x + offset.x;
        const testY = card.y + offset.y;

        // Check if any card is too close (simple collision detection)
        const hasCollision = cards.some((c) => {
          if (c.id === card.id) return false;
          const dx = Math.abs(c.x - testX);
          const dy = Math.abs(c.y - testY);
          return dx < cardWidth * 0.8 && dy < cardHeight * 0.8;
        });

        if (!hasCollision) {
          x = testX;
          y = testY;
          break;
        }
      }

      const cardId = generateCardId();
      const width = Math.max(
        150,
        Math.min(600, Math.round(Number(card.width) || DEFAULT_CARD_WIDTH)),
      );
      const height = Math.max(
        100,
        Math.min(400, Math.round(Number(card.height) || DEFAULT_CARD_HEIGHT)),
      );

      const newCard: Card = {
        id: cardId,
        sessionId,
        content: card.content,
        color: card.color,
        x,
        y,
        width,
        height,
        votes: 0,
        votedBy: [],
        reactions: {},
        embedding: null,
        createdById: visitorId,
        updatedAt: new Date(),
      };

      setNewCardId(cardId);
      addCard(newCard);

      try {
        const result = await createCard(newCard, visitorId);
        if (result.error) {
          console.error("Failed to duplicate card:", result.error);
          removeCard(cardId);
        }
      } catch (error) {
        console.error("Error duplicating card:", error);
        removeCard(cardId);
      }
    },
    [
      username,
      visitorId,
      session,
      userRole,
      playSound,
      sessionId,
      addCard,
      cards,
      removeCard,
    ],
  );

  // Keep refs updated with latest callbacks
  useEffect(() => {
    handleDuplicateCardRef.current = handleDuplicateCard;
    handleAddThreadToCardRef.current = handleAddThreadToCard;
  }, [handleDuplicateCard, handleAddThreadToCard]);

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      const timeoutId = setTimeout(() => {
        if (mountedRef.current) setCopied(false);
      }, 2000);
      return () => clearTimeout(timeoutId);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  }, []);

  const handleUpdateUsername = async (newUsername: string) => {
    const result = await updateUsername(newUsername);
    if (result.success && visitorId) {
      // Broadcast name change to other participants
      broadcastNameChange(visitorId, newUsername.trim());
      // Update local participants map
      handleRemoteNameChange(visitorId, newUsername.trim());
    }
    return result;
  };

  const handleUpdateSessionName = async (newName: string) => {
    if (!visitorId) return { success: false, error: "Not logged in" };

    const { session: updatedSession, error } = await updateSessionName(
      sessionId,
      newName,
      visitorId,
    );
    if (updatedSession && !error) {
      // Update local state (check mounted to avoid memory leak)
      if (mountedRef.current) {
        setSession((prev) => ({ ...prev, name: updatedSession.name }));
      }
      // Broadcast to other participants
      broadcastSessionRename(updatedSession.name);
      return { success: true };
    }
    return { success: false, error: error ?? "Failed to update session name" };
  };

  const handleUpdateSessionSettings = async (settings: {
    isLocked?: boolean;
  }) => {
    if (!visitorId) return { success: false, error: "Not logged in" };

    const { session: updatedSession, error } = await updateSessionSettings(
      sessionId,
      settings,
      visitorId,
    );
    if (updatedSession && !error) {
      // Update local state (check mounted to avoid memory leak)
      if (mountedRef.current) {
        setSession(updatedSession);
      }
      // Broadcast to other participants
      broadcastSessionSettings({
        isLocked: updatedSession.isLocked,
      });
      return { success: true };
    }
    return { success: false, error: error ?? "Failed to update settings" };
  };

  const handleToggleLock = async () => {
    const result = await handleUpdateSessionSettings({ isLocked: !isLocked });
    return result;
  };

  const handleDeleteSession = async () => {
    if (!visitorId) return { success: false, error: "Not logged in" };

    const { success, error } = await deleteSession(sessionId, visitorId);
    if (success) {
      router.push("/");
      return { success: true };
    }
    return { success: false, error: error ?? "Failed to delete session" };
  };

  const handleCleanupEmptyCards = async () => {
    if (!visitorId)
      return { success: false, deletedCount: 0, error: "Not logged in" };

    const { deletedIds, deletedCount, error } = await deleteEmptyCards(
      sessionId,
      visitorId,
    );

    if (error) {
      return { success: false, deletedCount: 0, error };
    }

    // Remove cards locally and broadcast deletions
    deletedIds.forEach((id) => {
      removeCard(id);
    });

    return { success: true, deletedCount };
  };

  // Handle cluster cards callback
  const handleClusterCards = useCallback(
    (positions: Array<{ id: string; x: number; y: number }>) => {
      // Apply positions locally (this triggers animation)
      applyClusterPositions(positions);
      // Broadcast to other participants
      broadcastClusterPositions(positions);
    },
    [applyClusterPositions, broadcastClusterPositions],
  );

  const handleCopyCard = useCallback(async (card: Card) => {
    const cardData = {
      type: "pawboard-card",
      content: card.content,
      color: card.color,
    };

    try {
      // Save to system clipboard as JSON
      await navigator.clipboard.writeText(JSON.stringify(cardData));
    } catch (error) {
      // Clipboard API may not be available or blocked
      console.warn("Failed to write to clipboard:", error);
    }

    // Always save to memory as fallback
    const clipboardData = {
      content: card.content,
      color: card.color,
      width: card.width,
      height: card.height,
    };
    setCopiedCard(clipboardData);

    // Persist to sessionStorage
    try {
      sessionStorage.setItem(
        "pawboard_clipboard",
        JSON.stringify(clipboardData),
      );
    } catch (error) {
      // sessionStorage may be full or blocked
      console.warn("Failed to save to sessionStorage:", error);
    }

    setSelectedCardIds(new Set([card.id]));
  }, []);

  const handlePasteCard = useCallback(async () => {
    if (!username || !visitorId) return;
    if (!canAddCard(session, userRole ?? "participant")) return;

    let cardData = copiedCard;

    // Try to read from system clipboard first
    try {
      const clipboardText = await navigator.clipboard.readText();
      const parsed = JSON.parse(clipboardText);
      if (parsed.type === "pawboard-card") {
        // Content from clipboard may be in old string format or new TiptapContent format
        const content =
          typeof parsed.content === "string"
            ? createTiptapContent(parsed.content)
            : (parsed.content as TiptapContent);
        cardData = {
          content,
          color: parsed.color,
          width: parsed.width || DEFAULT_CARD_WIDTH,
          height: parsed.height || DEFAULT_CARD_HEIGHT,
        };
      }
    } catch (error) {
      // Use memory fallback if clipboard read fails
      console.warn("Failed to read from clipboard, using fallback:", error);
    }

    if (!cardData) return;

    playSound();

    const isMobile = window.innerWidth < 640;
    const cardWidth = isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH;
    const cardHeight = isMobile ? CARD_HEIGHT_MOBILE : CARD_HEIGHT;

    // Position at mouse cursor if available, otherwise at screen center
    const pastePosition = mousePositionRef.current
      ? screenToFlowPosition(mousePositionRef.current)
      : screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });

    const x = pastePosition.x - cardWidth / 2;
    const y = pastePosition.y - cardHeight / 2;

    const cardId = generateCardId();
    const newCard: Card = {
      id: cardId,
      sessionId,
      content: cardData.content,
      color: cardData.color,
      x,
      y,
      width: cardData.width || DEFAULT_CARD_WIDTH,
      height: cardData.height || DEFAULT_CARD_HEIGHT,
      votes: 0,
      votedBy: [],
      reactions: {},
      embedding: null,
      createdById: visitorId,
      updatedAt: new Date(),
    };

    setNewCardId(cardId);
    addCard(newCard);

    try {
      const result = await createCard(newCard, visitorId);
      if (result.error) {
        console.error("Failed to paste card:", result.error);
        // Remove from local state if server creation failed
        removeCard(cardId);
      }
    } catch (error) {
      console.error("Error pasting card:", error);
      removeCard(cardId);
    }
  }, [
    copiedCard,
    username,
    visitorId,
    session,
    userRole,
    playSound,
    screenToFlowPosition,
    sessionId,
    addCard,
    removeCard,
  ]);

  // Keyboard shortcuts for new card (key "N"), copy (Ctrl+C), and paste (Ctrl+V)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input, textarea, or contenteditable element
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      // Skip if command menu is open
      if (commandOpen) {
        return;
      }

      // Ctrl+C or Cmd+C to copy selected card (first selected if multiple)
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        if (selectedCardIds.size > 0) {
          const firstSelectedId = selectedCardIds.values().next().value;
          const card = cards.find((c) => c.id === firstSelectedId);
          if (card) {
            e.preventDefault();
            handleCopyCard(card);
          }
        }
        return;
      }

      // Ctrl+V or Cmd+V to paste card
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        if (copiedCard) {
          e.preventDefault();
          handlePasteCard();
        }
        return;
      }

      // "N" to create a new card at cursor position
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handleAddCardAtCursor();
      }

      // "C" to create a comment thread at cursor position
      if (e.key === "c" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handleAddThreadAtCursor();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    commandOpen,
    handleAddCardAtCursor,
    handleAddThreadAtCursor,
    selectedCardIds,
    cards,
    handleCopyCard,
    copiedCard,
    handlePasteCard,
  ]);

  // Minimap node color function
  const minimapNodeColor = useCallback((node: Node) => {
    const data = node.data as { card?: Card };
    return data.card?.color || "#fef08a";
  }, []);

  // screenToWorld function for cursor rendering
  const screenToWorld = useCallback(
    (screen: { x: number; y: number }) => {
      return screenToFlowPosition(screen);
    },
    [screenToFlowPosition],
  );

  if (!username || isFingerprintLoading || isUsernameLoading || !visitorId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Main content area */}
      <div
        ref={boardContainerRef}
        className="flex-1 min-h-screen overflow-hidden relative"
      >
        <CommandMenu
          open={commandOpen}
          onOpenChange={setCommandOpen}
          onAddCard={handleAddCard}
          onAddThread={handleAddThread}
          onShare={handleShare}
          onChangeName={() => setEditNameOpen(true)}
          isSessionCreator={isSessionCreator}
          isLocked={isLocked}
          onToggleLock={handleToggleLock}
          onDeleteSession={() => setDeleteSessionDialogOpen(true)}
          onClusterCards={() => setClusterDialogOpen(true)}
          onCleanupEmptyCards={handleCleanupEmptyCards}
          onEditBoardName={() => setEditSessionNameOpen(true)}
        />

        {/* Cluster Cards Dialog (controlled by command menu) */}
        <ClusterCardsDialog
          cards={cards}
          sessionId={sessionId}
          userId={visitorId || ""}
          onCluster={handleClusterCards}
          open={clusterDialogOpen}
          onOpenChange={setClusterDialogOpen}
        />

        {/* Create Thread Inline Panel */}
        {isCreatingThread && createPanelScreenPosition && (
          <div
            className="fixed z-[100]"
            style={{
              // Position panel to the right of where the bubble will be
              // Bubble is 40px wide, centered at click position
              // So bubble right edge is at clickX + 20px
              // Panel left edge: clickX + 20px (bubble half-width) + 12px (sideOffset)
              left: createPanelScreenPosition.x + 32,
              // Top-aligned with bubble top
              // Bubble is 40px tall, centered at clickY
              // So bubble top is at clickY - 20px
              top: createPanelScreenPosition.y - 20,
            }}
          >
            <CreateThreadPanel
              onSubmit={handleCreateThreadWithComment}
              onCancel={handleCancelThreadCreation}
              isCardThread={!!pendingCardThreadId}
            />
          </div>
        )}

        {/* Edit Username Dialog - controlled by command menu */}
        <EditNameDialog
          currentName={username}
          onSave={handleUpdateUsername}
          open={editNameOpen}
          onOpenChange={setEditNameOpen}
        />

        {/* Edit Session Name Dialog */}
        <EditNameDialog
          currentName={session.name}
          onSave={handleUpdateSessionName}
          open={editSessionNameOpen}
          onOpenChange={setEditSessionNameOpen}
          title="Edit board name"
          description="This name will be visible to all participants."
          placeholder="Enter board name"
          maxLength={50}
        />

        {/* Delete Session Confirmation Dialog */}
        <AlertDialog
          open={deleteSessionDialogOpen}
          onOpenChange={setDeleteSessionDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete session?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this session and all its cards.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteSession}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* AI Chat Trigger Button */}
        <ChatTrigger />

        {/* Fixed UI - Top Left */}
        <div className="fixed top-2 sm:top-4 left-2 sm:left-4 z-50 flex items-center gap-1.5 sm:gap-3">
          <Link href="/">
            <Button
              variant="outline"
              size="icon"
              className="bg-card/80 backdrop-blur-sm h-8 w-8 sm:h-9 sm:w-9"
            >
              <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Button>
          </Link>
          {/* User badge - compact on mobile, full on desktop */}
          <EditNameDialog
            currentName={username}
            onSave={handleUpdateUsername}
            trigger={
              <UserBadge
                username={username}
                avatar={getAvatarForUser(visitorId)}
                editable
                compact
              />
            }
          />
        </div>

        {/* Fixed UI - Top Center: Session Name + Lock Indicator */}
        <div className="fixed top-2 sm:top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
          {isLocked && (
            <div
              className="flex items-center gap-1.5 bg-destructive/10 text-destructive px-2.5 h-8 sm:h-9 rounded-lg border border-destructive/20"
              title="Session is locked"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="text-xs font-medium hidden sm:inline">
                Locked
              </span>
            </div>
          )}
          {isSessionCreator ? (
            <button
              type="button"
              onClick={() => setEditSessionNameOpen(true)}
              className="group flex items-center gap-2 bg-card/80 backdrop-blur-sm px-3 sm:px-4 h-8 sm:h-9 rounded-lg border border-border shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 transition-all cursor-pointer max-w-30 sm:max-w-xs"
              title="Click to rename board"
            >
              <span className="text-sm font-medium truncate">
                {session.name}
              </span>
              <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0 hidden sm:block" />
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-card/80 backdrop-blur-sm px-3 sm:px-4 h-8 sm:h-9 rounded-lg border border-border shadow-xs max-w-30 sm:max-w-xs">
              <span className="text-sm font-medium truncate">
                {session.name}
              </span>
            </div>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={handleShare}
            title={copied ? "Copied!" : "Share"}
          >
            {copied ? (
              <Check className="w-4 h-4 text-sky-500" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Fixed UI - Top Right: Command Menu */}
        <div
          className={cn(
            "fixed top-2 sm:top-4 right-2 sm:right-4 z-50 flex items-center gap-2 transition-[right] duration-300",
            isSidebarOpen && "sm:right-[396px]",
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="bg-card/80 backdrop-blur-sm h-8 w-8 sm:h-9 sm:w-9"
                onClick={() => setCommandOpen(true)}
              >
                <Command className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Command menu (⌘K)</TooltipContent>
          </Tooltip>
        </div>

        {/* FixeUI - Bottom Left: Zoom Controls */}
        <div className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-50">
          <div className="flex items-center gap-1 bg-card/80 backdrop-blur-sm rounded-lg border border-border px-1 py-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => zoomOut()}
              className="h-7 w-7 sm:h-8 sm:w-8"
              title="Zoom out (⌘-)"
            >
              <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Button>
            <span className="text-xs sm:text-sm font-mono w-10 sm:w-12 text-center text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => zoomIn()}
              className="h-7 w-7 sm:h-8 sm:w-8"
              title="Zoom in (⌘+)"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Button>
            <div className="w-px h-5 bg-border mx-1" />
            <Button
              variant="ghost"
              size="icon"
              onClick={fitAllCards}
              className="h-7 w-7 sm:h-8 sm:w-8"
              title="Fit all cards (1)"
            >
              <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Button>
          </div>
        </div>

        {/* React Flow Canvas */}
        <div className="h-full w-full">
          <ReactFlow
            nodes={nodes}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
            onNodeDragStart={handleNodeDragStart}
            onNodeDrag={handleNodeDrag}
            onNodeDragStop={handleNodeDragStop}
            onSelectionChange={handleSelectionChange}
            onMoveEnd={handleMoveEnd}
            onInit={() => setIsReactFlowReady(true)}
            onPaneContextMenu={handlePaneContextMenu}
            panOnScroll
            selectionOnDrag={!isMobile}
            panOnDrag={isMobile ? true : [1, 2]}
            selectionMode={SelectionMode.Partial}
            selectNodesOnDrag={!isMobile}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            fitViewOptions={{ padding: 0.2 }}
            className="bg-background"
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="hsl(var(--muted-foreground) / 0.2)"
            />

            {/* Minimap (Desktop Only) */}
            {viewportSize.width >= 640 && (
              <MiniMap
                nodeColor={minimapNodeColor}
                nodeStrokeWidth={3}
                pannable
                zoomable
                className="!absolute !top-[60px] !right-4 !bottom-auto !left-auto !bg-card/80 backdrop-blur-sm !border !border-border !rounded-lg transition-all duration-300"
                style={{
                  width: 160,
                  height: 120,
                }}
              />
            )}

            {/* Cursors - rendered in screen space */}
            <div
              className="absolute inset-0 pointer-events-none overflow-hidden"
              style={{ zIndex: 1000 }}
            >
              <RealtimeCursors
                roomName={`session:${sessionId}`}
                username={username}
                screenToWorld={screenToWorld}
                worldToScreen={flowToScreenPosition}
              />
            </div>

            {/* Empty state - stays centered in viewport */}
            {cards.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 opacity-20">
                    <Image
                      src={
                        visitorId
                          ? getAvatarForUser(visitorId)
                          : "/cat-purple.svg"
                      }
                      alt=""
                      width={64}
                      height={64}
                      className="w-full h-full"
                    />
                  </div>
                  <p className="text-lg text-muted-foreground mb-1">
                    Your board is empty
                  </p>
                  <p className="text-sm text-muted-foreground/70 mb-4">
                    Drop your first idea and watch it grow
                  </p>
                  <button
                    type="button"
                    onClick={handleAddCard}
                    disabled={isLocked}
                    className="pointer-events-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                    Add first idea
                  </button>
                  <p className="text-xs text-muted-foreground/50 mt-3">
                    or press{" "}
                    <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">
                      N
                    </kbd>
                  </p>
                </div>
              </div>
            )}
          </ReactFlow>
        </div>

        {/* Board context menu (custom positioned) */}
        {boardMenuOpen && contextMenuPosition && (
          <>
            {/* Backdrop to close menu when clicking outside */}
            <button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-50 cursor-default"
              onClick={() => setBoardMenuOpen(false)}
              onContextMenu={(e) => {
                e.preventDefault();
                setBoardMenuOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setBoardMenuOpen(false);
              }}
            />
            <div
              role="menu"
              className="fixed z-50 bg-popover text-popover-foreground rounded-md border p-1 shadow-md min-w-[180px] animate-in fade-in-0 zoom-in-95"
              style={{
                left: contextMenuPosition.x,
                top: contextMenuPosition.y,
              }}
            >
              <button
                type="button"
                role="menuitem"
                className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 text-left"
                onClick={handleAddCardAtPosition}
                disabled={isLocked}
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span>Add idea card</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 text-left"
                onClick={handleAddThreadAtPosition}
                disabled={isLocked}
              >
                <MessageSquarePlus className="h-4 w-4 shrink-0" />
                <span>Add comment thread</span>
              </button>
            </div>
          </>
        )}
      </div>
      <ChatPanel
        sessionId={sessionId}
        userId={visitorId}
        threads={threads}
        onThreadClick={handleFocusThread}
        participants={participantsWithCurrentUser}
        onlineUsers={onlineUsers}
      />
    </div>
  );
}

export function ReactFlowBoard(props: ReactFlowBoardProps) {
  return (
    <ReactFlowProvider>
      <ReactFlowBoardInner {...props} />
    </ReactFlowProvider>
  );
}
