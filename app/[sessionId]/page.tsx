import Link from "next/link";
import {
  getOrCreateSession,
  getSessionCards,
  getSessionParticipants,
} from "@/app/actions";
import { Board } from "@/components/board";

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

  const [initialCards, initialParticipants] = await Promise.all([
    getSessionCards(sessionId),
    getSessionParticipants(sessionId),
  ]);

  return (
    <Board
      sessionId={sessionId}
      initialSession={session}
      initialCards={initialCards}
      initialParticipants={initialParticipants}
    />
  );
}
