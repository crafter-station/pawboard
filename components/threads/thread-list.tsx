"use client";

import { MessageCircle } from "lucide-react";
import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ThreadWithDetails } from "@/db/schema";
import { ThreadListItem } from "./thread-list-item";

interface ThreadListProps {
  threads: ThreadWithDetails[];
  onThreadClick: (threadId: string) => void;
  showResolved?: boolean;
}

export function ThreadList({
  threads,
  onThreadClick,
  showResolved = true,
}: ThreadListProps) {
  // Filter and sort threads
  const sortedThreads = useMemo(() => {
    const filtered = showResolved
      ? threads
      : threads.filter((t) => !t.isResolved);

    // Sort by most recent activity (latest comment or thread creation)
    return [...filtered].sort((a, b) => {
      const aLatest =
        a.comments.length > 0
          ? new Date(a.comments[a.comments.length - 1].createdAt).getTime()
          : new Date(a.createdAt).getTime();
      const bLatest =
        b.comments.length > 0
          ? new Date(b.comments[b.comments.length - 1].createdAt).getTime()
          : new Date(b.createdAt).getTime();
      return bLatest - aLatest;
    });
  }, [threads, showResolved]);

  if (sortedThreads.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <MessageCircle className="w-12 h-12 opacity-20 mb-4" />
        <p className="text-sm text-muted-foreground">
          {threads.length === 0 ? "No threads yet" : "No unresolved threads"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {threads.length === 0
            ? "Right-click on the canvas or a card to start a thread"
            : "Toggle to show resolved threads"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">
            Threads ({sortedThreads.length})
          </span>
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sortedThreads.map((thread) => (
            <ThreadListItem
              key={thread.id}
              thread={thread}
              onClick={() => onThreadClick(thread.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
