"use client";

import { X } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useThreadColors } from "@/hooks/use-thread-colors";
import { CommentInput } from "./comment-input";

interface CreateThreadPanelProps {
  onSubmit: (content: string) => Promise<void>;
  onCancel: () => void;
  /** If true, this is for a card-attached thread */
  isCardThread?: boolean;
}

export function CreateThreadPanel({
  onSubmit,
  onCancel,
  isCardThread = false,
}: CreateThreadPanelProps) {
  const colors = useThreadColors();
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle escape key to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  // Handle click outside to cancel
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };

    // Delay adding listener to avoid immediate trigger
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onCancel]);

  const handleSubmit = useCallback(
    async (content: string) => {
      await onSubmit(content);
    },
    [onSubmit],
  );

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, scale: 0.95, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -8 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
      }}
      className="flex flex-col w-[340px] rounded-xl border overflow-hidden"
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
        <span
          className="text-sm font-semibold"
          style={{ color: colors.textPrimary }}
        >
          {isCardThread ? "Comment on card" : "New comment"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          onClick={onCancel}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Input */}
      <div
        className="px-3 py-3"
        style={{
          backgroundColor: colors.surface,
        }}
      >
        <CommentInput
          onSubmit={handleSubmit}
          placeholder="Write a comment..."
          autoFocus
        />
      </div>
    </motion.div>
  );
}
