"use client";

import NumberFlow from "@number-flow/react";
import {
  Check,
  ChevronUp,
  Copy,
  CopyPlus,
  GripVertical,
  Loader2,
  Maximize2,
  Minimize2,
  Smile,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Card, Session, SessionRole } from "@/db/schema";
import {
  DARK_COLORS,
  getDisplayColor as getDisplayColorUtil,
  LIGHT_COLORS,
} from "@/lib/colors";
import {
  canChangeColor,
  canDeleteCard,
  canEditCard,
  canMoveCard,
  canReact,
  canRefine,
  canVote,
} from "@/lib/permissions";
import { getAvatarForUser } from "@/lib/utils";

const REACTION_EMOJIS = ["👍", "❤️", "🔥", "💡", "🎯"] as const;

interface Point {
  x: number;
  y: number;
}

interface IdeaCardProps {
  card: Card;
  session: Session;
  userRole: SessionRole | null;
  creatorName: string;
  visitorId: string;
  autoFocus?: boolean;
  onFocused?: () => void;
  isSelected?: boolean;
  onSelect?: () => void;
  onDuplicate?: (card: Card) => void;
  onMove: (id: string, x: number, y: number) => void;
  onType: (id: string, content: string) => void;
  onChangeColor: (id: string, color: string) => void;
  onDelete: (id: string) => void;
  onVote: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
  onPersistContent: (id: string, content: string) => void;
  onPersistMove: (id: string, x: number, y: number) => void;
  onPersistColor: (id: string, color: string) => void;
  onPersistDelete: (id: string) => void;
  screenToWorld: (screen: Point) => Point;
  zoom: number;
  isSpacePressed?: boolean;
  selectedCardIds?: Set<string>;
  onMoveSelectedCards?: (deltaX: number, deltaY: number) => void;
  onPersistMultiMove?: () => void;
}

