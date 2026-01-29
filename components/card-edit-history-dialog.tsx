"use client";

import { Crown, History } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { CardEditHistoryWithUser } from "@/app/actions";
import { getCardEditHistory } from "@/app/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getAvatarForUser } from "@/lib/utils";

interface CardEditHistoryDialogProps {
  cardId: string;
  creatorId?: string;
  trigger: React.ReactNode;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString();
}

export function CardEditHistoryDialog({
  cardId,
  creatorId,
  trigger,
}: CardEditHistoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<CardEditHistoryWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setIsLoading(true);
      setError(null);
      getCardEditHistory(cardId)
        .then(({ history, error }) => {
          if (error) {
            setError(error);
          } else {
            setHistory(history);
          }
        })
        .catch(() => {
          setError("Failed to load edit history");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, cardId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Edit History
          </DialogTitle>
          <DialogDescription>
            See who has edited this card and when.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[300px] overflow-y-auto">
          {isLoading ? (
            <p className="text-muted-foreground text-sm text-center py-4">
              Loading...
            </p>
          ) : error ? (
            <p className="text-destructive text-sm text-center py-4">{error}</p>
          ) : history.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">
              No edit history yet
            </p>
          ) : (
            <ul className="space-y-2">
              {history.map((entry) => {
                const avatar = getAvatarForUser(entry.userId);
                const isCreator = creatorId && entry.userId === creatorId;
                return (
                  <li
                    key={entry.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="relative">
                      <Image
                        src={avatar}
                        alt=""
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-sm"
                        draggable={false}
                      />
                      {isCreator && (
                        <Crown
                          className="absolute -top-1 -right-1 w-3.5 h-3.5 text-amber-500"
                          fill="currentColor"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">
                        {entry.user.username}
                        {isCreator && (
                          <span className="ml-1.5 text-xs text-amber-600 dark:text-amber-400 font-normal">
                            Creator
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(new Date(entry.editedAt))}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
