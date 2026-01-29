import { tool } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { cards, sessions } from "@/db/schema";
import { canEditCard } from "@/lib/permissions";
import { broadcastCardEvent } from "@/lib/supabase/broadcast";
import { createTiptapContent } from "@/lib/tiptap-utils";
import description from "./edit-card.md";
import type { ToolParams } from "./index";

const inputSchema = z.object({
  cardId: z.string().describe("The ID of the card to edit"),
  content: z.string().describe("The new content for the card"),
});

export const editCardTool = ({ sessionId, userId, userRole }: ToolParams) =>
  tool({
    description,
    inputSchema,
    execute: async ({ cardId, content }) => {
      try {
        const card = await db.query.cards.findFirst({
          where: eq(cards.id, cardId),
        });

        if (!card) {
          return `Error: Card with ID "${cardId}" not found`;
        }

        if (card.sessionId !== sessionId) {
          return "Error: Card belongs to a different session";
        }

        const session = await db.query.sessions.findFirst({
          where: eq(sessions.id, sessionId),
        });

        if (!session) {
          return "Error: Session not found";
        }

        if (!canEditCard(session, card, userId, userRole)) {
          return "Error: You don't have permission to edit this card";
        }

        const tiptapContent = createTiptapContent(content);
        const [updatedCard] = await db
          .update(cards)
          .set({ content: tiptapContent, updatedAt: new Date() })
          .where(eq(cards.id, cardId))
          .returning();

        // Broadcast to realtime so all clients see the update
        await broadcastCardEvent(sessionId, {
          type: "card:update",
          card: updatedCard,
        });

        return `Successfully updated card ${cardId}. New content: "${content.substring(0, 50)}${content.length > 50 ? "..." : ""}"`;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to edit card";
        return `Error editing card: ${message}`;
      }
    },
  });
