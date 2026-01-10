"use client";

import { useState } from "react";
import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UpgradeModal } from "./upgrade-modal";
import { cn } from "@/lib/utils";

interface UsageIndicatorProps {
  current: number;
  limit: number;
  label: string;
  className?: string;
}

export function UsageIndicator({
  current,
  limit,
  label,
  className,
}: UsageIndicatorProps) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const percentage = limit === Infinity ? 0 : (current / limit) * 100;
  const isNearLimit = percentage >= 80;
  const isAtLimit = current >= limit;

  if (limit === Infinity) return null;

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => isNearLimit && setUpgradeOpen(true)}
              className={cn(
                "gap-1.5 text-xs font-normal",
                isAtLimit && "text-destructive",
                isNearLimit && !isAtLimit && "text-amber-500",
                className
              )}
            >
              <SparklesIcon className="h-3.5 w-3.5" />
              <span>
                {current}/{limit}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {current} of {limit} {label} used
              {isNearLimit && " - Upgrade for unlimited"}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        feature={label}
        currentUsage={current}
        limit={limit}
      />
    </>
  );
}
