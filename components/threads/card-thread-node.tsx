"use client";

import { useCallback, useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SessionRole, ThreadWithDetails } from "@/db/schema";
import type { CardThreadHandlers } from "@/lib/react-flow-utils";
import { cn } from "@/lib/utils";
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
 */
export function CardThreadNode({
  thread,
  userRole,
  visitorId,
  sessionLocked,
  handlers,
}: CardThreadNodeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  // Destructure handlers to avoid dependency on entire handlers object
  const {
    onAddComment,
    onDeleteComment,
    onResolve,
    onDeleteThread,
    onDetach,
    screenToFlowPosition,
  } = handlers;

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
  }, [onDeleteThread, thread.id]);

  // Check if detach is supported
  const canDetach = !sessionLocked && onDetach;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!canDetach) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      setIsOpen(false); // Close popover when starting drag
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
      } else if (!moved && !sessionLocked) {
        // Short click without movement - open popover
        setIsOpen(true);
      }

      setIsDragging(false);
      setDragOffset({ x: 0, y: 0 });
      dragStartRef.current = null;
    },
    [
      isDragging,
      dragOffset,
      onDetach,
      screenToFlowPosition,
      thread.id,
      sessionLocked,
    ],
  );

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
      <Popover open={isOpen && !isDragging} onOpenChange={setIsOpen}>
        <TooltipProvider delayDuration={400}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <div
                  className="relative"
                  onPointerDown={canDetach ? handlePointerDown : undefined}
                >
                  <ThreadBubble
                    thread={thread}
                    isSelected={isOpen || isDragging}
                    onClick={canDetach ? undefined : () => setIsOpen(true)}
                  />
                </div>
              </PopoverTrigger>
            </TooltipTrigger>
            {!isOpen && !isDragging && (
              <TooltipContent
                side="top"
                className="p-0 bg-transparent border-none shadow-none"
              >
                <ThreadTooltip thread={thread} />
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <PopoverContent
          className="w-auto p-0 z-[1001] bg-transparent border-none shadow-none"
          align="start"
          side="right"
          sideOffset={12}
        >
          <ThreadPanel
            thread={thread}
            currentUserId={visitorId}
            userRole={userRole}
            onAddComment={handleAddComment}
            onDeleteComment={handleDeleteComment}
            onResolve={handleResolve}
            onDeleteThread={handleDeleteThread}
            onClose={() => setIsOpen(false)}
            disabled={sessionLocked}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
