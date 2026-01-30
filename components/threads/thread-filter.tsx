"use client";

import { Eye, EyeOff, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ThreadFilterProps {
  showResolved: boolean;
  onToggle: (show: boolean) => void;
  resolvedCount: number;
  totalCount: number;
}

export function ThreadFilter({
  showResolved,
  onToggle,
  resolvedCount,
  totalCount,
}: ThreadFilterProps) {
  if (totalCount === 0) return null;

  const unresolvedCount = totalCount - resolvedCount;

  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onToggle(!showResolved)}
            className={cn(
              "gap-1.5 h-8",
              !showResolved &&
                resolvedCount > 0 &&
                "text-muted-foreground border-dashed",
            )}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            <span className="text-xs">
              {unresolvedCount}
              {resolvedCount > 0 && showResolved && ` / ${totalCount}`}
            </span>
            {resolvedCount > 0 &&
              (showResolved ? (
                <Eye className="h-3 w-3 ml-0.5" />
              ) : (
                <EyeOff className="h-3 w-3 ml-0.5 text-muted-foreground" />
              ))}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {showResolved ? (
            <p className="text-xs">
              Showing all threads ({resolvedCount} resolved)
            </p>
          ) : (
            <p className="text-xs">
              {resolvedCount > 0
                ? `Hiding ${resolvedCount} resolved threads`
                : "No resolved threads"}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
