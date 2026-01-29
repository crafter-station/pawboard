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
  Copy,
  Home,
  Lock,
  Maximize2,
  Menu,
  Minus,
  Pencil,
  Plus,
  Settings,
  Share2,
  Sparkles,
  Trash,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createCard,
  deleteCard,
  deleteEmptyCards,
  deleteSession,
  joinSession,
  resizeCard,
  toggleReaction,
  updateCard,
  updateSessionName,
  updateSessionSettings,
  voteCard as voteCardAction,
} from "@/app/actions";
import { AddCardButton } from "@/components/add-card-button";
import { ChatPanel, ChatTrigger } from "@/components/chat/chat-drawer";
import { CleanupCardsDialog } from "@/components/cleanup-cards-dialog";
import { ClusterCardsDialog } from "@/components/cluster-cards-dialog";
import { CommandMenu } from "@/components/command-menu";
import { EditNameDialog } from "@/components/edit-name-dialog";
import { ThemeSwitcherToggle } from "@/components/elements/theme-switcher-toggle";
import {
  IdeaCardNode,
  setIdeaCardNodeCallbacks,
} from "@/components/idea-card-node";
import { ParticipantsDialog } from "@/components/participants-dialog";
import { RealtimeCursors } from "@/components/realtime-cursors";
import { SessionSettingsDialog } from "@/components/session-settings-dialog";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { UserBadge } from "@/components/user-badge";
import type { Card, Session, SessionRole, TiptapContent } from "@/db/schema";
import { DEFAULT_TIPTAP_CONTENT } from "@/db/schema";
import { useCatSound } from "@/hooks/use-cat-sound";
import { useFingerprint } from "@/hooks/use-fingerprint";
import type { SessionSettings } from "@/hooks/use-realtime-cards";
import { useRealtimeCards } from "@/hooks/use-realtime-cards";
import { useRealtimePresence } from "@/hooks/use-realtime-presence";
import { useSessionUsername } from "@/hooks/use-session-username";
import { DARK_COLORS, LIGHT_COLORS } from "@/lib/colors";
import { generateCardId } from "@/lib/nanoid";
import { canAddCard } from "@/lib/permissions";
import {
  CARD_HEIGHT,
  CARD_HEIGHT_MOBILE,
  CARD_WIDTH,
  CARD_WIDTH_MOBILE,
  calculateCardsBounds,
  cardsToNodes,
  DEFAULT_CARD_HEIGHT,
  DEFAULT_CARD_WIDTH,
  type IdeaCardNode as IdeaCardNodeType,
  updateNodeData,
} from "@/lib/react-flow-utils";
import { createTiptapContent } from "@/lib/tiptap-utils";
import { cn, getAvatarForUser } from "@/lib/utils";
import { useChatStore } from "@/stores/chat-store";

export interface Participant {
  visitorId: string;
  username: string;
}

interface ReactFlowBoardProps {
  sessionId: string;
  initialSession: Session;
  initialCards: Card[];
  initialParticipants: Participant[];
}

// Register node types
const nodeTypes: NodeTypes = {
  ideaCard: IdeaCardNode,
};

// Minimum zoom and maximum zoom
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;

