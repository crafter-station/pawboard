"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { COMMENT_CONSTRAINTS } from "@/lib/thread-permissions";
import { cn } from "@/lib/utils";

interface CreateThreadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (content: string, cardId?: string) => Promise<void>;
  onCancel: () => void;
  /** If provided, thread will be attached to this card instead of canvas */
  cardId?: string;
}

export function CreateThreadDialog({
  open,
  onOpenChange,
  onSubmit,
  onCancel,
  cardId,
}: CreateThreadDialogProps) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(trimmed, cardId);
      setContent("");
    } finally {
      setIsSubmitting(false);
    }
  }, [content, isSubmitting, onSubmit, cardId]);

  const handleCancel = useCallback(() => {
    setContent("");
    onCancel();
  }, [onCancel]);

  // Reset content when dialog closes
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setContent("");
      }
      onOpenChange(open);
    },
    [onOpenChange],
  );

  const isOverLimit = content.length > COMMENT_CONSTRAINTS.MAX_LENGTH;
  const canSubmit = content.trim().length > 0 && !isOverLimit;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {cardId ? "Add comment to card" : "Start a comment thread"}
          </DialogTitle>
          <DialogDescription>
            {cardId
              ? "This comment will be attached to the card."
              : "Add your first comment to start the discussion."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your comment..."
            className={cn(
              "min-h-[100px] resize-none",
              isOverLimit &&
                "border-destructive focus-visible:ring-destructive",
            )}
            autoFocus
          />
          {content.length > COMMENT_CONSTRAINTS.MAX_LENGTH * 0.8 && (
            <p
              className={cn(
                "text-xs text-right",
                isOverLimit ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {content.length}/{COMMENT_CONSTRAINTS.MAX_LENGTH}
            </p>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Thread"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
