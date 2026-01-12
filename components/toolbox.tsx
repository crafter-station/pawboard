"use client";

import {
  ArrowRight,
  Circle,
  Diamond,
  MousePointer2,
  Shapes,
  Square,
  Type,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

export type ToolType =
  | "select"
  | "text"
  | "rectangle"
  | "circle"
  | "diamond"
  | "arrow";

interface ToolboxProps {
  selectedTool: ToolType;
  onToolSelect: (tool: ToolType) => void;
  disabled?: boolean;
}

interface ToolButtonProps {
  tool: ToolType;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  selectedTool: ToolType;
  onToolSelect: (tool: ToolType) => void;
  disabled?: boolean;
}

function ToolButton({
  tool,
  icon: Icon,
  label,
  selectedTool,
  onToolSelect,
  disabled,
}: ToolButtonProps) {
  const isSelected = selectedTool === tool;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isSelected ? "default" : "ghost"}
            size="icon"
            className={cn(
              "h-9 w-9",
              isSelected && "bg-primary text-primary-foreground",
            )}
            onClick={() => onToolSelect(tool)}
            disabled={disabled}
          >
            <Icon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface MobileToolButtonProps extends ToolButtonProps {
  onClose: () => void;
}

function MobileToolButton({
  tool,
  icon: Icon,
  label,
  selectedTool,
  onToolSelect,
  disabled,
  onClose,
}: MobileToolButtonProps) {
  const isSelected = selectedTool === tool;

  return (
    <Button
      variant={isSelected ? "default" : "ghost"}
      size="sm"
      className={cn(
        "flex flex-col items-center gap-1 h-auto py-2 px-3",
        isSelected && "bg-primary text-primary-foreground",
      )}
      onClick={() => {
        onToolSelect(tool);
        onClose();
      }}
      disabled={disabled}
    >
      <Icon className="h-5 w-5" />
      <span className="text-xs">{label}</span>
    </Button>
  );
}

const tools: {
  tool: ToolType;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}[] = [
  { tool: "select", icon: MousePointer2, label: "Select" },
  { tool: "text", icon: Type, label: "Text" },
  { tool: "rectangle", icon: Square, label: "Rectangle" },
  { tool: "circle", icon: Circle, label: "Circle" },
  { tool: "diamond", icon: Diamond, label: "Diamond" },
  { tool: "arrow", icon: ArrowRight, label: "Arrow" },
];

export function Toolbox({
  selectedTool,
  onToolSelect,
  disabled,
}: ToolboxProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop Toolbox - Left side, vertically centered */}
      <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50 hidden sm:block">
        <div className="flex flex-col gap-1 bg-card/80 backdrop-blur-sm rounded-lg border p-1.5 shadow-lg">
          {tools.map(({ tool, icon, label }) => (
            <ToolButton
              key={tool}
              tool={tool}
              icon={icon}
              label={label}
              selectedTool={selectedTool}
              onToolSelect={onToolSelect}
              disabled={disabled}
            />
          ))}
        </div>
      </div>

      {/* Mobile Toolbox - Bottom left floating button with popover */}
      <div className="fixed left-4 bottom-4 z-50 sm:hidden">
        <Popover open={mobileOpen} onOpenChange={setMobileOpen}>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              className="h-12 w-12 rounded-full bg-card/80 backdrop-blur-sm shadow-lg"
              disabled={disabled}
            >
              <Shapes className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            className="w-auto p-2"
            sideOffset={8}
          >
            <div className="grid grid-cols-3 gap-1">
              {tools.map(({ tool, icon, label }) => (
                <MobileToolButton
                  key={tool}
                  tool={tool}
                  icon={icon}
                  label={label}
                  selectedTool={selectedTool}
                  onToolSelect={onToolSelect}
                  disabled={disabled}
                  onClose={() => setMobileOpen(false)}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}
