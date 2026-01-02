"use client";

import Image from "next/image";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserBadgeProps {
  username: string;
  avatar: string;
  onClick?: () => void;
  editable?: boolean;
  compact?: boolean;
}

export function UserBadge({
  username,
  avatar,
  onClick,
  editable = false,
  compact = false,
}: UserBadgeProps) {
  const Component = onClick ? "button" : "div";

  return (
    <Component
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-md bg-card/80 backdrop-blur-sm border border-border shadow-xs dark:bg-input/30 dark:border-input group",
        compact ? "px-1.5 h-8 sm:px-3 sm:h-9" : "px-2 sm:px-3 h-8 sm:h-9",
        onClick &&
          "cursor-pointer hover:bg-card/90 dark:hover:bg-input/40 transition-colors",
      )}
    >
      <Image
        src={avatar}
        alt="Avatar"
        width={20}
        height={20}
        className={cn(
          "rounded-full",
          compact ? "w-5 h-5 sm:w-6 sm:h-6" : "w-5 h-5 sm:w-6 sm:h-6",
        )}
      />
      <span
        className={cn(
          "text-foreground font-medium whitespace-nowrap",
          compact ? "hidden sm:inline text-sm" : "text-xs sm:text-sm",
        )}
      >
        {username}
      </span>
      {editable && (
        <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
      )}
    </Component>
  );
}
