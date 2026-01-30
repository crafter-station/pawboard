"use client";

import {
  FileText,
  Home,
  ListTodo,
  Lock,
  MessageCircle,
  Moon,
  Pencil,
  Plus,
  Share2,
  Sparkles,
  Sun,
  Trash,
  Trash2,
  Unlock,
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
  CommandShortcut,
} from "@/components/ui/command";

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddCard: () => void;
  onAddThread?: () => void;
  onShare: () => void;
  onChangeName: () => void;
  // Session management (creator-only)
  isSessionCreator?: boolean;
  isLocked?: boolean;
  onToggleLock?: () => void;
  onDeleteSession?: () => void;
  onClusterCards?: () => void;
  onCleanupEmptyCards?: () => void;
  onEditBoardName?: () => void;
}

export function CommandMenu({
  open,
  onOpenChange,
  onAddCard,
  onAddThread,
  onShare,
  onChangeName,
  isSessionCreator,
  isLocked,
  onToggleLock,
  onDeleteSession,
  onClusterCards,
  onCleanupEmptyCards,
  onEditBoardName,
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
            keywords={["create", "note", "sticky", "idea"]}
            onSelect={() => runCommand(onAddCard)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add new card
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          {onAddThread && (
            <CommandItem
              keywords={["comment", "discussion", "chat"]}
              onSelect={() => runCommand(onAddThread)}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Add comment thread
              <CommandShortcut>C</CommandShortcut>
            </CommandItem>
          )}
          <CommandItem
            keywords={["share", "url", "invite"]}
            onSelect={() => runCommand(onShare)}
          >
            <Share2 className="mr-2 h-4 w-4" />
            Copy share link
          </CommandItem>
          <CommandItem
            keywords={["dashboard", "main", "landing"]}
            onSelect={() => runCommand(() => router.push("/"))}
          >
            <Home className="mr-2 h-4 w-4" />
            Go home
          </CommandItem>
          <CommandItem
            keywords={["boards", "list", "all"]}
            onSelect={() => runCommand(() => router.push("/sessions"))}
          >
            <ListTodo className="mr-2 h-4 w-4" />
            My sessions
          </CommandItem>
          <CommandItem
            keywords={["rename", "username", "display", "nickname"]}
            onSelect={() => runCommand(onChangeName)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Change my name
          </CommandItem>
        </CommandGroup>
        {isSessionCreator && (
          <CommandGroup heading="Session">
            {onEditBoardName && (
              <CommandItem
                keywords={["rename", "title", "board"]}
                onSelect={() => runCommand(onEditBoardName)}
              >
                <FileText className="mr-2 h-4 w-4" />
                Edit board name
              </CommandItem>
            )}
            {onToggleLock && (
              <CommandItem
                keywords={["lock", "unlock", "freeze", "protect", "readonly"]}
                onSelect={() => runCommand(onToggleLock)}
              >
                {isLocked ? (
                  <Unlock className="mr-2 h-4 w-4" />
                ) : (
                  <Lock className="mr-2 h-4 w-4" />
                )}
                {isLocked ? "Unlock session" : "Lock session"}
              </CommandItem>
            )}
            {onClusterCards && (
              <CommandItem
                keywords={[
                  "cluster",
                  "group",
                  "organize",
                  "ai",
                  "categorize",
                  "sort",
                  "arrange",
                ]}
                onSelect={() => runCommand(onClusterCards)}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Cluster cards
              </CommandItem>
            )}
            {onCleanupEmptyCards && (
              <CommandItem
                keywords={["cleanup", "clean", "empty", "clear", "trash"]}
                onSelect={() => runCommand(onCleanupEmptyCards)}
              >
                <Trash className="mr-2 h-4 w-4" />
                Delete empty cards
              </CommandItem>
            )}
            {onDeleteSession && (
              <CommandItem
                keywords={["delete", "remove", "destroy"]}
                onSelect={() => runCommand(onDeleteSession)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete session
              </CommandItem>
            )}
          </CommandGroup>
        )}
        <CommandGroup heading="Theme">
          <CommandItem
            keywords={["theme", "mode", "appearance", "color", "switch"]}
            onSelect={() => runCommand(() => setTheme("light"))}
          >
            <Sun className="mr-2 h-4 w-4" />
            Light mode
          </CommandItem>
          <CommandItem
            keywords={["theme", "mode", "appearance", "color", "switch"]}
            onSelect={() => runCommand(() => setTheme("dark"))}
          >
            <Moon className="mr-2 h-4 w-4" />
            Dark mode
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
