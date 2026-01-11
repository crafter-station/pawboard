"use client";

import { Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getAvatarForUser } from "@/lib/utils";

interface ParticipantsDialogProps {
  participants: Map<string, string>;
  currentUserId: string;
  onlineUsers?: Set<string>;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ParticipantsDialog({
  participants,
  currentUserId,
  onlineUsers = new Set(),
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: ParticipantsDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  // Support both controlled and uncontrolled modes
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled
    ? (value: boolean) => controlledOnOpenChange?.(value)
    : setInternalOpen;

  const participantsList = Array.from(participants.entries()).map(
    ([visitorId, username]) => ({
      visitorId,
      username,
      isCurrentUser: visitorId === currentUserId,
      isOnline: onlineUsers.has(visitorId),
    }),
  );

  // Sort: current user first, then online users, then alphabetically
  participantsList.sort((a, b) => {
    if (a.isCurrentUser) return -1;
    if (b.isCurrentUser) return 1;
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    return a.username.localeCompare(b.username);
  });

  const onlineCount = participantsList.filter((p) => p.isOnline).length;

  const defaultTrigger = (
    <Button
      variant="outline"
      size="icon"
      className="bg-card/80 backdrop-blur-sm h-8 w-8 sm:h-9 sm:w-9"
      title="View participants"
    >
      <Users className="w-4 h-4" />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Participants ({participantsList.length})
            {onlineCount > 0 && (
              <span className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                {onlineCount} online
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[300px] overflow-y-auto">
          {participantsList.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">
              No participants yet
            </p>
          ) : (
            <ul className="space-y-2">
              {participantsList.map(
                ({ visitorId, username, isCurrentUser, isOnline }) => {
                  const avatar = getAvatarForUser(visitorId);
                  return (
                    <li
                      key={visitorId}
                      className={`flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors ${
                        !isOnline ? "opacity-60" : ""
                      }`}
                    >
                      <div className="relative">
                        <img
                          src={avatar}
                          alt=""
                          className="w-8 h-8"
                          draggable={false}
                        />
                        {isOnline && (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background"
                            title="Online"
                          />
                        )}
                      </div>
                      <span className="text-sm font-medium flex-1 truncate">
                        {username}
                      </span>
                      {isCurrentUser && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          You
                        </span>
                      )}
                    </li>
                  );
                },
              )}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
