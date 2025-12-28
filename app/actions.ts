"use server";

import { db } from "@/db";
import { sessions, cards } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Card, NewCard } from "@/db/schema";

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
  data: Partial<Pick<Card, "content" | "color" | "x" | "y">>
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
visitorId: string
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

