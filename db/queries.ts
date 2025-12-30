import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  sessions,
  cards,
  type NewSession,
  type NewCard,
  type Card,
} from "./schema";

export async function createSession(data: NewSession) {
  const [session] = await db.insert(sessions).values(data).returning();
  return session;
}

export async function getSession(id: string) {
  return db.query.sessions.findFirst({
    where: eq(sessions.id, id),
  });
}

export async function getSessionCards(sessionId: string) {
  return db.query.cards.findMany({
    where: eq(cards.sessionId, sessionId),
  });
}

export async function createCard(data: NewCard) {
  const [card] = await db.insert(cards).values(data).returning();
  return card;
}

export async function updateCard(
  id: string,
  data: Partial<Pick<Card, "content" | "color" | "x" | "y">>,
) {
  const [card] = await db
    .update(cards)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(cards.id, id))
    .returning();
  return card;
}

export async function deleteCard(id: string) {
  await db.delete(cards).where(eq(cards.id, id));
}
