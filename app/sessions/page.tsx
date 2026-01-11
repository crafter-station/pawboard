"use client";

import { ArrowLeft, Crown, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getUserSessions } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { SessionRole } from "@/db/schema";
import { useCatSound } from "@/hooks/use-cat-sound";
import { useFingerprint } from "@/hooks/use-fingerprint";
import { generateSessionId } from "@/lib/nanoid";

interface SessionData {
  id: string;
  name: string;
  role: SessionRole;
  creatorName: string;
  lastActivityAt: Date;
  lastActiveAt: Date;
  cardCount: number;
}

export default function SessionsPage() {
  const router = useRouter();
  const playSound = useCatSound();
  const { visitorId, isLoading: fingerprintLoading } = useFingerprint();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    async function loadSessions() {
      if (!visitorId) return;

      setIsLoading(true);
      const { sessions: fetchedSessions, error: fetchError } =
        await getUserSessions(visitorId);

      if (fetchError) {
        setError(fetchError);
      } else {
        setSessions(fetchedSessions);
      }
      setIsLoading(false);
    }

    if (visitorId) {
      loadSessions();
    }
  }, [visitorId]);

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

  if (fingerprintLoading || isLoading) {
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
            >
              <ArrowLeft className="w-5 h-5" />
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
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-lg font-semibold truncate">
                          {session.name}
                        </h2>
                        {session.role === "creator" ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary/15 text-primary font-semibold border border-primary/20">
                            <Crown className="w-3 h-3" />
                            My Session
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
                          <span>•</span>
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
