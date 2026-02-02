"use client";

import { MessageCircle } from "lucide-react";
import { motion } from "motion/react";
import type { ThreadWithDetails } from "@/db/schema";
import { useThreadColors } from "@/hooks/use-thread-colors";
import { formatRelativeTime, getAvatarForUser } from "@/lib/utils";

interface ThreadTooltipProps {
  thread: ThreadWithDetails;
}

export function ThreadTooltip({ thread }: ThreadTooltipProps) {
  const colors = useThreadColors();
  const latestComment = thread.comments[thread.comments.length - 1];
  const replyCount = thread.comments.length - 1;

  if (!latestComment) return null;

  // Truncate content - shorter for compact preview
  const truncatedContent =
    latestComment.content.length > 80
      ? `${latestComment.content.slice(0, 80)}...`
      : latestComment.content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="w-[260px] p-3 rounded-xl border"
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        boxShadow: colors.shadowElevated,
      }}
    >
      {/* Header: Avatar + Name + Time */}
      <div className="flex items-center gap-2.5 mb-2">
        <div className="relative shrink-0">
          {/* biome-ignore lint/performance/noImgElement: External avatar URL from DiceBear API */}
          <img
            src={getAvatarForUser(latestComment.createdById)}
            alt={latestComment.creatorUsername}
            className="h-8 w-8 rounded-full bg-muted"
            style={{
              boxShadow: `0 0 0 2px ${colors.avatarRingMedium}`,
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="font-medium text-sm truncate"
              style={{ color: colors.textPrimary }}
            >
              {latestComment.creatorUsername}
            </span>
            <span
              className="text-xs shrink-0"
              style={{ color: colors.textSecondary }}
            >
              {formatRelativeTime(new Date(latestComment.createdAt))}
            </span>
          </div>
        </div>
      </div>

      {/* Content Preview */}
      <p
        className="text-sm leading-relaxed line-clamp-2 mb-2"
        style={{ color: colors.textPrimary, opacity: 0.9 }}
      >
        {truncatedContent}
      </p>

      {/* Footer: Reply count */}
      {replyCount > 0 && (
        <div
          className="flex items-center gap-1.5 pt-2 border-t"
          style={{ borderColor: colors.divider }}
        >
          <MessageCircle
            className="h-3.5 w-3.5"
            style={{ color: colors.textSecondary }}
          />
          <span
            className="text-xs font-medium"
            style={{ color: colors.textSecondary }}
          >
            {replyCount} {replyCount === 1 ? "reply" : "replies"}
          </span>
        </div>
      )}
    </motion.div>
  );
}
