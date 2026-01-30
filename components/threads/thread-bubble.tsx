"use client";

import { MessageCircle } from "lucide-react";
import { motion } from "motion/react";
import type { ThreadWithDetails } from "@/db/schema";
import { useThreadColors } from "@/hooks/use-thread-colors";
import { cn, getDiceBearAvatar } from "@/lib/utils";

interface ThreadBubbleProps {
  thread: ThreadWithDetails;
  isSelected?: boolean;
  onClick?: () => void;
}

export function ThreadBubble({
  thread,
  isSelected = false,
  onClick,
}: ThreadBubbleProps) {
  const colors = useThreadColors();

  // Get unique participants (max 2 shown to avoid overflow)
  const participantIds = new Set<string>();
  participantIds.add(thread.creator.id);
  for (const comment of thread.comments) {
    participantIds.add(comment.creator.id);
  }
  const allParticipants = Array.from(participantIds);
  const participants = allParticipants.slice(0, 2);
  const extraCount = allParticipants.length - 2;

  const commentCount = thread.comments.length;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 25,
      }}
      className={cn(
        "relative flex items-center justify-center",
        "rounded-xl transition-shadow duration-200",
        "border cursor-pointer",
        thread.isResolved ? "opacity-60 grayscale-[30%]" : "ring-2",
        isSelected && "ring-2 ring-offset-2 ring-offset-background",
      )}
      style={{
        width: participants.length > 1 ? 48 : 40,
        height: 40,
        backgroundColor: colors.surface,
        borderColor: colors.border,
        boxShadow: colors.shadow,
        // Ring color based on state
        outlineColor: thread.isResolved
          ? "transparent"
          : isSelected
            ? colors.avatarRing
            : colors.avatarRingFaded,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = colors.shadowElevated;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = colors.shadow;
      }}
    >
      {/* Stacked avatars */}
      <div className="flex items-center -space-x-2">
        {participants.map((userId, index) => (
          <img
            key={userId}
            src={getDiceBearAvatar(userId)}
            alt=""
            className={cn(
              "rounded-full border-2 bg-muted",
              index === 0 ? "h-7 w-7" : "h-6 w-6",
            )}
            style={{
              zIndex: participants.length - index,
              borderColor: colors.surface,
              boxShadow: `0 0 0 1px ${colors.avatarRingMedium}`,
            }}
          />
        ))}
      </div>

      {/* Extra participants indicator - show when more than 2 participants */}
      {extraCount > 0 && !thread.isResolved && (
        <span
          className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border text-[10px] font-medium px-0.5 text-foreground"
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
        >
          +{extraCount}
        </span>
      )}

      {/* Comment count badge */}
      {commentCount > 1 && (
        <span
          className="absolute -right-1 -bottom-1 flex h-5 min-w-5 items-center justify-center rounded-full text-white text-[10px] font-medium px-1 shadow-sm"
          style={{ backgroundColor: colors.avatarRing }}
        >
          {commentCount}
        </span>
      )}

      {/* Resolved indicator */}
      {thread.isResolved && (
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white shadow-sm">
          <svg
            className="h-2.5 w-2.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </span>
      )}
    </motion.button>
  );
}

// Mini version for use in cards or compact views
export function ThreadBubbleMini({
  thread,
  onClick,
}: {
  thread: ThreadWithDetails;
  onClick?: () => void;
}) {
  const colors = useThreadColors();

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs",
        "border transition-colors",
        thread.isResolved && "opacity-60",
      )}
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = colors.surfaceHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = colors.surface;
      }}
    >
      <MessageCircle className="h-3 w-3" />
      <span>{thread.comments.length}</span>
    </motion.button>
  );
}
