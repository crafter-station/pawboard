"use client";

import Image from "next/image";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserBadgeProps {
  username: string;
  avatar: string;
  onClick?: () => void;
  editable?: boolean;
}

export function UserBadge({
  username,
  avatar,
  onClick,
  editable = false,
}: UserBadgeProps) {
  const Component = onClick ? "button" : "div";

  return (
    <Component
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 px-2 sm:px-3 h-8 sm:h-9 rounded-md bg-card/80 backdrop-blur-sm border border-border shadow-xs dark:bg-input/30 dark:border-input group",
        onClick &&
          "cursor-pointer hover:bg-card/90 dark:hover:bg-input/40 transition-colors",
      )}
    >
      <Image
        src={avatar}
        alt="Avatar"
        width={20}
        height={20}
        className="w-5 h-5 sm:w-6 sm:h-6 rounded-full"
      />
      <span className="text-foreground text-xs sm:text-sm font-medium whitespace-nowrap">
        {username}
      </span>
      {editable && (
        <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </Component>
  );
}
