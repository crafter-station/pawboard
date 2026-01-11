"use client";

import {
  Copy,
  Home,
  ListTodo,
  Maximize2,
  Moon,
  Pencil,
  Plus,
  Settings,
  Share2,
  Sparkles,
  Sun,
  Trash,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddCard: () => void;
  onShare: () => void;
  onCopySessionId: () => void;
  onChangeName: () => void;
  onFitAllCards: () => void;
  onViewParticipants: () => void;
  // Creator-only actions
  isSessionCreator: boolean;
  onOpenSettings?: () => void;
  onOpenCleanup?: () => void;
  onOpenCluster?: () => void;
  onRenameBoard?: () => void;
  isLocked?: boolean;
}

export function CommandMenu({
  open,
  onOpenChange,
  onAddCard,
  onShare,
  onCopySessionId,
  onChangeName,
  onFitAllCards,
  onViewParticipants,
  isSessionCreator,
  onOpenSettings,
  onOpenCleanup,
  onOpenCluster,
  onRenameBoard,
  isLocked = false,
}: CommandMenuProps) {
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
          <CommandItem
            onSelect={() => runCommand(onAddCard)}
            disabled={isLocked}
          >
            <Plus className="mr-2 h-4 w-4" />
            {isLocked ? "Session is locked" : "Add new card"}
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(onShare)}>
            <Share2 className="mr-2 h-4 w-4" />
            Copy share link
          </CommandItem>
          <CommandItem onSelect={() => runCommand(onCopySessionId)}>
            <Copy className="mr-2 h-4 w-4" />
            Copy session ID
          </CommandItem>
          <CommandItem onSelect={() => runCommand(onChangeName)}>
            <Pencil className="mr-2 h-4 w-4" />
            Change your name
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="View">
          <CommandItem onSelect={() => runCommand(onViewParticipants)}>
            <Users className="mr-2 h-4 w-4" />
            View participants
          </CommandItem>
          <CommandItem onSelect={() => runCommand(onFitAllCards)}>
            <Maximize2 className="mr-2 h-4 w-4" />
            Fit all cards in view
            <CommandShortcut>1</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push("/"))}>
            <Home className="mr-2 h-4 w-4" />
            Go home
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/sessions"))}
          >
            <ListTodo className="mr-2 h-4 w-4" />
            My sessions
          </CommandItem>
        </CommandGroup>

        {isSessionCreator && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Board Management">
              {onRenameBoard && (
                <CommandItem onSelect={() => runCommand(onRenameBoard)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Rename board
                </CommandItem>
              )}
              {onOpenSettings && (
                <CommandItem onSelect={() => runCommand(onOpenSettings)}>
                  <Settings className="mr-2 h-4 w-4" />
                  Session settings
                </CommandItem>
              )}
              {onOpenCleanup && (
                <CommandItem onSelect={() => runCommand(onOpenCleanup)}>
                  <Trash className="mr-2 h-4 w-4" />
                  Clean up empty cards
                </CommandItem>
              )}
              {onOpenCluster && (
                <CommandItem
                  onSelect={() => runCommand(onOpenCluster)}
                  disabled={isLocked}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Cluster cards by similarity
                </CommandItem>
              )}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />

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
