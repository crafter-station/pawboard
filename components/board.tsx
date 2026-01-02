"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTheme } from "next-themes";
import { useRealtimeCards } from "@/hooks/use-realtime-cards";
import { useFingerprint } from "@/hooks/use-fingerprint";
import { useCatSound } from "@/hooks/use-cat-sound";
import { useCanvasGestures } from "@/hooks/use-canvas-gestures";
import { useSessionUsername } from "@/hooks/use-session-username";
import { RealtimeCursors } from "@/components/realtime-cursors";
import { IdeaCard } from "@/components/idea-card";
import { UserBadge } from "@/components/user-badge";
import { EditNameDialog } from "@/components/edit-name-dialog";
import { AddCardButton } from "@/components/add-card-button";
import { CommandMenu } from "@/components/command-menu";
import { ParticipantsDialog } from "@/components/participants-dialog";
import { generateCardId } from "@/lib/nanoid";
import { getAvatarForUser } from "@/lib/utils";
import {
  createCard,
  updateCard,
  deleteCard,
  voteCard as voteCardAction,
  updateSessionName,
} from "@/app/actions";
import type { Card } from "@/db/schema";
import {
  Share2,
  Home,
  Plus,
  Command,
  Copy,
  Check,
  Minus,
  Maximize2,
  Pencil,
  Menu,
  Moon,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ThemeSwitcherToggle } from "@/components/elements/theme-switcher-toggle";
import Link from "next/link";

const LIGHT_COLORS = ["#D4B8F0", "#FFCAB0", "#C4EDBA", "#C5E8EC", "#F9E9A8"];

const DARK_COLORS = ["#9B7BC7", "#E8936A", "#7BC96A", "#7ABCC5", "#D4C468"];

export interface Participant {
  visitorId: string;
  username: string;
}

