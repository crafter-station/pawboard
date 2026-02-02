"use client";

import { Crown, Users } from "lucide-react";
import Image from "next/image";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getAvatarForUser } from "@/lib/utils";

interface ParticipantsListProps {
  participants: Map<string, string>;
  currentUserId: string;
  onlineUsers?: Set<string>;
  creatorId?: string;
}

export function ParticipantsList({
  participants,
  currentUserId,
  onlineUsers = new Set(),
  creatorId,
}: ParticipantsListProps) {
  const participantsList = Array.from(participants.entries()).map(
    ([visitorId, username]) => ({
      visitorId,
      username,
      isCurrentUser: visitorId === currentUserId,
      isOnline: onlineUsers.has(visitorId),
      isCreator: visitorId === creatorId,
    }),
  );

  // Sort: current user first, then creator, then online users, then alphabetically
  participantsList.sort((a, b) => {
    if (a.isCurrentUser) return -1;
    if (b.isCurrentUser) return 1;
    if (a.isCreator !== b.isCreator) return a.isCreator ? -1 : 1;
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    return a.username.localeCompare(b.username);
  });

  const onlineCount = participantsList.filter((p) => p.isOnline).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">
            Participants ({participantsList.length})
          </span>
          {onlineCount > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {onlineCount} online
            </span>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2">
        {participantsList.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            No participants yet
          </p>
        ) : (
          <ul className="space-y-1">
            {participantsList.map(
              ({ visitorId, username, isCurrentUser, isOnline, isCreator }) => {
                const avatar = getAvatarForUser(visitorId);
                return (
                  <li
                    key={visitorId}
                    className={`flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors ${
                      !isOnline ? "opacity-60" : ""
                    }`}
                  >
                    <div className="relative">
                      <Image
                        src={avatar}
                        alt=""
                        width={32}
                        height={32}
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
                    {isCreator && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent>Board owner</TooltipContent>
                      </Tooltip>
                    )}
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
    </div>
  );
}
