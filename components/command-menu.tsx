"use client";

import { useEffect } from "react";
import { Plus, Share2, Home, Moon, Sun, Pencil } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddCard: () => void;
  onShare: () => void;
  onChangeName: () => void;
}

export function CommandMenu({ open, onOpenChange, onAddCard, onShare, onChangeName }: CommandMenuProps) {
  const { setTheme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const runCommand = (command: () => void) => {
    onOpenChange(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runCommand(onAddCard)}>
            <Plus className="mr-2 h-4 w-4" />
            Add new card
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(onShare)}>
            <Share2 className="mr-2 h-4 w-4" />
            Copy share link
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/"))}>
            <Home className="mr-2 h-4 w-4" />
            Go home
          </CommandItem>
          <CommandItem onSelect={() => runCommand(onChangeName)}>
            <Pencil className="mr-2 h-4 w-4" />
            Change name
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Theme">
          <CommandItem onSelect={() => runCommand(() => setTheme("light"))}>
            <Sun className="mr-2 h-4 w-4" />
            Light mode
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setTheme("dark"))}>
            <Moon className="mr-2 h-4 w-4" />
            Dark mode
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

