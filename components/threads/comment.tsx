"use client";

import { Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import type { CommentWithCreator } from "@/db/schema";
import { useThreadColors } from "@/hooks/use-thread-colors";
import { cn, formatRelativeTime, getAvatarForUser } from "@/lib/utils";

interface CommentProps {
  comment: CommentWithCreator;
  canDelete: boolean;
  onDelete: () => void;
  isDeleting?: boolean;
  isLast?: boolean;
}

// Memoize to prevent re-renders when sibling comments change
export const Comment = memo(function Comment({
  comment,
  canDelete,
  onDelete,
  isDeleting = false,
  isLast = false,
}: CommentProps) {
  const colors = useThreadColors();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 500,
        damping: 30,
      }}
      className={cn(
        "group flex gap-3 py-3 transition-opacity",
        !isLast && "border-b",
        isDeleting && "opacity-50 pointer-events-none",
      )}
      style={!isLast ? { borderColor: colors.divider } : undefined}
    >
      {/* Avatar with presence ring */}
      <div className="relative shrink-0">
        {/* biome-ignore lint/performance/noImgElement: External avatar URL from DiceBear API */}
        <img
          src={getAvatarForUser(comment.createdById)}
          alt={comment.creatorUsername}
          className="h-8 w-8 rounded-full bg-muted"
          style={{
            boxShadow: `0 0 0 1px ${colors.border}`,
          }}
        />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className="font-medium text-sm truncate"
            style={{ color: colors.textPrimary }}
          >
            {comment.creatorUsername}
          </span>
          <span
            className="text-xs shrink-0"
            style={{ color: colors.textSecondary }}
          >
            {formatRelativeTime(new Date(comment.createdAt))}
          </span>
        </div>
        <p
          className="text-sm whitespace-pre-wrap break-words leading-relaxed"
          style={{ color: colors.textPrimary, opacity: 0.9 }}
        >
          {comment.content}
        </p>
      </div>

      {/* Delete button - fade in on hover */}
      {canDelete && (
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-6 w-6 shrink-0 rounded-md",
            "opacity-0 group-hover:opacity-100",
            "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
            "transition-all duration-150",
          )}
          onClick={onDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </motion.div>
  );
});
