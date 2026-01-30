import { eq } from "drizzle-orm";
import { db } from "./index";
import { cards } from "./schema";

export async function getSessionCards(sessionId: string) {
  return db.query.cards.findMany({
    where: eq(cards.sessionId, sessionId),
  });
}
