import { tool } from "ai";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getUserRoleInSession } from "@/app/actions";
import { db } from "@/db";
import { cards, sessions } from "@/db/schema";
import { canDeleteCard } from "@/lib/permissions";
import { broadcastCardEvent } from "@/lib/supabase/broadcast";
import description from "./delete-cards.md";
import type { ToolParams } from "./index";

const inputSchema = z.object({
  cardIds: z
    .array(z.string())
    .describe("Array of card IDs to delete. Can be one or multiple."),
});

export const deleteCardsTool = ({ sessionId, userId }: ToolParams) =>
  tool({
    description,
    inputSchema,
    execute: async ({ cardIds }) => {
      try {
        const session = await db.query.sessions.findFirst({
          where: eq(sessions.id, sessionId),
        });

        if (!session) {
          return "Error: Session not found";
        }

        const userRole = await getUserRoleInSession(userId, sessionId);
        const cardsToDelete = await db.query.cards.findMany({
          where: and(
            inArray(cards.id, cardIds),
            eq(cards.sessionId, sessionId),
          ),
        });

        if (cardsToDelete.length === 0) {
          return "Error: No cards found with the provided IDs in this session";
        }

        // Filter cards user has permission to delete
        const deletableCards = cardsToDelete.filter((card) =>
          canDeleteCard(session, card, userId, userRole ?? "participant"),
        );

        if (deletableCards.length === 0) {
          return "Error: You don't have permission to delete any of these cards";
        }

        const idsToDelete = deletableCards.map((c) => c.id);
        await db.delete(cards).where(inArray(cards.id, idsToDelete));

        // Broadcast deletions to realtime so all clients remove the cards
        for (const id of idsToDelete) {
          await broadcastCardEvent(sessionId, { type: "card:delete", id });
        }

        const skipped = cardIds.length - idsToDelete.length;
        const skippedMsg =
          skipped > 0 ? ` (${skipped} cards skipped due to permissions)` : "";
        return `Successfully deleted ${idsToDelete.length} card(s)${skippedMsg}`;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to delete cards";
        return `Error deleting cards: ${message}`;
      }
    },
  });
