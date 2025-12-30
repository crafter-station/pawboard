"use server";

import { db } from "@/db";
import { sessions, cards, sessionParticipants, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateUsername } from "@/lib/names";
import type { Card, NewCard, User } from "@/db/schema";

// Session Actions

export async function getOrCreateSession(id: string) {
  try {
    let session = await db.query.sessions.findFirst({
      where: eq(sessions.id, id),
    });

    if (!session) {
      const [newSession] = await db
        .insert(sessions)
        .values({ id, name: "Untitled Session" })
        .returning();
      session = newSession;
    }

    return { session, error: null };
  } catch (error) {
    console.error("Database error in getOrCreateSession:", error);
    return { session: null, error: "Failed to connect to database" };
  }
}

// User Actions

export async function getOrCreateUser(
  userId: string,
): Promise<{ user: User | null; error: string | null }> {
  try {
    let user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      const [newUser] = await db
        .insert(users)
        .values({
          id: userId,
          username: generateUsername(),
        })
        .returning();
      user = newUser;
    }

    return { user, error: null };
  } catch (error) {
    console.error("Database error in getOrCreateUser:", error);
    return { user: null, error: "Failed to get or create user" };
  }
}

export async function updateUsername(
  userId: string,
  newUsername: string,
): Promise<{ user: User | null; error: string | null }> {
  try {
    const validation = validateUsername(newUsername);
    if (!validation.valid) {
      return { user: null, error: validation.error ?? "Invalid username" };
    }

    const [user] = await db
      .update(users)
      .set({ username: newUsername.trim() })
      .where(eq(users.id, userId))
      .returning();

    if (!user) {
      return { user: null, error: "User not found" };
    }

    return { user, error: null };
  } catch (error) {
    console.error("Database error in updateUsername:", error);
    return { user: null, error: "Failed to update username" };
  }
}

const USERNAME_MIN_LENGTH = 2;
const USERNAME_MAX_LENGTH = 30;

function validateUsername(username: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = username.trim();

  if (trimmed.length < USERNAME_MIN_LENGTH) {
    return {
      valid: false,
      error: `Name must be at least ${USERNAME_MIN_LENGTH} characters`,
    };
  }

  if (trimmed.length > USERNAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `Name must be at most ${USERNAME_MAX_LENGTH} characters`,
    };
  }

  // Basic sanitization - no special control characters (ASCII 0-31 and 127)
  const controlCharsRegex = new RegExp("[\\x00-\\x1F\\x7F]");
  if (controlCharsRegex.test(trimmed)) {
    return { valid: false, error: "Name contains invalid characters" };
  }

  return { valid: true };
}

// Session Participant Actions

export async function joinSession(
  userId: string,
  sessionId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    // Ensure user exists first
    const { user, error: userError } = await getOrCreateUser(userId);
    if (userError || !user) {
      return { success: false, error: userError ?? "Failed to create user" };
    }

    // Check if already a participant
    const existing = await db.query.sessionParticipants.findFirst({
      where: and(
        eq(sessionParticipants.userId, userId),
        eq(sessionParticipants.sessionId, sessionId),
      ),
    });

    if (!existing) {
      await db.insert(sessionParticipants).values({
        userId,
        sessionId,
      });
    }

    return { success: true, error: null };
  } catch (error) {
    console.error("Database error in joinSession:", error);
    return { success: false, error: "Failed to join session" };
  }
}

export async function getSessionParticipants(
  sessionId: string,
): Promise<{ visitorId: string; username: string }[]> {
  try {
    // Get participants who explicitly joined the session
    const participants = await db.query.sessionParticipants.findMany({
      where: eq(sessionParticipants.sessionId, sessionId),
      with: {
        user: true,
      },
    });

    // Get all card creators for this session (they may not be in session_participants)
    const sessionCards = await db.query.cards.findMany({
      where: eq(cards.sessionId, sessionId),
      with: {
        creator: true,
      },
    });

    // Combine both into a map to deduplicate
    const userMap = new Map<string, string>();

    // Add participants
    for (const p of participants) {
      userMap.set(p.userId, p.user.username);
    }

    // Add card creators
    for (const card of sessionCards) {
      if (card.creator && !userMap.has(card.createdById)) {
        userMap.set(card.createdById, card.creator.username);
      }
    }

    return Array.from(userMap.entries()).map(([visitorId, username]) => ({
      visitorId,
      username,
    }));
  } catch (error) {
    console.error("Database error in getSessionParticipants:", error);
    return [];
  }
}

// Card Actions

export async function getSessionCards(sessionId: string) {
  try {
    return await db.query.cards.findMany({
      where: eq(cards.sessionId, sessionId),
    });
  } catch (error) {
    console.error("Database error in getSessionCards:", error);
    return [];
  }
}

export async function createCard(data: NewCard): Promise<Card> {
  const [card] = await db.insert(cards).values(data).returning();
  return card;
}

export async function updateCard(
  id: string,
  data: Partial<Pick<Card, "content" | "color" | "x" | "y">>,
): Promise<Card> {
  const [card] = await db
    .update(cards)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(cards.id, id))
    .returning();
  return card;
}

export async function voteCard(
  id: string,
  visitorId: string,
): Promise<{ card: Card; action: "added" | "removed" | "denied" }> {
  const existing = await db.query.cards.findFirst({
    where: eq(cards.id, id),
  });

  if (!existing) throw new Error("Card not found");

  if (existing.createdById === visitorId) {
    return { card: existing, action: "denied" };
  }

  const votedBy = existing.votedBy || [];
  const hasVoted = votedBy.includes(visitorId);

  let newVotedBy: string[];
  let newVotes: number;

  if (hasVoted) {
    newVotedBy = votedBy.filter((v) => v !== visitorId);
    newVotes = existing.votes - 1;
  } else {
    newVotedBy = [...votedBy, visitorId];
    newVotes = existing.votes + 1;
  }

  const [card] = await db
    .update(cards)
    .set({ votes: newVotes, votedBy: newVotedBy, updatedAt: new Date() })
    .where(eq(cards.id, id))
    .returning();

  return { card, action: hasVoted ? "removed" : "added" };
}

export async function deleteCard(id: string, visitorId: string) {
  const existing = await db.query.cards.findFirst({
    where: eq(cards.id, id),
  });

  if (!existing) return;
  if (existing.createdById !== visitorId) return;

  await db.delete(cards).where(eq(cards.id, id));
}
