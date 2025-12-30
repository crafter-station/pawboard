"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AddCardButtonProps {
  onClick: () => void;
}

export function AddCardButton({ onClick }: AddCardButtonProps) {
  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onClick}
            variant="outline"
            size="icon"
            className="h-8 w-8 sm:h-9 sm:w-9 bg-card/80 backdrop-blur-sm border-border"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Add card <kbd className="ml-1 px-1.5 py-0.5 text-xs bg-muted rounded">N</kbd></p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
