"use client";

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
  Trash,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createCard,
  deleteCard,
  deleteEmptyCards,
  deleteSession,
  joinSession,
  toggleReaction,
  updateCard,
  updateSessionName,
  updateSessionSettings,
  voteCard as voteCardAction,
} from "@/app/actions";

import { CleanupCardsDialog } from "@/components/cleanup-cards-dialog";
import { CommandMenu } from "@/components/command-menu";
import { EditNameDialog } from "@/components/edit-name-dialog";
import { ThemeSwitcherToggle } from "@/components/elements/theme-switcher-toggle";
import { IdeaCard } from "@/components/idea-card";
import { Minimap } from "@/components/minimap";
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
import type { Card, Session, SessionRole } from "@/db/schema";
import { useCanvasGestures } from "@/hooks/use-canvas-gestures";
import { useCatSound } from "@/hooks/use-cat-sound";
import { useFingerprint } from "@/hooks/use-fingerprint";
import type { SessionSettings } from "@/hooks/use-realtime-cards";
import { useRealtimeCards } from "@/hooks/use-realtime-cards";
import { useRealtimePresence } from "@/hooks/use-realtime-presence";
import { useSessionUsername } from "@/hooks/use-session-username";
import { DARK_COLORS, LIGHT_COLORS } from "@/lib/colors";
import { generateCardId } from "@/lib/nanoid";
import { canAddCard } from "@/lib/permissions";
import { getAvatarForUser } from "@/lib/utils";

export interface Participant {
  visitorId: string;
  username: string;
}

interface BoardProps {
  sessionId: string;
  initialSession: Session;
  initialCards: Card[];
  initialParticipants: Participant[];
}

// Card dimensions for calculations
const CARD_WIDTH = 224;
const CARD_HEIGHT = 160;
const CARD_WIDTH_MOBILE = 160;
const CARD_HEIGHT_MOBILE = 120;