interface BoardProps {
  sessionId: string;
  initialSessionName: string;
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
  initialSessionName,
  initialCards,
  initialParticipants,
}: BoardProps) {
  const [copied, setCopied] = useState(false);
  const [sessionIdCopied, setSessionIdCopied] = useState(false);
  const [newCardId, setNewCardId] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editSessionNameOpen, setEditSessionNameOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sessionName, setSessionName] = useState(initialSessionName);
  const [participants, setParticipants] = useState<Map<string, string>>(
    () => new Map(initialParticipants.map((p) => [p.visitorId, p.username])),
  );
  const hasInitializedViewRef = useRef(false);
  const { resolvedTheme } = useTheme();
  const { visitorId, isLoading: isFingerprintLoading } = useFingerprint();
  const playSound = useCatSound();

  const {
    username,
    isLoading: isUsernameLoading,
    updateUsername,
  } = useSessionUsername({
    sessionId,
    visitorId,
  });

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
    screenToWorld,
    zoomTo,
    resetView,
    fitToBounds,
    centerOn,
    handlers: canvasHandlers,
  } = useCanvasGestures();

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
    setSessionName(newName);
  }, []);

  const {
    cards,
    addCard,
    moveCard,
    typeCard,
    changeColor,
    removeCard,
    voteCard,
    broadcastNameChange,
    broadcastSessionRename,
  } = useRealtimeCards(
    sessionId,
    initialCards,
    visitorId || "",
    username,
    handleRemoteNameChange,
    handleRemoteSessionRename,
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
    playSound();

    const isMobile = window.innerWidth < 640;
    const cardWidth = isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH;
    const cardHeight = isMobile ? CARD_HEIGHT_MOBILE : CARD_HEIGHT;

    // Convert screen center to world coordinates
    const screenCenter = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    const worldCenter = screenToWorld(screenCenter);

    // Random offset (+-100px) to avoid stacking
    const offsetRange = 100;
    const x =
      worldCenter.x -
      cardWidth / 2 +
      (Math.random() * offsetRange * 2 - offsetRange);
    const y =
      worldCenter.y -
      cardHeight / 2 +
      (Math.random() * offsetRange * 2 - offsetRange);

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
      createdById: visitorId,
      updatedAt: new Date(),
    };

    setNewCardId(cardId);
    addCard(newCard);
    await createCard(newCard);
  }, [
    username,
    visitorId,
    playSound,
    screenToWorld,
    sessionId,
    getRandomColor,
    addCard,
  ]);

  const handlePersistContent = async (id: string, content: string) => {
    await updateCard(id, { content });
  };

  const handlePersistMove = async (id: string, x: number, y: number) => {
    await updateCard(id, { x, y });
  };

  const handlePersistColor = async (id: string, color: string) => {
    await updateCard(id, { color });
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
    const { session, error } = await updateSessionName(sessionId, newName);
    if (session && !error) {
      // Update local state
      setSessionName(session.name);
      // Broadcast to other participants
      broadcastSessionRename(session.name);
      return { success: true };
    }
    return { success: false, error: error ?? "Failed to update session name" };
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
        currentName={sessionName}
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

      {/* Fixed UI - Top Center: Session Name */}
      <div className="fixed top-2 sm:top-4 left-1/2 -translate-x-1/2 z-50">
        <button
          type="button"
          onClick={() => setEditSessionNameOpen(true)}
          className="group flex items-center gap-2 bg-card/80 backdrop-blur-sm px-3 sm:px-4 h-8 sm:h-9 rounded-lg border border-border shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 transition-all cursor-pointer max-w-[120px] sm:max-w-xs"
          title="Click to rename board"
        >
          <span className="text-sm font-medium truncate">{sessionName}</span>
          <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0 hidden sm:block" />
        </button>
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
          className="bg-card/80 backdrop-blur-sm h-9 w-9"
          title="Add card (N)"
        >
          <Plus className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleShare}
          className="bg-card/80 backdrop-blur-sm h-9 w-9"
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
          className="bg-card/80 backdrop-blur-sm h-9 w-9"
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
              >
                <Plus className="w-4 h-4" />
                Add new card
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
        />
        <AddCardButton onClick={handleAddCard} />
      </div>

      {/* Fixed UI - Bottom Left: Zoom Controls */}
      <div className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-50 flex items-center gap-1 bg-card/80 backdrop-blur-sm rounded-lg border border-border px-1 py-1">
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

      {/* Viewport with gesture handlers */}
      <div
        role="application"
        aria-label="Idea board canvas - use mouse wheel to pan, Ctrl+scroll to zoom"
        className="relative w-full h-screen overflow-hidden"
        style={{ cursor: isPanning ? "grabbing" : "default" }}
        onMouseDown={canvasHandlers.onMouseDown}
        onWheel={canvasHandlers.onWheel}
        onTouchStart={canvasHandlers.onTouchStart}
        onTouchMove={canvasHandlers.onTouchMove}
        onTouchEnd={canvasHandlers.onTouchEnd}
      >
        {/* Transformable canvas */}
        <div
          className="absolute origin-top-left"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* Cards */}
          {cards.map((card) => (
            <IdeaCard
              key={card.id}
              card={card}
              creatorName={getUsernameForId(card.createdById)}
              visitorId={visitorId}
              autoFocus={card.id === newCardId}
              onFocused={() => setNewCardId(null)}
              onMove={moveCard}
              onType={typeCard}
              onChangeColor={changeColor}
              onDelete={removeCard}
              onVote={handleVote}
              onPersistContent={handlePersistContent}
              onPersistMove={handlePersistMove}
              onPersistColor={handlePersistColor}
              onPersistDelete={handlePersistDelete}
              screenToWorld={screenToWorld}
              zoom={zoom}
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
            <div className="text-center text-muted-foreground">
              <p className="text-lg">No ideas yet</p>
              <p className="text-sm mt-1">
                Press{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
                  ⌘K
                </kbd>{" "}
                or click + to add one
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
