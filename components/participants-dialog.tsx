"use client";

import { useState } from "react";
import { Users } from "lucide-react";
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
}

export function ParticipantsDialog({
  participants,
  currentUserId,
}: ParticipantsDialogProps) {
  const [open, setOpen] = useState(false);

  const participantsList = Array.from(participants.entries()).map(
    ([visitorId, username]) => ({
      visitorId,
      username,
      isCurrentUser: visitorId === currentUserId,
    }),
  );

  // Sort: current user first, then alphabetically
  participantsList.sort((a, b) => {
    if (a.isCurrentUser) return -1;
    if (b.isCurrentUser) return 1;
    return a.username.localeCompare(b.username);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="bg-card/80 backdrop-blur-sm h-8 w-8 sm:h-9 sm:w-9"
          title="View participants"
        >
          <Users className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Participants ({participantsList.length})</DialogTitle>
        </DialogHeader>
        <div className="max-h-[300px] overflow-y-auto">
          {participantsList.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">
              No participants yet
            </p>
          ) : (
            <ul className="space-y-2">
              {participantsList.map(
                ({ visitorId, username, isCurrentUser }) => {
                  const avatar = getAvatarForUser(visitorId);
                  return (
                    <li
                      key={visitorId}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <img
                        src={avatar}
                        alt=""
                        className="w-8 h-8"
                        draggable={false}
                      />
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
