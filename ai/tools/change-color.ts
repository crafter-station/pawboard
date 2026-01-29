import { tool } from "ai";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { cards, sessions } from "@/db/schema";
import { canChangeColor } from "@/lib/permissions";
import { broadcastCardEvent } from "@/lib/supabase/broadcast";
import description from "./change-color.md";
import type { ToolParams } from "./index";

const COLOR_MAP: Record<string, string> = {
  yellow: "#fef08a",
  blue: "#93c5fd",
  green: "#86efac",
  pink: "#f9a8d4",
  purple: "#c4b5fd",
  orange: "#fed7aa",
  red: "#fca5a5",
  teal: "#5eead4",
  cyan: "#67e8f9",
  lime: "#bef264",
};

const inputSchema = z.object({
  cardIds: z.array(z.string()).describe("Array of card IDs to change color"),
  color: z
    .string()
    .describe(
      'Color name (yellow, blue, green, pink, purple, orange, red, teal, cyan, lime) or hex code (e.g., "#fef08a")',
    ),
});

export const changeColorTool = ({ sessionId, userId, userRole }: ToolParams) =>
  tool({
    description,
    inputSchema,
    execute: async ({ cardIds, color }) => {
      // Resolve color name to hex if needed
      const hexColor = COLOR_MAP[color.toLowerCase()] || color;

      try {
        const session = await db.query.sessions.findFirst({
          where: eq(sessions.id, sessionId),
        });

        if (!session) {
          return "Error: Session not found";
        }

        const cardsToChange = await db.query.cards.findMany({
          where: and(
            inArray(cards.id, cardIds),
            eq(cards.sessionId, sessionId),
          ),
        });

        if (cardsToChange.length === 0) {
          return "Error: No cards found with the provided IDs";
        }

        // Filter cards user has permission to change
        const changeableCards = cardsToChange.filter((card) =>
          canChangeColor(session, card, userId, userRole),
        );

        if (changeableCards.length === 0) {
          return "Error: You don't have permission to change color of these cards";
        }

        // Update each card color
        const idsToUpdate = changeableCards.map((c) => c.id);
        await db
          .update(cards)
          .set({ color: hexColor, updatedAt: new Date() })
          .where(inArray(cards.id, idsToUpdate));

        // Broadcast color changes to realtime so all clients see the updates
        for (const id of idsToUpdate) {
          await broadcastCardEvent(sessionId, {
            type: "card:color",
            id,
            color: hexColor,
          });
        }

        return `Successfully changed color of ${idsToUpdate.length} card(s) to ${color}`;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to change color";
        return `Error changing color: ${message}`;
      }
    },
  });
