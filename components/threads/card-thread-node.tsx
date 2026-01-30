"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { SessionRole, ThreadWithDetails } from "@/db/schema";
import type { CardThreadHandlers } from "@/lib/react-flow-utils";
import { cn } from "@/lib/utils";
import { useThreadFocusStore } from "@/stores/thread-focus-store";
import { ThreadBubble } from "./thread-bubble";
import { ThreadPanel } from "./thread-panel";
import { ThreadTooltip } from "./thread-tooltip";

interface CardThreadNodeProps {
  thread: ThreadWithDetails;
  userRole: SessionRole | null;
  visitorId: string;
  sessionLocked: boolean;
  handlers: CardThreadHandlers;
}

/**
 * A thread node rendered inside a card (for card-attached threads).
 * Similar to ThreadNode but without React Flow node wrapper.
 * Supports click-and-drag to detach from card.
 * Uses HoverCard with expand state: hover shows preview, click expands to full panel.
 */
export function CardThreadNode({
  thread,
  userRole,
  visitorId,
  sessionLocked,
  handlers,
}: CardThreadNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  // Track if we're closing from expanded state to prevent tooltip flash
  const [wasExpanded, setWasExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  // Subscribe to focused thread from store
  const focusedThreadId = useThreadFocusStore((s) => s.focusedThreadId);
  const clearFocusedThread = useThreadFocusStore((s) => s.clearFocusedThread);

  // Destructure handlers to avoid dependency on entire handlers object
  const {
    onAddComment,
    onDeleteComment,
    onResolve,
    onDeleteThread,
    onDetach,
    screenToFlowPosition,
  } = handlers;

  // Auto-expand when this thread is focused from sidebar
  useEffect(() => {
    if (focusedThreadId === thread.id) {
      setIsExpanded(true);
      setWasExpanded(false);
      setIsOpen(true);
      clearFocusedThread(); // Clear to prevent re-triggering
    }
  }, [focusedThreadId, thread.id, clearFocusedThread]);

  const handleAddComment = useCallback(
    async (content: string) => {
      await onAddComment(thread.id, content);
    },
    [onAddComment, thread.id],
  );

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      await onDeleteComment(thread.id, commentId);
    },
    [onDeleteComment, thread.id],
  );

  const handleResolve = useCallback(
    async (isResolved: boolean) => {
      await onResolve(thread.id, isResolved);
    },
    [onResolve, thread.id],
  );

  const handleDeleteThread = useCallback(async () => {
    await onDeleteThread(thread.id);
    setIsOpen(false);
    setIsExpanded(false);
  }, [onDeleteThread, thread.id]);

  // Check if detach is supported
  const canDetach = !sessionLocked && onDetach;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!canDetach) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      setIsOpen(false);
      setIsExpanded(false);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [canDetach],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !dragStartRef.current) return;

      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;
      setDragOffset({ x: deltaX, y: deltaY });
    },
    [isDragging],
  );

  const handlePointerUp = useCallback(
    async (e: React.PointerEvent) => {
      if (!isDragging) return;

      // Release pointer capture
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);

      // Check if actually dragged (not just a click)
      const moveThreshold = 10;
      const moved =
        Math.abs(dragOffset.x) > moveThreshold ||
        Math.abs(dragOffset.y) > moveThreshold;

      if (moved && onDetach && screenToFlowPosition) {
        // Convert cursor screen position to flow coordinates
        const flowPos = screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });
        await onDetach(thread.id, flowPos);
      }
      // If not moved, we don't force open here.
      // The HoverCard will handle hover/click naturally.

      setIsDragging(false);
      setDragOffset({ x: 0, y: 0 });
      dragStartRef.current = null;
    },
    [isDragging, dragOffset, onDetach, screenToFlowPosition, thread.id],
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      // Don't change state while dragging
      if (isDragging) return;
      // When expanded, only close via explicit close button
      if (!open && isExpanded) return;
      setIsOpen(open);
      if (!open) {
        setIsExpanded(false);
      }
      if (open) {
        // Reset wasExpanded when opening via hover
        setWasExpanded(false);
      }
    },
    [isDragging, isExpanded],
  );

  const handleExpand = useCallback(() => {
    if (!isDragging && !sessionLocked) {
      setIsExpanded(true);
      setWasExpanded(false);
      setIsOpen(true);
    }
  }, [isDragging, sessionLocked]);

  const handleClose = useCallback(() => {
    // Mark that we're closing from expanded to prevent tooltip flash
    setWasExpanded(true);
    setIsExpanded(false);
    setIsOpen(false);
  }, []);

  return (
    <div
      className={cn(
        "cursor-pointer nodrag nopan relative",
        isDragging && "z-[9999] cursor-grabbing",
      )}
      style={
        isDragging
          ? {
              transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
            }
          : undefined
      }
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <HoverCard
        open={isOpen && !isDragging}
        onOpenChange={handleOpenChange}
        openDelay={150}
        closeDelay={isExpanded ? 999999 : 100}
      >
        <HoverCardTrigger asChild>
          <button
            type="button"
            className="relative"
            onPointerDown={canDetach ? handlePointerDown : undefined}
            onClick={handleExpand}
          >
            <ThreadBubble thread={thread} isSelected={isOpen || isDragging} />
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          className="p-0 bg-transparent border-none shadow-none w-auto z-[1001]"
          side="right"
          align="start"
          sideOffset={12}
        >
          {isExpanded ? (
            <ThreadPanel
              thread={thread}
              currentUserId={visitorId}
              userRole={userRole}
              onAddComment={handleAddComment}
              onDeleteComment={handleDeleteComment}
              onResolve={handleResolve}
              onDeleteThread={handleDeleteThread}
              onClose={handleClose}
              disabled={sessionLocked}
            />
          ) : wasExpanded ? null : (
            <button
              type="button"
              onClick={handleExpand}
              className="cursor-pointer text-left"
            >
              <ThreadTooltip thread={thread} />
            </button>
          )}
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}
