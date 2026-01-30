"use client";

import { Check, CheckCheck, Trash2, X } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SessionRole, ThreadWithDetails } from "@/db/schema";
import { useThreadColors } from "@/hooks/use-thread-colors";
import {
  canDeleteComment,
  canDeleteThread,
  canResolveThread,
} from "@/lib/thread-permissions";
import { cn } from "@/lib/utils";
import { Comment } from "./comment";
import { CommentInput } from "./comment-input";

interface ThreadPanelProps {
  thread: ThreadWithDetails;
  currentUserId: string;
  userRole: SessionRole | null;
  onAddComment: (content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onResolve: (resolved: boolean) => Promise<void>;
  onDeleteThread: () => Promise<void>;
  onClose: () => void;
  disabled?: boolean;
}

export function ThreadPanel({
  thread,
  currentUserId,
  userRole,
  onAddComment,
  onDeleteComment,
  onResolve,
  onDeleteThread,
  onClose,
  disabled = false,
}: ThreadPanelProps) {
  const colors = useThreadColors();
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(
    null,
  );
  const [isResolving, setIsResolving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      setDeletingCommentId(commentId);
      try {
        await onDeleteComment(commentId);
      } finally {
        setDeletingCommentId(null);
      }
    },
    [onDeleteComment],
  );

  const handleResolve = useCallback(async () => {
    setIsResolving(true);
    try {
      await onResolve(!thread.isResolved);
    } finally {
      setIsResolving(false);
    }
  }, [onResolve, thread.isResolved]);

  const handleDelete = useCallback(async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete this thread and all its comments?",
      )
    ) {
      return;
    }
    setIsDeleting(true);
    try {
      await onDeleteThread();
    } finally {
      setIsDeleting(false);
    }
  }, [onDeleteThread]);

  const handleAddComment = useCallback(
    async (content: string) => {
      await onAddComment(content);
    },
    [onAddComment],
  );

  // Scroll to bottom when new comments are added
  const commentCount = thread.comments.length;
  // biome-ignore lint/correctness/useExhaustiveDependencies: Intentionally trigger scroll when comment count changes
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]",
    );
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [commentCount]);

  const showResolve = canResolveThread(thread, currentUserId, userRole);
  const showDelete = canDeleteThread(thread, currentUserId, userRole);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -8 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
      }}
      className="flex flex-col h-full max-h-[420px] w-[340px] rounded-xl border overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        boxShadow: colors.shadowElevated,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 border-b"
        style={{
          borderColor: colors.divider,
          backgroundColor: colors.surfaceHover,
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-semibold"
            style={{ color: colors.textPrimary }}
          >
            Comment
          </span>
          {thread.isResolved && (
            <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full font-medium">
              <CheckCheck className="h-3 w-3" />
              Resolved
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {showResolve && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-lg transition-colors",
                thread.isResolved
                  ? "text-green-600 hover:text-green-700 hover:bg-green-500/10"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={handleResolve}
              disabled={isResolving || disabled}
              title={thread.isResolved ? "Unresolve" : "Mark as resolved"}
            >
              {thread.isResolved ? (
                <CheckCheck className="h-4 w-4" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
          )}
          {showDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              onClick={handleDelete}
              disabled={isDeleting || disabled}
              title="Delete thread"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Comments */}
      <ScrollArea ref={scrollAreaRef} className="flex-1">
        <div className="p-3 space-y-0">
          {thread.comments.map((comment, index) => (
            <Comment
              key={comment.id}
              comment={comment}
              canDelete={canDeleteComment(comment, currentUserId, userRole)}
              onDelete={() => handleDeleteComment(comment.id)}
              isDeleting={deletingCommentId === comment.id}
              isLast={index === thread.comments.length - 1}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div
        className="px-3 py-2.5 border-t"
        style={{
          borderColor: colors.divider,
          backgroundColor: colors.surface,
        }}
      >
        <CommentInput
          onSubmit={handleAddComment}
          disabled={disabled}
          placeholder="Reply..."
        />
      </div>
    </motion.div>
  );
}
