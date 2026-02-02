"use client";

import { Clock, Crown, Ghost, Plus, Shield, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAllUserSessions } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { SessionRole } from "@/db/schema";
import { useCatSound } from "@/hooks/use-cat-sound";
import { useCurrentUser } from "@/hooks/use-current-user";
import { generateSessionId } from "@/lib/nanoid";

interface SessionData {
  id: string;
  name: string;
  role: SessionRole;
  creatorName: string;
  lastActivityAt: Date;
  lastActiveAt: Date;
  cardCount: number;
  isAnonymous: boolean;
  isClaimed: boolean;
  expiresAt: Date | null;
}

export default function SessionsPage() {
  const router = useRouter();
  const playSound = useCatSound();
  const {
    fingerprintId,
    isAuthenticated,
    isLoading: userLoading,
  } = useCurrentUser();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    async function loadSessions() {
      if (!fingerprintId) return;

      setIsLoading(true);
      const { sessions: fetchedSessions, error: fetchError } =
        await getAllUserSessions(fingerprintId);

      if (fetchError) {
        setError(fetchError);
      } else {
        setSessions(fetchedSessions);
      }
      setIsLoading(false);
    }

    if (fingerprintId) {
      loadSessions();
    }
  }, [fingerprintId]);

  const handleCreateSession = () => {
    playSound();
    setIsCreating(true);
    const id = generateSessionId();
    router.push(`/${id}`);
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(date).toLocaleDateString();
  };

  const formatTimeRemaining = (expiresAt: Date) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();

    if (diffMs <= 0) return "Expired";

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return `${days}d left`;
    }
    return `${hours}h left`;
  };

  if (userLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading sessions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-destructive">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/")}
              className="rounded-full"
              aria-label="Go back"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <title>Back arrow</title>
                <path d="m12 19-7-7 7-7" />
                <path d="M19 12H5" />
              </svg>
            </Button>
            <h1 className="text-3xl font-bold">My Sessions</h1>
          </div>
          <Button
            onClick={handleCreateSession}
            disabled={isCreating}
            className="rounded-xl"
          >
            {isCreating ? (
              "Creating..."
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                New Session
              </>
            )}
          </Button>
        </div>

        {sessions.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <p className="text-muted-foreground text-lg">
              You haven&apos;t joined any sessions yet
            </p>
            <Button onClick={() => router.push("/")}>
              Start a new session
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <Link key={session.id} href={`/${session.id}`} className="block">
                <div className="bg-card border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h2 className="text-lg font-semibold truncate">
                          {session.name}
                        </h2>
                        {/* Tags in priority order */}
                        {session.isClaimed ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 font-semibold border border-green-500/20">
                            <Shield className="w-3 h-3" />
                            Claimed
                          </span>
                        ) : session.expiresAt ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium border border-amber-500/20">
                            <Clock className="w-3 h-3" />
                            {formatTimeRemaining(session.expiresAt)}
                          </span>
                        ) : null}
                        {session.isAnonymous && isAuthenticated && (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                            <Ghost className="w-3 h-3" />
                            Anonymous
                          </span>
                        )}
                        {session.role === "creator" ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary/15 text-primary font-semibold border border-primary/20">
                            <Crown className="w-3 h-3" />
                            Creator
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                            <Users className="w-3 h-3" />
                            Participant
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-0.5">
                        <p>Created by {session.creatorName}</p>
                        <div className="flex items-center gap-4">
                          <span>{session.cardCount} cards</span>
                          <span>-</span>
                          <span>
                            Last activity:{" "}
                            {formatRelativeTime(session.lastActivityAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground whitespace-nowrap">
                      You: {formatRelativeTime(session.lastActiveAt)}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