function ReactFlowBoardInner({
  sessionId,
  initialSession,
  initialCards,
  initialParticipants,
}: ReactFlowBoardProps) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { visitorId, isLoading: isFingerprintLoading } = useFingerprint();
  const playSound = useCatSound();
  const isChatOpen = useChatStore((state) => state.isOpen);

  // React Flow hooks
  const {
    fitView,
    zoomIn,
    zoomOut,
    setViewport,
    screenToFlowPosition,
    flowToScreenPosition,
  } = useReactFlow();

  // State
  const [nodes, setNodes] = useState<IdeaCardNodeType[]>([]);
  const [copied, setCopied] = useState(false);
  const [sessionIdCopied, setSessionIdCopied] = useState(false);
  const [newCardId, setNewCardId] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editSessionNameOpen, setEditSessionNameOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [session, setSession] = useState<Session>(initialSession);
  const [userRole, setUserRole] = useState<SessionRole | null>(null);
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

  const hasInitializedViewRef = useRef(false);
  // Ref to store duplicate callback to avoid stale closures in useEffect
  const handleDuplicateCardRef = useRef<((card: Card) => void) | null>(null);
  // Track component mount state for async operations
  const mountedRef = useRef(true);

  // Cleanup mounted ref on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Derived state
  const isSessionCreator = userRole === "creator";
  const isLocked = session.isLocked;
  // Derive isMobile from viewportSize - avoids recalculating in multiple places
  const isMobile = viewportSize.width > 0 && viewportSize.width < 640;

  const {
    username,
    isLoading: isUsernameLoading,
    updateUsername,
  } = useSessionUsername({
    sessionId,
    visitorId,
  });

  // Track online presence for participants
  const { onlineUsers } = useRealtimePresence({
    roomName: sessionId,
    userId: visitorId || "",
  });

  // Join session and get user role
  useEffect(() => {
    if (!visitorId) return;

    const doJoin = async () => {
      try {
        const { role, error } = await joinSession(visitorId, sessionId);
        if (error) {
          console.error("Failed to join session:", error);
          return;
        }
        if (role) {
          setUserRole(role);
        }
      } catch (err) {
        console.error("Error joining session:", err);
      }
    };

    doJoin();
  }, [visitorId, sessionId]);

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
    applyClusterPositions,
    broadcastClusterPositions,
    batchMoveCards,
  } = useRealtimeCards(
    sessionId,
    initialCards,
    visitorId || "",
    username,
    handleRemoteNameChange,
    handleRemoteSessionRename,
    handleRemoteSessionSettingsChange,
  );

  // Sync cards to nodes - skip during drag to prevent flickering
  useEffect(() => {
    if (!visitorId || isDragging) return;

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
  ]);

  // Set up node callbacks
  useEffect(() => {
    setIdeaCardNodeCallbacks({
      onType: typeCard,
      onChangeColor: changeColor,
      onDelete: removeCard,
      onVote: async (id: string) => {
        if (!visitorId) return;

        const card = cards.find((c) => c.id === id);
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

        const card = cards.find((c) => c.id === id);
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
        await updateCard(id, { content }, visitorId);
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
        const card = cards.find((c) => c.id === cardId);
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
    });
  }, [
    visitorId,
    cards,
    typeCard,
    changeColor,
    removeCard,
    voteCard,
    reactCard,
    newCardId,
    realtimeResizeCard,
    sessionId,
  ]);

  // Handle node position changes from drag - let React Flow manage positions
  const handleNodesChange: OnNodesChange<IdeaCardNodeType> = useCallback(
    (changes: NodeChange<IdeaCardNodeType>[]) => {
      // Apply changes directly to nodes - don't update cards state during drag
      // This prevents the flickering caused by state sync fighting with React Flow
      setNodes((nds) => applyNodeChanges(changes, nds) as IdeaCardNodeType[]);
    },
    [],
  );

  // Handle drag start - prevent cards sync during drag
  const handleNodeDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  // Handle drag end - sync to cards state and persist to database
  const handleNodeDragStop = useCallback(
    async (_event: React.MouseEvent, _node: Node, draggedNodes: Node[]) => {
      if (!visitorId) {
        setIsDragging(false);
        return;
      }

      const positions = draggedNodes.map((n) => ({
        id: n.id,
        x: n.position.x,
        y: n.position.y,
      }));

      // Update cards state + broadcast in ONE operation (no individual moveCard calls)
      batchMoveCards(positions);

      // Re-enable cards sync AFTER state is updated
      setIsDragging(false);

      // Persist to database
      await Promise.all(
        positions.map((pos) =>
          updateCard(pos.id, { x: pos.x, y: pos.y }, visitorId),
        ),
      );
    },
    [visitorId, batchMoveCards],
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
    if (!canAddCard(session)) return;

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
    playSound,
    screenToFlowPosition,
    sessionId,
    getRandomColor,
    addCard,
    cards.length,
    setViewport,
  ]);

  const handleDuplicateCard = useCallback(
    async (card: Card) => {
      if (!username || !visitorId) return;

      // Check if session allows adding cards
      if (!canAddCard(session)) return;

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
      playSound,
      sessionId,
      addCard,
      cards,
      removeCard,
    ],
  );

  // Keep ref updated with latest callback
  handleDuplicateCardRef.current = handleDuplicateCard;

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  const handleCopySessionId = async () => {
    try {
      await navigator.clipboard.writeText(sessionId);
      setSessionIdCopied(true);
      setTimeout(() => setSessionIdCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy session ID:", err);
    }
  };

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
    movePermission?: Session["movePermission"];
    deletePermission?: Session["deletePermission"];
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
        movePermission: updatedSession.movePermission,
        deletePermission: updatedSession.deletePermission,
      });
      return { success: true };
    }
    return { success: false, error: error ?? "Failed to update settings" };
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
    if (!canAddCard(session)) return;

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

      // "N" to create a new card
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handleAddCard();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    commandOpen,
    handleAddCard,
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
      <div className="flex-1 min-h-screen overflow-hidden relative">
        <CommandMenu
          open={commandOpen}
          onOpenChange={setCommandOpen}
          onAddCard={handleAddCard}
          onShare={handleShare}
          onChangeName={() => setEditNameOpen(true)}
        />

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
          {isSessionCreator && (
            <>
              <CleanupCardsDialog
                cards={cards}
                onCleanup={handleCleanupEmptyCards}
                trigger={
                  <Button
                    variant="outline"
                    size="icon"
                    className="bg-card/80 backdrop-blur-sm h-8 w-8 sm:h-9 sm:w-9"
                    title="Clean up empty cards"
                  >
                    <Trash className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </Button>
                }
              />
              <ClusterCardsDialog
                cards={cards}
                sessionId={sessionId}
                userId={visitorId}
                onCluster={handleClusterCards}
                trigger={
                  <Button
                    variant="outline"
                    size="icon"
                    className="bg-card/80 backdrop-blur-sm h-8 w-8 sm:h-9 sm:w-9"
                    title="Cluster cards by similarity"
                    disabled={isLocked}
                  >
                    <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </Button>
                }
              />
              <SessionSettingsDialog
                session={session}
                onUpdateSettings={handleUpdateSessionSettings}
                onDeleteSession={handleDeleteSession}
                trigger={
                  <Button
                    variant="outline"
                    size="icon"
                    className="bg-card/80 backdrop-blur-sm h-8 w-8 sm:h-9 sm:w-9"
                    title="Session Settings"
                  >
                    <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </Button>
                }
              />
            </>
          )}
        </div>

        {/* Fixed UI - Top Right: Desktop */}
        <div
          className={cn(
            "fixed top-2 sm:top-4 right-2 sm:right-4 z-50 hidden sm:flex items-center gap-2 transition-[right] duration-300",
            isChatOpen && "sm:right-[396px]",
          )}
        >
          <button
            type="button"
            onClick={handleCopySessionId}
            className="flex text-muted-foreground text-sm font-mono bg-card/80 backdrop-blur-sm px-3 h-9 items-center justify-center gap-2 rounded-md border border-border shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 transition-all cursor-pointer"
            title={sessionIdCopied ? "Copied!" : "Copy session ID"}
          >
            {sessionId}
            {sessionIdCopied ? (
              <Check className="w-3.5 h-3.5 text-sky-500" />
            ) : (
              <Copy className="w-3.5 h-3.5 opacity-50" />
            )}
          </button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleAddCard}
            disabled={isLocked}
            title={isLocked ? "Session is locked" : "Add card (N)"}
          >
            <Plus className="w-4 h-4" />
          </Button>
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
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCommandOpen(true)}
            title="Command menu (⌘K)"
          >
            <Command className="w-4 h-4" />
          </Button>
          <div className="bg-card/80 backdrop-blur-sm h-9 flex items-center px-2 rounded-lg border border-border">
            <ThemeSwitcherToggle />
          </div>
        </div>

        {/* Fixed UI - Top Right: Mobile Hamburger Menu */}
        <div
          className={cn(
            "fixed top-2 right-2 z-50 sm:hidden transition-[right] duration-300",
            isChatOpen && "right-[392px]",
          )}
        >
          <Button
            variant="outline"
            size="icon"
            className="bg-card/80 backdrop-blur-sm h-8 w-8"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="w-4 h-4" />
          </Button>
        </div>

        {/* Mobile Menu Drawer */}
        <Drawer open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Menu</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-6 space-y-2">
              {/* Add Card */}
              <DrawerClose asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-11"
                  onClick={handleAddCard}
                  disabled={isLocked}
                >
                  <Plus className="w-4 h-4" />
                  {isLocked ? "Session is locked" : "Add new card"}
                </Button>
              </DrawerClose>

              {/* Share Link */}
              <DrawerClose asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-11"
                  onClick={handleShare}
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-sky-500" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                  {copied ? "Link copied!" : "Copy share link"}
                </Button>
              </DrawerClose>

              {/* Copy Session ID */}
              <DrawerClose asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-11"
                  onClick={handleCopySessionId}
                >
                  {sessionIdCopied ? (
                    <Check className="w-4 h-4 text-sky-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span className="flex-1 text-left">
                    {sessionIdCopied ? "Copied!" : "Copy session ID"}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {sessionId}
                  </span>
                </Button>
              </DrawerClose>

              {/* Edit Username */}
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-11"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setEditNameOpen(true);
                }}
              >
                <Pencil className="w-4 h-4" />
                Change your name
              </Button>

              {/* Clean up Empty Cards (Session Creator Only) */}
              {isSessionCreator && (
                <CleanupCardsDialog
                  cards={cards}
                  onCleanup={handleCleanupEmptyCards}
                  trigger={
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-3 h-11"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Trash className="w-4 h-4" />
                      Clean up empty cards
                    </Button>
                  }
                />
              )}

              {/* Command Menu */}
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-11"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setCommandOpen(true);
                }}
              >
                <Command className="w-4 h-4" />
                Command menu
              </Button>

              {/* Theme Toggle */}
              <div className="flex items-center justify-between h-11 px-4 rounded-md border border-input bg-background">
                <span className="text-sm">Theme</span>
                <ThemeSwitcherToggle />
              </div>
            </div>
          </DrawerContent>
        </Drawer>

        {/* Fixed UI - Bottom Right */}
        <div
          className={cn(
            "fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center gap-2 transition-[right] duration-300",
            isChatOpen && "sm:right-[404px]",
          )}
        >
          <ParticipantsDialog
            participants={participantsWithCurrentUser}
            currentUserId={visitorId}
            onlineUsers={onlineUsers}
          />
          <AddCardButton onClick={handleAddCard} disabled={isLocked} />
        </div>

        {/* Fixed UI - Bottom Left: Zoom Controls */}
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
        <ReactFlow
          nodes={nodes}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onNodeDragStart={handleNodeDragStart}
          onNodeDragStop={handleNodeDragStop}
          onSelectionChange={handleSelectionChange}
          onMoveEnd={handleMoveEnd}
          onInit={() => setIsReactFlowReady(true)}
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
              className={cn(
                "!absolute !top-20 !right-4 !bottom-auto !left-auto transition-[right] duration-300 !bg-card/80 backdrop-blur-sm !border !border-border !rounded-lg",
                isChatOpen && "!right-[396px]",
              )}
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

      {/* AI Chat Panel - pushes content when open */}
      <ChatPanel sessionId={sessionId} userId={visitorId} />
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
