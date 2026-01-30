"use client";

import { CheckCheck, CreditCard, MessageCircle } from "lucide-react";
import { motion } from "motion/react";
import type { ThreadWithDetails } from "@/db/schema";
import { useThreadColors } from "@/hooks/use-thread-colors";
import { cn, getAvatarForUser } from "@/lib/utils";

interface ThreadListItemProps {
  thread: ThreadWithDetails;
  onClick: () => void;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function ThreadListItem({ thread, onClick }: ThreadListItemProps) {
  const colors = useThreadColors();

  // Get the first comment for preview
  const firstComment = thread.comments[0];
  const commentCount = thread.comments.length;

  // Get the latest activity time
  const latestComment = thread.comments[thread.comments.length - 1];
  const latestTime = latestComment
    ? new Date(latestComment.createdAt)
    : new Date(thread.createdAt);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ backgroundColor: colors.surfaceHover }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "w-full flex items-start gap-3 p-3 text-left transition-colors rounded-lg",
        thread.isResolved && "opacity-60",
      )}
      style={{ backgroundColor: "transparent" }}
    >
      {/* Creator Avatar */}
      {/* biome-ignore lint/performance/noImgElement: External avatar URL from DiceBear API */}
      <img
        src={getAvatarForUser(thread.creator.id)}
        alt={thread.creator.username || "User"}
        className="h-8 w-8 rounded-full shrink-0"
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span
            className="text-sm font-medium truncate"
            style={{ color: colors.textPrimary }}
          >
            {thread.creator.username || "Anonymous"}
          </span>
          <span
            className="text-xs shrink-0"
            style={{ color: colors.textSecondary }}
          >
            {formatRelativeTime(latestTime)}
          </span>
        </div>

        {/* Comment preview */}
        <p
          className="text-sm line-clamp-2"
          style={{ color: colors.textSecondary }}
        >
          {firstComment?.content || "No comments yet"}
        </p>

        {/* Footer with badges */}
        <div className="flex items-center gap-2 mt-1.5">
          {/* Comment count */}
          {commentCount > 1 && (
            <span
              className="inline-flex items-center gap-1 text-xs"
              style={{ color: colors.textSecondary }}
            >
              <MessageCircle className="h-3 w-3" />
              {commentCount}
            </span>
          )}

          {/* Card attachment indicator */}
          {thread.cardId && (
            <span
              className="inline-flex items-center gap-1 text-xs"
              style={{ color: colors.textSecondary }}
            >
              <CreditCard className="h-3 w-3" />
              On card
            </span>
          )}

          {/* Resolved indicator */}
          {thread.isResolved && (
            <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <CheckCheck className="h-3 w-3" />
              Resolved
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}