export function IdeaCard({
  card,
  session,
  userRole,
  creatorName,
  visitorId,
  autoFocus,
  onFocused,
  isSelected = false,
  onSelect,
  onDuplicate,
  onMove,
  onType,
  onChangeColor,
  onDelete,
  onVote,
  onReact,
  onPersistContent,
  onPersistMove,
  onPersistColor,
  onPersistDelete,
  screenToWorld,
  zoom: _zoom,
  isSpacePressed = false,
  selectedCardIds,
  onMoveSelectedCards,
  onPersistMultiMove,
}: IdeaCardProps) {
  void _zoom; // Reserved for future use (cursor scaling, etc.)
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [previousContent, setPreviousContent] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const { resolvedTheme } = useTheme();
  const cardRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const dragStartScreenPos = useRef<{ x: number; y: number } | null>(null);
  const hasDraggedRef = useRef(false);
  const lastWorldPosRef = useRef<{ x: number; y: number } | null>(null);

  // Permission checks
  const isOwnCard = card.createdById === visitorId;
  const hasVoted = card.votedBy?.includes(visitorId) || false;
  const allowMove = canMoveCard(session, card, visitorId);
  const allowEdit = canEditCard(session, card, visitorId);
  const allowDelete = canDeleteCard(
    session,
    card,
    visitorId,
    userRole ?? "participant",
  );
  const allowChangeColor = canChangeColor(session, card, visitorId);
  const allowRefine = canRefine(session, card, visitorId);
  const allowVote = canVote(session, card, visitorId);
  const allowReact = canReact(session, card, visitorId);

  useEffect(() => {
    setMounted(true);
    setIsMobile(window.innerWidth < 640);
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (autoFocus && allowEdit) {
      setIsEditing(true);
      onFocused?.();
    }
  }, [autoFocus, allowEdit, onFocused]);

  const isDark = mounted && resolvedTheme === "dark";
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  const displayColor = getDisplayColorUtil(card.color, isDark, mounted);
  const creatorAvatar = getAvatarForUser(card.createdById);

  const handleDragStart = (clientX: number, clientY: number) => {
    if (!allowMove) return;
    setIsDragging(true);
    hasDraggedRef.current = false;
    dragStartScreenPos.current = { x: clientX, y: clientY };
    startPos.current = { x: card.x, y: card.y };
    // Calculate the offset in world coordinates
    // The click position in world space minus the card's world position
    const clickWorld = screenToWorld({ x: clientX, y: clientY });
    dragOffset.current = {
      x: clickWorld.x - card.x,
      y: clickWorld.y - card.y,
    };
    // Initialize last world position for multi-card dragging
    lastWorldPosRef.current = clickWorld;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't start drag on middle mouse button (used for panning)
    // or when space is pressed (space+click is for canvas panning)
    if (e.button === 1 || isSpacePressed) return;

    // Check if clicking on interactive elements
    const target = e.target as HTMLElement;
    const isInteractiveElement =
      target.closest("button") ||
      target.closest("textarea") ||
      target.closest("[role='button']") ||
      target.closest(".popover-content");

    // Only select if not clicking on interactive elements
    // AND the card is not already selected (to preserve multi-selection)
    if (!isInteractiveElement && onSelect && !isSelected) {
      onSelect();
    }

    // Start drag tracking (but won't actually move until threshold is met)
    handleDragStart(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only handle single-finger touch (two-finger is for panning/zooming)
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      handleDragStart(touch.clientX, touch.clientY);
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const DRAG_THRESHOLD = 5; // pixels

    const handleMouseMove = (e: MouseEvent) => {
      // Check if we've moved enough to consider it a drag
      if (!hasDraggedRef.current && dragStartScreenPos.current) {
        const dx = Math.abs(e.clientX - dragStartScreenPos.current.x);
        const dy = Math.abs(e.clientY - dragStartScreenPos.current.y);
        if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) {
          // Haven't moved enough yet, don't update position
          return;
        }
        // Threshold exceeded, now it's a real drag
        hasDraggedRef.current = true;
      }

      // Convert screen position to world position
      const worldPos = screenToWorld({ x: e.clientX, y: e.clientY });

      // Check if this card is part of a multi-selection
      if (
        isSelected &&
        selectedCardIds &&
        selectedCardIds.size > 1 &&
        onMoveSelectedCards
      ) {
        // Multi-card drag: calculate delta from last position
        if (lastWorldPosRef.current) {
          const deltaX = worldPos.x - lastWorldPosRef.current.x;
          const deltaY = worldPos.y - lastWorldPosRef.current.y;
          onMoveSelectedCards(deltaX, deltaY);
        }
        lastWorldPosRef.current = worldPos;
      } else {
        // Single card drag: apply offset
        const x = worldPos.x - dragOffset.current.x;
        const y = worldPos.y - dragOffset.current.y;
        onMove(card.id, x, y);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];

        // Check drag threshold for touch
        if (!hasDraggedRef.current && dragStartScreenPos.current) {
          const dx = Math.abs(touch.clientX - dragStartScreenPos.current.x);
          const dy = Math.abs(touch.clientY - dragStartScreenPos.current.y);
          if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) {
            return;
          }
          hasDraggedRef.current = true;
        }

        // Convert screen position to world position
        const worldPos = screenToWorld({ x: touch.clientX, y: touch.clientY });

        // Check if this card is part of a multi-selection
        if (
          isSelected &&
          selectedCardIds &&
          selectedCardIds.size > 1 &&
          onMoveSelectedCards
        ) {
          // Multi-card drag: calculate delta from last position
          if (lastWorldPosRef.current) {
            const deltaX = worldPos.x - lastWorldPosRef.current.x;
            const deltaY = worldPos.y - lastWorldPosRef.current.y;
            onMoveSelectedCards(deltaX, deltaY);
          }
          lastWorldPosRef.current = worldPos;
        } else {
          // Single card drag: apply offset
          const x = worldPos.x - dragOffset.current.x;
          const y = worldPos.y - dragOffset.current.y;
          onMove(card.id, x, y);
        }
      }
    };

    const handleEnd = () => {
      setIsDragging(false);
      dragStartScreenPos.current = null;
      lastWorldPosRef.current = null;

      // Only persist if we actually dragged (moved the card)
      if (
        hasDraggedRef.current &&
        (card.x !== startPos.current.x || card.y !== startPos.current.y)
      ) {
        // Check if this was a multi-card drag
        if (
          isSelected &&
          selectedCardIds &&
          selectedCardIds.size > 1 &&
          onPersistMultiMove
        ) {
          onPersistMultiMove();
        } else {
          onPersistMove(card.id, card.x, card.y);
        }
      }

      hasDraggedRef.current = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [
    isDragging,
    card.id,
    card.x,
    card.y,
    onMove,
    onPersistMove,
    screenToWorld,
    isSelected,
    selectedCardIds,
    onMoveSelectedCards,
    onPersistMultiMove,
  ]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onType(card.id, e.target.value);
  };

  const handleContentBlur = () => {
    setIsEditing(false);
    onPersistContent(card.id, card.content);
  };

  const handleContentKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      setIsEditing(false);
      onPersistContent(card.id, card.content);
    }
  };

  const handleColorChange = (color: string) => {
    onChangeColor(card.id, color);
    onPersistColor(card.id, color);
  };

  const handleDelete = () => {
    onDelete(card.id);
    onPersistDelete(card.id);
  };

  const handleDuplicate = () => {
    if (onDuplicate) {
      onDuplicate(card);
    }
  };

  const handleVote = () => {
    if (allowVote) {
      onVote(card.id);
    }
  };

  const handleReact = (emoji: string) => {
    if (allowReact) {
      onReact(card.id, emoji);
    }
  };

  const handleRefine = async () => {
    if (!card.content.trim() || isRefining || !allowRefine) return;

    const contentBeforeRefine = card.content;
    setIsRefining(true);
    try {
      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: card.content,
          cardId: card.id,
          userId: visitorId,
        }),
      });

      if (res.ok) {
        const { refined } = await res.json();
        if (refined && refined.trim()) {
          setPreviousContent(contentBeforeRefine);
          onType(card.id, refined);
          onPersistContent(card.id, refined);
        }
      }
    } catch {
    } finally {
      setIsRefining(false);
    }
  };

  const handleUndo = () => {
    if (previousContent !== null) {
      onType(card.id, previousContent);
      onPersistContent(card.id, previousContent);
      setPreviousContent(null);
    }
  };

  const showRefineButton = allowRefine && card.content.trim().length > 10;
  const showUndoButton = allowEdit && previousContent !== null;

  const handleCopy = async () => {
    if (!card.content.trim()) return;
    try {
      await navigator.clipboard.writeText(card.content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Clipboard API might not be available
    }
  };

  const getCursorStyle = () => {
    if (!allowMove) return "default";
    if (isDragging) return "grabbing";
    return "grab";
  };

  const isPurpleCard =
    card.color === LIGHT_COLORS[0] || card.color === DARK_COLORS[0];
  const isPurpleDark = isPurpleCard && isDark;
  const textColorClass = isPurpleDark ? "text-white" : "text-stone-800";
  const mutedTextClass = isPurpleDark ? "text-white/70" : "text-stone-600";
  const borderClass = isPurpleDark ? "border-white/20" : "border-stone-900/10";
  const iconClass = isPurpleDark ? "text-white/80" : "text-stone-500";
  const iconActiveClass = isPurpleDark ? "text-white" : "text-stone-700";
  const hoverBgClass = isPurpleDark
    ? "hover:bg-white/15"
    : "hover:bg-stone-900/8";
  const actionsBgClass = isDark
    ? isMobile
      ? "bg-black/10"
      : "bg-transparent group-hover:bg-black/10"
    : isMobile
      ? "bg-stone-900/5"
      : "bg-transparent group-hover:bg-stone-900/5";

  return (
    <motion.div
      ref={cardRef}
      data-card
      className={`absolute group touch-none select-none transition-[width] duration-200 ${
        isExpanded ? "w-72 sm:w-96" : "w-40 sm:w-56"
      }`}
      initial={{ x: card.x, y: card.y }}
      animate={{ x: card.x, y: card.y }}
      transition={{
        type: "spring",
        damping: 30,
        mass: 0.8,
        stiffness: 350,
      }}
      style={{
        zIndex: isDragging ? 1000 : isExpanded ? 100 : 1,
        pointerEvents: isSpacePressed ? "none" : "auto",
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <div
        className={`rounded-lg shadow-lg transition-shadow hover:shadow-xl relative overflow-hidden ${
          isSelected ? "ring-2 ring-offset-2 ring-primary" : ""
        }`}
        style={{ backgroundColor: displayColor }}
      >
        {/* Cat silhouette background based on card creator's avatar */}
        <div
          className="absolute bottom-1 right-1 w-16 h-16 sm:w-20 sm:h-20 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage: `url(${creatorAvatar})`,
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "bottom right",
          }}
        />
        <div
          className={`flex items-center justify-between px-2.5 py-1.5 sm:px-3 sm:py-2 border-b ${borderClass}`}
          style={{
            cursor: getCursorStyle(),
          }}
        >
          <GripVertical
            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${iconClass} ${
              isPurpleDark ? "opacity-70" : isDark ? "opacity-50" : "opacity-40"
            }`}
          />
          <TooltipProvider delayDuration={400}>
            <div
              className={`flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1 rounded-md ${actionsBgClass} transition-all duration-200`}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              {allowChangeColor && (
                <Popover>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 ${
                            isDark ? "border-white/30" : "border-black/20"
                          } ${
                            isMobile
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100"
                          } transition-all cursor-pointer hover:scale-110 hover:border-black/40`}
                          style={{ backgroundColor: displayColor }}
                        />
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Color</TooltipContent>
                  </Tooltip>
                  <PopoverContent
                    className="w-auto p-2 z-1001"
                    align="end"
                    sideOffset={5}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex gap-1.5 sm:gap-2">
                      {colors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 hover:scale-110 transition-all cursor-pointer"
                          style={{
                            backgroundColor: color,
                            borderColor:
                              displayColor === color
                                ? "rgba(0,0,0,0.5)"
                                : "transparent",
                          }}
                          onClick={() => handleColorChange(color)}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              {showUndoButton && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.button
                      type="button"
                      onClick={handleUndo}
                      whileTap={{ scale: 0.9 }}
                      whileHover={{ scale: 1.1 }}
                      className={`p-1 sm:p-1.5 rounded-md ${
                        isMobile
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                      } ${hoverBgClass} transition-all cursor-pointer`}
                    >
                      <Undo2
                        className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${iconClass} group-hover:${iconActiveClass}`}
                      />
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Undo</TooltipContent>
                </Tooltip>
              )}
              {showRefineButton && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.button
                      type="button"
                      onClick={handleRefine}
                      disabled={isRefining}
                      whileTap={{ scale: 0.9 }}
                      whileHover={{ scale: 1.1 }}
                      className={`p-1 sm:p-1.5 rounded-md ${
                        isMobile
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                      } ${hoverBgClass} transition-all cursor-pointer disabled:cursor-wait`}
                    >
                      {isRefining ? (
                        <Loader2
                          className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${iconClass} animate-spin`}
                        />
                      ) : (
                        <Sparkles
                          className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${iconClass}`}
                        />
                      )}
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Refine with AI</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.1 }}
                    className={`p-1 sm:p-1.5 rounded-md ${
                      isMobile
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    } ${hoverBgClass} transition-all cursor-pointer`}
                  >
                    {isExpanded ? (
                      <Minimize2
                        className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${iconClass}`}
                      />
                    ) : (
                      <Maximize2
                        className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${iconClass}`}
                      />
                    )}
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {isExpanded ? "Collapse" : "Expand"}
                </TooltipContent>
              </Tooltip>
              {onDuplicate && allowEdit && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.button
                      type="button"
                      onClick={handleDuplicate}
                      whileTap={{ scale: 0.9 }}
                      whileHover={{ scale: 1.1 }}
                      className={`p-1 sm:p-1.5 rounded-md ${
                        isMobile
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                      } ${hoverBgClass} transition-all cursor-pointer`}
                    >
                      <CopyPlus
                        className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${iconClass}`}
                      />
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Duplicate</TooltipContent>
                </Tooltip>
              )}
              {allowDelete && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.button
                      type="button"
                      onClick={handleDelete}
                      whileTap={{ scale: 0.9 }}
                      whileHover={{ scale: 1.1 }}
                      className={`p-1 sm:p-1.5 rounded-md ${
                        isMobile
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                      } ${hoverBgClass} transition-all cursor-pointer`}
                    >
                      <X className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${iconClass}`} />
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Delete</TooltipContent>
                </Tooltip>
              )}
            </div>
          </TooltipProvider>
        </div>
        <div
          className="p-2.5 sm:p-3.5 relative transition-all duration-200"
          style={
            isEditing
              ? { boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.08)" }
              : undefined
          }
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {isEditing ? (
            <Textarea
              autoFocus
              value={card.content}
              onChange={handleContentChange}
              onBlur={handleContentBlur}
              onKeyDown={handleContentKeyDown}
              className={`resize-none !bg-transparent dark:!bg-transparent border-none p-0 leading-relaxed shadow-none ${
                isExpanded
                  ? "text-[13px] sm:text-[15px]"
                  : "text-[11px] sm:text-[13px]"
              } ${textColorClass} focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:${mutedTextClass} overflow-y-auto transition-all duration-200 w-full h-full ${
                isExpanded
                  ? "min-h-30 sm:min-h-50 max-h-75 sm:max-h-100"
                  : "min-h-15 sm:min-h-20 max-h-30 sm:max-h-40"
              }`}
              placeholder="Type your idea..."
            />
          ) : (
            <div
              onClick={() => allowEdit && setIsEditing(true)}
              className={`overflow-y-auto leading-relaxed ${
                isExpanded
                  ? "text-[13px] sm:text-[15px]"
                  : "text-[11px] sm:text-[13px]"
              } ${textColorClass} ${
                allowEdit ? "cursor-text" : "cursor-default"
              } transition-all duration-200 ${
                isExpanded
                  ? "min-h-30 sm:min-h-50 max-h-75 sm:max-h-100"
                  : "min-h-15 sm:min-h-20 max-h-30 sm:max-h-40"
              }`}
            >
              {card.content ? (
                <Markdown
                  components={{
                    p: ({ children }) => (
                      <p className="mb-2 last:mb-0 leading-relaxed">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside mb-2 last:mb-0 space-y-1">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside mb-2 last:mb-0 space-y-1">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="leading-relaxed">{children}</li>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-stone-900">
                        {children}
                      </strong>
                    ),
                    em: ({ children }) => (
                      <em className="italic text-stone-700">{children}</em>
                    ),
                    code: ({ children }) => (
                      <code className="px-1.5 py-0.5 rounded text-[10px] sm:text-xs bg-stone-900/8 text-stone-700 font-mono">
                        {children}
                      </code>
                    ),
                    h1: ({ children }) => (
                      <h1 className="font-bold text-sm sm:text-base mb-1.5 text-stone-900">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="font-bold text-[13px] sm:text-sm mb-1.5 text-stone-900">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="font-semibold text-xs sm:text-[13px] mb-1 text-stone-800">
                        {children}
                      </h3>
                    ),
                  }}
                >
                  {card.content}
                </Markdown>
              ) : (
                <span className={mutedTextClass}>
                  {allowEdit
                    ? isMobile
                      ? "Tap to edit..."
                      : "Click to add idea..."
                    : "No content yet"}
                </span>
              )}
            </div>
          )}
          {card.content && !isEditing && (
            <TooltipProvider delayDuration={400}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    type="button"
                    onClick={handleCopy}
                    initial={{ opacity: 0 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`absolute bottom-2 right-2 p-1.5 rounded-md ${
                      isMobile
                        ? "opacity-70"
                        : "opacity-0 group-hover:opacity-70"
                    } hover:opacity-100 ${hoverBgClass} transition-all cursor-pointer`}
                  >
                    <AnimatePresence mode="wait">
                      {isCopied ? (
                        <motion.div
                          key="check"
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.5, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-500" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="copy"
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.5, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          <Copy
                            className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${iconClass}`}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {isCopied ? "Copied!" : "Copy"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {Object.keys(card.reactions).length > 0 && (
          <div
            className={`flex flex-wrap gap-1 px-2.5 sm:px-3.5 py-1.5 border-t ${borderClass}`}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            {Object.entries(card.reactions).map(([emoji, userIds]) => {
              const hasReacted = userIds.includes(visitorId);
              return (
                <motion.button
                  key={emoji}
                  type="button"
                  onClick={() => handleReact(emoji)}
                  disabled={!allowReact && !hasReacted}
                  whileTap={{ scale: 0.9 }}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] sm:text-[11px] transition-all ${
                    hasReacted
                      ? "bg-stone-900/15 cursor-pointer"
                      : allowReact
                        ? `${hoverBgClass} cursor-pointer`
                        : "opacity-50 cursor-default"
                  }`}
                >
                  <span>{emoji}</span>
                  <span className={`font-medium ${mutedTextClass}`}>
                    {userIds.length}
                  </span>
                </motion.button>
              );
            })}
          </div>
        )}
        <div
          className={`flex items-center justify-between px-2.5 sm:px-3.5 py-2 sm:py-2.5 border-t ${borderClass}`}
          style={{
            cursor: getCursorStyle(),
          }}
        >
          <div className="flex items-center gap-1 sm:gap-1.5">
            <Image
              src={getAvatarForUser(card.createdById)}
              alt={`${creatorName}'s avatar`}
              width={16}
              height={16}
              className="w-4 h-4 sm:w-5 sm:h-5"
              draggable={false}
            />
            <span
              className={`text-[10px] sm:text-[11px] ${mutedTextClass} truncate max-w-13.75 sm:max-w-20 font-medium`}
            >
              {creatorName}
            </span>
          </div>
          <TooltipProvider delayDuration={400}>
            <div
              className="flex items-center gap-1 sm:gap-1.5"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              {allowReact && (
                <Popover>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.9 }}
                          whileHover={{ scale: 1.1 }}
                          className={`p-0.5 sm:p-1 rounded-full ${
                            isMobile
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100"
                          } ${hoverBgClass} transition-all cursor-pointer`}
                        >
                          <Smile
                            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${iconClass}`}
                          />
                        </motion.button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top">React</TooltipContent>
                  </Tooltip>
                  <PopoverContent
                    className="w-auto p-1.5 z-1001"
                    align="end"
                    sideOffset={5}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex gap-1">
                      {REACTION_EMOJIS.map((emoji) => {
                        const hasReacted =
                          card.reactions[emoji]?.includes(visitorId) || false;
                        return (
                          <motion.button
                            key={emoji}
                            type="button"
                            onClick={() => handleReact(emoji)}
                            whileTap={{ scale: 0.85 }}
                            whileHover={{ scale: 1.15 }}
                            className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-md text-base sm:text-lg transition-all cursor-pointer ${
                              hasReacted
                                ? "bg-stone-900/15"
                                : "hover:bg-stone-100 dark:hover:bg-stone-800"
                            }`}
                          >
                            {emoji}
                          </motion.button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              <span
                className={`text-[10px] sm:text-[11px] font-semibold tabular-nums ${mutedTextClass}`}
              >
                <NumberFlow
                  value={card.votes}
                  format={{ notation: "compact" }}
                />
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    type="button"
                    whileTap={allowVote ? { scale: 0.85 } : undefined}
                    onClick={handleVote}
                    disabled={!allowVote}
                    className={`p-0.5 sm:p-1 rounded-full transition-all ${
                      !allowVote
                        ? "opacity-30 cursor-not-allowed"
                        : hasVoted
                          ? isPurpleDark
                            ? "bg-white/20 text-white"
                            : "bg-stone-900/15 text-stone-800"
                          : `${hoverBgClass} cursor-pointer`
                    }`}
                  >
                    <ChevronUp
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                        hasVoted
                          ? isPurpleDark
                            ? "text-white"
                            : "text-stone-800"
                          : iconClass
                      }`}
                    />
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {isOwnCard
                    ? "Can't vote on your own"
                    : session.isLocked
                      ? "Session is locked"
                      : hasVoted
                        ? "Remove vote"
                        : "Vote"}
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      </div>
    </motion.div>
  );
}
