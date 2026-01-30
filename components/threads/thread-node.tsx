"use client";

import type { Node } from "@xyflow/react";
import { useCallback, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SessionRole, ThreadWithDetails } from "@/db/schema";
import { ThreadBubble } from "./thread-bubble";
import { ThreadPanel } from "./thread-panel";
import { ThreadTooltip } from "./thread-tooltip";

export interface ThreadNodeData extends Record<string, unknown> {
  thread: ThreadWithDetails;
  userRole: SessionRole | null;
  visitorId: string;
  sessionLocked: boolean;
  onAddComment: (threadId: string, content: string) => Promise<void>;
  onDeleteComment: (threadId: string, commentId: string) => Promise<void>;
  onResolve: (threadId: string, isResolved: boolean) => Promise<void>;
  onDeleteThread: (threadId: string) => Promise<void>;
}

export type ThreadNodeType = Node<ThreadNodeData, "thread">;

interface ThreadNodeProps {
  data: ThreadNodeData;
  selected?: boolean;
}

export function ThreadNode({ data, selected }: ThreadNodeProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleAddComment = useCallback(
    async (content: string) => {
      await data.onAddComment(data.thread.id, content);
    },
    [data],
  );

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      await data.onDeleteComment(data.thread.id, commentId);
    },
    [data],
  );

  const handleResolve = useCallback(
    async (isResolved: boolean) => {
      await data.onResolve(data.thread.id, isResolved);
    },
    [data],
  );

  const handleDeleteThread = useCallback(async () => {
    await data.onDeleteThread(data.thread.id);
    setIsOpen(false);
  }, [data]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <TooltipProvider delayDuration={400}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <div className="cursor-pointer z-50">
                <ThreadBubble
                  thread={data.thread}
                  isSelected={selected || isOpen}
                  onClick={() => setIsOpen(true)}
                />
              </div>
            </PopoverTrigger>
          </TooltipTrigger>
          {!isOpen && (
            <TooltipContent
              side="top"
              className="p-0 bg-transparent border-none shadow-none"
            >
              <ThreadTooltip thread={data.thread} />
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
      <PopoverContent
        className="w-auto p-0 bg-transparent border-none shadow-none"
        align="start"
        side="right"
        sideOffset={12}
      >
        <ThreadPanel
          thread={data.thread}
          currentUserId={data.visitorId}
          userRole={data.userRole}
          onAddComment={handleAddComment}
          onDeleteComment={handleDeleteComment}
          onResolve={handleResolve}
          onDeleteThread={handleDeleteThread}
          onClose={() => setIsOpen(false)}
          disabled={data.sessionLocked}
        />
      </PopoverContent>
    </Popover>
  );
}
