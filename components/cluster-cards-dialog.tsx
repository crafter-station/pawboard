"use client";

import { Check, Loader2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { clusterCards } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Card } from "@/db/schema";
import { isContentEmpty } from "@/lib/tiptap-utils";

interface ClusterCardsDialogProps {
  cards: Card[];
  sessionId: string;
  userId: string;
  onCluster: (positions: Array<{ id: string; x: number; y: number }>) => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ClusterCardsDialog({
  cards,
  sessionId,
  userId,
  onCluster,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: ClusterCardsDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled
    ? (value: boolean) => controlledOnOpenChange?.(value)
    : setInternalOpen;
  const [isClustering, setIsClustering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [clusterResult, setClusterResult] = useState<{
    clusterCount: number;
    cardsProcessed: number;
  } | null>(null);

  const cardsWithContent = useMemo(() => {
    return cards.filter((card) => !isContentEmpty(card.content));
  }, [cards]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setShowSuccess(false);
      setError(null);
      setClusterResult(null);
    }
  };

  const handleCluster = async () => {
    if (cardsWithContent.length < 2) {
      setError("Need at least 2 cards with content to cluster");
      return;
    }

    setIsClustering(true);
    setError(null);

    try {
      const result = await clusterCards(sessionId, userId);

      if (result.error) {
        setError(result.error);
        setIsClustering(false);
        return;
      }

      // Apply the cluster positions
      onCluster(result.positions);

      setClusterResult({
        clusterCount: result.clusterCount,
        cardsProcessed: result.cardsProcessed,
      });
      setShowSuccess(true);

      // Close dialog after showing success
      setTimeout(() => {
        setOpen(false);
        setShowSuccess(false);
      }, 2000);
    } catch (err) {
      console.error("Cluster error:", err);
      setError("Failed to cluster cards. Please try again.");
    } finally {
      setIsClustering(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isControlled &&
        (trigger ? (
          <DialogTrigger asChild>{trigger}</DialogTrigger>
        ) : (
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              title="Cluster cards by similarity"
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        ))}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Cluster Cards by Similarity
          </DialogTitle>
          <DialogDescription>
            Automatically group similar cards together using AI.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {showSuccess && clusterResult ? (
            <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-md border border-green-200 dark:border-green-900">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600 dark:text-green-500" />
                <div className="text-sm text-green-800 dark:text-green-300">
                  <p className="font-medium">
                    Organized {clusterResult.cardsProcessed} cards into{" "}
                    {clusterResult.clusterCount} cluster
                    {clusterResult.clusterCount === 1 ? "" : "s"}!
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-md">
                <p className="text-sm">
                  Found{" "}
                  <span className="font-semibold text-foreground">
                    {cardsWithContent.length}
                  </span>{" "}
                  {cardsWithContent.length === 1 ? "card" : "cards"} with
                  content to analyze.
                </p>
              </div>

              {cardsWithContent.length >= 2 && (
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>This will:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Analyze card content using AI</li>
                    <li>Group similar cards into clusters</li>
                    <li>Rearrange cards on the board</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 bg-destructive/10 rounded-md">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        {!showSuccess && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isClustering}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCluster}
              disabled={isClustering || cardsWithContent.length < 2}
            >
              {isClustering ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Clustering...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Cluster Cards
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
