"use client";

import { ArrowUp } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useThreadColors } from "@/hooks/use-thread-colors";
import { COMMENT_CONSTRAINTS } from "@/lib/thread-permissions";
import { cn } from "@/lib/utils";

interface CommentInputProps {
  onSubmit: (content: string) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function CommentInput({
  onSubmit,
  placeholder = "Write a comment...",
  disabled = false,
  autoFocus = false,
}: CommentInputProps) {
  const colors = useThreadColors();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(trimmed);
      setContent("");
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [content, isSubmitting, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Submit on Enter (without Shift)
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setContent(e.target.value);
      // Auto-resize textarea
      const textarea = e.target;
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    },
    [],
  );

  const isOverLimit = content.length > COMMENT_CONSTRAINTS.MAX_LENGTH;
  const canSubmit = content.trim().length > 0 && !isOverLimit && !disabled;

  return (
    <div className="flex gap-2 items-end">
      <div className="relative flex-1">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isSubmitting}
          autoFocus={autoFocus}
          className={cn(
            "min-h-[38px] max-h-[120px] resize-none py-2 pr-12",
            "bg-background/80 rounded-lg text-sm",
            "transition-shadow duration-150",
            isOverLimit &&
              "border-destructive focus:ring-destructive/50 focus:border-destructive",
          )}
          style={{
            borderColor: isOverLimit ? undefined : colors.border,
          }}
          rows={1}
        />
        {/* Character count indicator */}
        {content.length > COMMENT_CONSTRAINTS.MAX_LENGTH * 0.8 && (
          <span
            className={cn("absolute right-2 bottom-2 text-xs font-medium")}
            style={{
              color: isOverLimit ? undefined : colors.textSecondary,
            }}
          >
            {content.length}/{COMMENT_CONSTRAINTS.MAX_LENGTH}
          </span>
        )}
      </div>
      <Button
        size="icon"
        onClick={handleSubmit}
        disabled={!canSubmit || isSubmitting}
        className={cn(
          "h-9 w-9 shrink-0 rounded-full",
          "text-white",
          "shadow-sm transition-all duration-150",
          "disabled:opacity-40 disabled:cursor-not-allowed",
        )}
        style={{
          backgroundColor: colors.avatarRing,
        }}
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
    </div>
  );
}
