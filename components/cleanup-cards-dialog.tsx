"use client";

import { useState, useMemo } from "react";
import { Trash, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Card } from "@/db/schema";

interface CleanupCardsDialogProps {
  cards: Card[];
  onCleanup: () => Promise<{ success: boolean; deletedCount: number; error?: string }>;
  trigger?: React.ReactNode;
}

export function CleanupCardsDialog({
  cards,
  onCleanup,
  trigger,
}: CleanupCardsDialogProps) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [deletedCount, setDeletedCount] = useState(0);

  const emptyCardsCount = useMemo(() => {
    return cards.filter(
      (card) => !card.content || card.content.trim() === ""
    ).length;
  }, [cards]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setShowConfirmation(false);
      setShowSuccess(false);
      setError(null);
    }
  };

  const handleCleanup = async () => {
    if (emptyCardsCount === 0) {
      setOpen(false);
      return;
    }

    setIsDeleting(true);
    setError(null);

    const result = await onCleanup();

    setIsDeleting(false);

    if (result.success) {
      setDeletedCount(result.deletedCount);
      setShowSuccess(true);
      setShowConfirmation(false);

      // Close dialog after showing success message
      setTimeout(() => {
        setOpen(false);
        setShowSuccess(false);
      }, 1500);
    } else {
      setError(result.error ?? "Failed to clean up empty cards");
    }
  };

  const handleInitialClick = () => {
    if (emptyCardsCount === 0) {
      setError("No empty cards found to clean up.");
      return;
    }
    setShowConfirmation(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" title="Clean up empty cards">
            <Trash className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash className="h-4 w-4" />
            Clean up Empty Cards
          </DialogTitle>
          <DialogDescription>
            Remove all cards with no content from the board.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {showSuccess ? (
            <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-md border border-green-200 dark:border-green-900">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600 dark:text-green-500" />
                <p className="text-sm text-green-800 dark:text-green-300 font-medium">
                  Successfully deleted {deletedCount} empty{" "}
                  {deletedCount === 1 ? "card" : "cards"}!
                </p>
              </div>
            </div>
          ) : !showConfirmation ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-md">
                <p className="text-sm">
                  Found{" "}
                  <span className="font-semibold text-foreground">
                    {emptyCardsCount}
                  </span>{" "}
                  empty {emptyCardsCount === 1 ? "card" : "cards"} on this
                  board.
                </p>
              </div>

              {emptyCardsCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  Empty cards (with no content or only whitespace) will be
                  permanently removed.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2 p-3 bg-destructive/10 rounded-md">
              <p className="text-sm text-destructive">
                Are you sure? This will permanently delete {emptyCardsCount}{" "}
                empty {emptyCardsCount === 1 ? "card" : "cards"}.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        {!showSuccess && (
          <DialogFooter>
            {!showConfirmation ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleInitialClick}
                  disabled={isDeleting || emptyCardsCount === 0}
                >
                  Clean Up
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmation(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleCleanup}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Yes, Delete All"}
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