export function Board({
  sessionId,
  initialSession,
  initialCards,
  initialParticipants,
}: BoardProps) {
  const router = useRouter();
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
  const hasInitializedViewRef = useRef(false);
  const { resolvedTheme } = useTheme();
  const { visitorId, isLoading: isFingerprintLoading } = useFingerprint();
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const playSound = useCatSound();

  // Derived state
  const isSessionCreator = userRole === "creator";
  const isLocked = session.isLocked;

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
      const { role } = await joinSession(visitorId, sessionId);
      if (role) {
        setUserRole(role);
      }
    };

    doJoin();
  }, [visitorId, sessionId]);

  // Update participants map when current user's username changes
  useEffect(() => {
    if (visitorId && username) {
      setParticipants((prev) => {
        const next = new Map(prev);
        next.set(visitorId, username);
        return next;
      });
    }
  }, [visitorId, username]);

  // Update viewport size
  useEffect(() => {
    const updateViewportSize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };

    updateViewportSize();
    window.addEventListener("resize", updateViewportSize);
    return () => window.removeEventListener("resize", updateViewportSize);
  }, []);

  // Helper to get username for a user ID
  const getUsernameForId = useCallback(
    (userId: string): string => {
      return participants.get(userId) ?? "Unknown";
    },
    [participants],
  );

  const {
    pan,
    zoom,
    isPanning,
    isSpacePressed,
    canvasRef,
    screenToWorld,
    worldToScreen,
    zoomTo,
    resetView,
    fitToBounds,
    centerOn,
    handlers: canvasHandlers,
  } = useCanvasGestures();

  // Handle minimap navigation
  const handleMinimapNavigate = useCallback(
    (worldPoint: { x: number; y: number }) => {
      centerOn(worldPoint, zoom); // Keep current zoom level
    },
    [centerOn, zoom],
  );

  // Handle minimap zoom
  const handleMinimapZoom = useCallback(
    (worldPoint: { x: number; y: number }, deltaY: number) => {
      // deltaY > 0 = zoom out, deltaY < 0 = zoom in
      const zoomFactor = deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.25, Math.min(2, zoom * zoomFactor));
      // Convert world point to screen coordinates for zoom center
      const screenPoint = worldToScreen(worldPoint);
      zoomTo(newZoom, screenPoint);
    },
    [zoom, zoomTo, worldToScreen],
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
    moveCard,
    typeCard,
    changeColor,
    removeCard,
    voteCard,
    reactCard,
    broadcastNameChange,
    broadcastSessionRename,
    broadcastSessionSettings,
  } = useRealtimeCards(
    sessionId,
    initialCards,
    visitorId || "",
    username,
    handleRemoteNameChange,
    handleRemoteSessionRename,
    handleRemoteSessionSettingsChange,
  );

  // Fit all cards in view
  const fitAllCards = useCallback(() => {
    if (cards.length === 0) {
      resetView();
      return;
    }

    const isMobile = window.innerWidth < 640;
    const cardWidth = isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH;
    const cardHeight = isMobile ? CARD_HEIGHT_MOBILE : CARD_HEIGHT;

    const bounds = cards.reduce(
      (acc, card) => ({
        minX: Math.min(acc.minX, card.x),
        minY: Math.min(acc.minY, card.y),
        maxX: Math.max(acc.maxX, card.x + cardWidth),
        maxY: Math.max(acc.maxY, card.y + cardHeight),
      }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    );

    fitToBounds(bounds);
  }, [cards, fitToBounds, resetView]);

  // Initialize view centered on cards on first load
  useEffect(() => {
    if (hasInitializedViewRef.current) return;
    hasInitializedViewRef.current = true;

    if (initialCards.length === 0) {
      return;
    }

    const isMobile = window.innerWidth < 640;
    const cardWidth = isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH;
    const cardHeight = isMobile ? CARD_HEIGHT_MOBILE : CARD_HEIGHT;

    const bounds = initialCards.reduce(
      (acc, card) => ({
        minX: Math.min(acc.minX, card.x),
        minY: Math.min(acc.minY, card.y),
        maxX: Math.max(acc.maxX, card.x + cardWidth),
        maxY: Math.max(acc.maxY, card.y + cardHeight),
      }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    );

    // Center on cards at 100% zoom
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    centerOn({ x: centerX, y: centerY }, 1);
  }, [initialCards, centerOn]);

  // Keyboard shortcut for fit all (key "1")
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
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
      const screenCenter = {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      };
      const worldCenter = screenToWorld(screenCenter);
      const offsetRange = 100;
      x =
        worldCenter.x -
        cardWidth / 2 +
        (Math.random() * offsetRange * 2 - offsetRange);
      y =
        worldCenter.y -
        cardHeight / 2 +
        (Math.random() * offsetRange * 2 - offsetRange);
    }

    const cardId = generateCardId();
    const newCard: Card = {
      id: cardId,
      sessionId,
      content: "",
      color: getRandomColor(),
      x,
      y,
      votes: 0,
      votedBy: [],
      reactions: {},
      createdById: visitorId,
      updatedAt: new Date(),
    };

    if (isFirstCard) {
      centerOn({ x: 0, y: 0 }, 1);
    }

    setNewCardId(cardId);
    addCard(newCard);
    await createCard(newCard, visitorId);
  }, [
    username,
    visitorId,
    session,
    playSound,
    screenToWorld,
    sessionId,
    getRandomColor,
    addCard,
    cards.length,
    centerOn,
  ]);

  const handlePersistContent = async (id: string, content: string) => {
    if (!visitorId) return;
    await updateCard(id, { content }, visitorId);
  };

  const handlePersistMove = async (id: string, x: number, y: number) => {
    if (!visitorId) return;
    await updateCard(id, { x, y }, visitorId);
  };

  const handlePersistColor = async (id: string, color: string) => {
    if (!visitorId) return;
    await updateCard(id, { color }, visitorId);
  };

  const handlePersistDelete = async (id: string) => {
    if (!visitorId) return;
    await deleteCard(id, visitorId);
  };

  const handleVote = async (id: string) => {
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
  };

  const handleReact = async (id: string, emoji: string) => {
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
  };

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopySessionId = async () => {
    await navigator.clipboard.writeText(sessionId);
    setSessionIdCopied(true);
    setTimeout(() => setSessionIdCopied(false), 2000);
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
      // Update local state
      setSession((prev) => ({ ...prev, name: updatedSession.name }));
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
      // Update local state
      setSession(updatedSession);
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

  // Keyboard shortcut for new card (key "N")
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Skip if command menu is open
      if (commandOpen) {
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
  }, [commandOpen, handleAddCard]);

  if (!username || isFingerprintLoading || isUsernameLoading || !visitorId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden relative">
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
            <span className="text-xs font-medium hidden sm:inline">Locked</span>
          </div>
        )}
        {isSessionCreator ? (
          <button
            type="button"
            onClick={() => setEditSessionNameOpen(true)}
            className="group flex items-center gap-2 bg-card/80 backdrop-blur-sm px-3 sm:px-4 h-8 sm:h-9 rounded-lg border border-border shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 transition-all cursor-pointer max-w-30 sm:max-w-xs"
            title="Click to rename board"
          >
            <span className="text-sm font-medium truncate">{session.name}</span>
            <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0 hidden sm:block" />
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-card/80 backdrop-blur-sm px-3 sm:px-4 h-8 sm:h-9 rounded-lg border border-border shadow-xs max-w-30 sm:max-w-xs">
            <span className="text-sm font-medium truncate">{session.name}</span>
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
      <div className="fixed top-2 sm:top-4 right-2 sm:right-4 z-50 hidden sm:flex items-center gap-2">
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
      <div className="fixed top-2 right-2 z-50 sm:hidden">
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
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center gap-2">
        <ParticipantsDialog
          participants={participants}
          currentUserId={visitorId}
          onlineUsers={onlineUsers}
        />
      </div>

      {/* Minimap (Desktop Only) */}
      {viewportSize.width >= 640 && (
        <div className="fixed top-20 right-4 z-50">
          <Minimap
            cards={cards}
            pan={pan}
            zoom={zoom}
            viewportWidth={viewportSize.width}
            viewportHeight={viewportSize.height}
            onNavigate={handleMinimapNavigate}
            onZoom={handleMinimapZoom}
          />
        </div>
      )}

      {/* Fixed UI - Bottom Left: Zoom Controls */}
      <div className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-50">
        <div className="flex items-center gap-1 bg-card/80 backdrop-blur-sm rounded-lg border border-border px-1 py-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => zoomTo(zoom / 1.2)}
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
            onClick={() => zoomTo(zoom * 1.2)}
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

      {/* Viewport with gesture handlers */}
      <div
        ref={canvasRef}
        role="application"
        aria-label="Idea board canvas - use mouse wheel to pan, Shift+scroll to pan horizontally, Ctrl+scroll to zoom, hold Space+drag to pan"
        className="relative w-full h-screen overflow-hidden"
        style={{
          cursor: isPanning ? "grabbing" : isSpacePressed ? "grab" : "default",
        }}
        onMouseDown={canvasHandlers.onMouseDown}
        onTouchStart={canvasHandlers.onTouchStart}
        onTouchMove={canvasHandlers.onTouchMove}
        onTouchEnd={canvasHandlers.onTouchEnd}
      >
        {/* Transformable canvas */}
        <div
          className="absolute origin-top-left transition-transform duration-300 ease-out"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* Cards */}
          {cards.map((card) => (
            <IdeaCard
              key={card.id}
              card={card}
              session={session}
              userRole={userRole}
              creatorName={getUsernameForId(card.createdById)}
              visitorId={visitorId}
              autoFocus={card.id === newCardId}
              onFocused={() => setNewCardId(null)}
              onMove={moveCard}
              onType={typeCard}
              onChangeColor={changeColor}
              onDelete={removeCard}
              onVote={handleVote}
              onReact={handleReact}
              onPersistContent={handlePersistContent}
              onPersistMove={handlePersistMove}
              onPersistColor={handlePersistColor}
              onPersistDelete={handlePersistDelete}
              screenToWorld={screenToWorld}
              zoom={zoom}
              isSpacePressed={isSpacePressed}
            />
          ))}

          {/* Cursors - rendered in world space */}
          <RealtimeCursors
            roomName={`session:${sessionId}`}
            username={username}
            screenToWorld={screenToWorld}
          />
        </div>

        {/* Empty state - stays centered in viewport */}
        {cards.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 opacity-20">
                <img
                  src={
                    visitorId ? getAvatarForUser(visitorId) : "/cat-purple.svg"
                  }
                  alt=""
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
      </div>
    </div>
  );
}
