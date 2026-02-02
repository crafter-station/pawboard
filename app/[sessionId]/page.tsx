import { eq } from "drizzle-orm";
import Link from "next/link";
import {
  getOrCreateSession,
  getSessionCards,
  getSessionParticipants,
  getSessionThreads,
} from "@/app/actions";
import { ErrorBoundary } from "@/components/error-boundary";
import { ReactFlowBoard as Board } from "@/components/react-flow-board";
import { db } from "@/db";
import { sessions } from "@/db/schema";

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default async function SessionPage({ params }: Props) {
  const { sessionId } = await params;

  const { session, error } = await getOrCreateSession(sessionId);

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold text-foreground">
            Connection Error
          </h1>
          <p className="text-muted-foreground">
            Unable to connect to the database. Please try again in a moment.
          </p>
          <div className="flex gap-3 justify-center pt-4">
            <Link
              href={`/${sessionId}`}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Retry
            </Link>
            <Link
              href="/"
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
            >
              Go Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Check if session has expired
  if (session.expiresAt && new Date() > session.expiresAt) {
    // Delete the expired session
    await db.delete(sessions).where(eq(sessions.id, sessionId));

    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold text-foreground">Board Expired</h1>
          <p className="text-muted-foreground">
            This board has expired and is no longer available. Unclaimed boards
            are automatically deleted after 2 days.
          </p>
          <p className="text-sm text-muted-foreground">
            Sign in to claim your boards and keep them forever!
          </p>
          <div className="flex gap-3 justify-center pt-4">
            <Link
              href="/"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Create New Board
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const [initialCards, initialParticipants, { threads: initialThreads }] =
    await Promise.all([
      getSessionCards(sessionId),
      getSessionParticipants(sessionId),
      getSessionThreads(sessionId),
    ]);

  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center space-y-4 max-w-md">
            <h2 className="text-2xl font-bold text-foreground">
              Something went wrong
            </h2>
            <p className="text-muted-foreground">
              The board encountered an error. Please try refreshing the page.
            </p>
            <div className="flex gap-3 justify-center pt-4">
              <Link
                href={`/${sessionId}`}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Refresh
              </Link>
              <Link
                href="/"
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
              >
                Go Home
              </Link>
            </div>
          </div>
        </div>
      }
    >
      <Board
        sessionId={sessionId}
        initialSession={session}
        initialCards={initialCards}
        initialThreads={initialThreads}
        initialParticipants={initialParticipants}
      />
    </ErrorBoundary>
  );
}
