"use client";

import type { Node } from "@xyflow/react";
import { useCallback, useEffect, useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { SessionRole, ThreadWithDetails } from "@/db/schema";
import { useThreadFocusStore } from "@/stores/thread-focus-store";
import { ThreadBubble } from "./thread-bubble";
import { ThreadPanel } from "./thread-panel";
import { ThreadTooltip } from "./thread-tooltip";

export interface ThreadNodeData extends Record<string, unknown> {
  thread: ThreadWithDetails;
  userRole: SessionRole | null;
  visitorId: string;
  sessionLocked: boolean;
  collisionBoundary?: Element | Element[] | null;
  onAddComment: (threadId: string, content: string) => Promise<void>;
  onDeleteComment: (threadId: string, commentId: string) => Promise<void>;
  onResolve: (threadId: string, isResolved: boolean) => Promise<void>;
  onDeleteThread: (threadId: string) => Promise<void>;
}

export type ThreadNodeType = Node<ThreadNodeData, "thread">;

interface ThreadNodeProps {
  data: ThreadNodeData;
  selected?: boolean;
}

export function ThreadNode({ data, selected }: ThreadNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  // Track if we're closing from expanded state to prevent tooltip flash
  const [wasExpanded, setWasExpanded] = useState(false);

  // Subscribe to focused thread from store
  const focusedThreadId = useThreadFocusStore((s) => s.focusedThreadId);
  const clearFocusedThread = useThreadFocusStore((s) => s.clearFocusedThread);

  // Destructure specific values to avoid dependency on entire data object
  const { thread, onAddComment, onDeleteComment, onResolve, onDeleteThread } =
    data;

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

  const handleOpenChange = useCallback(
    (open: boolean) => {
      // When expanded, only close via explicit close button
      if (!open && isExpanded) {
        return;
      }
      setIsOpen(open);
      if (!open) {
        setIsExpanded(false);
      }
      if (open) {
        // Reset wasExpanded when opening via hover
        setWasExpanded(false);
      }
    },
    [isExpanded],
  );

  const handleExpand = useCallback(() => {
    setIsExpanded(true);
    setWasExpanded(false);
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    // Mark that we're closing from expanded to prevent tooltip flash
    setWasExpanded(true);
    setIsExpanded(false);
    setIsOpen(false);
  }, []);

  return (
    <HoverCard
      open={isOpen}
      onOpenChange={handleOpenChange}
      openDelay={150}
      closeDelay={isExpanded ? 999999 : 100}
    >
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="cursor-pointer z-50"
          onClick={handleExpand}
        >
          <ThreadBubble thread={data.thread} isSelected={selected || isOpen} />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        className="p-0 bg-transparent border-none shadow-none w-auto"
        side="right"
        align="start"
        sideOffset={12}
        collisionBoundary={data.collisionBoundary}
        collisionPadding={16}
      >
        {isExpanded ? (
          <ThreadPanel
            thread={data.thread}
            currentUserId={data.visitorId}
            userRole={data.userRole}
            onAddComment={handleAddComment}
            onDeleteComment={handleDeleteComment}
            onResolve={handleResolve}
            onDeleteThread={handleDeleteThread}
            onClose={handleClose}
            disabled={data.sessionLocked}
          />
        ) : wasExpanded ? null : (
          <button
            type="button"
            onClick={handleExpand}
            className="cursor-pointer text-left"
          >
            <ThreadTooltip thread={data.thread} />
          </button>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
